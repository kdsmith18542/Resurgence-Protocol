import {
  Staked,
  Unstaked,
  RewardsClaimed,
  RewardRateUpdated,
  BridgeClaimed,
} from '../../generated/templates/DeadCoinStakingPool/DeadCoinStakingPool'
import {
  User,
  StakingPool,
  StakingPosition,
  StakingEvent,
  RewardClaimEvent,
  BridgeClaimEvent,
  ProtocolMetrics,
  ResurgeToken as ResurgeTokenEntity,
} from '../../generated/schema'
import { Address, BigInt, Bytes, log } from '@graphprotocol/graph-ts'
import { ZERO_BI, ONE_BI, getEventId, getPositionId } from '../utils'

const RESURGE_TOKEN_ID = 'resurge-token'
const PROTOCOL_METRICS_ID = 'protocol-metrics'

function getOrCreateUser(address: Address): User {
  let id = Bytes.fromHexString(address.toHexString())
  let user = User.load(id)
  if (user == null) {
    user = new User(id)
    user.stakedBalance = ZERO_BI
    user.totalResurgeEarned = ZERO_BI
    user.rewardsClaimed = ZERO_BI
    user.totalStakingTransactions = ZERO_BI
    user.save()
  }
  return user
}

function getOrCreatePool(poolAddress: Address, timestamp: BigInt): StakingPool {
  let poolId = Bytes.fromHexString(poolAddress.toHexString())
  let pool = StakingPool.load(poolId)
  if (pool == null) {
    // Pool was deployed directly (not via StakingPoolManager) — bootstrap without archive call
    pool = new StakingPool(poolId)
    pool.deadCoinToken = Address.zero()
    pool.poolAddress = poolAddress
    pool.resurgeToken = Bytes.empty()
    pool.rewardRatePerSecond = ZERO_BI
    pool.lastUpdateTime = ZERO_BI
    pool.rewardPerTokenStored = ZERO_BI
    pool.totalStaked = ZERO_BI
    pool.paused = false
    pool.createdAt = timestamp
    pool.stakerCount = ZERO_BI
    pool.save()
    log.info('getOrCreatePool: bootstrapped directly-deployed pool {}', [poolAddress.toHexString()])
  }
  return pool
}

function getOrCreatePosition(
  userAddress: Address,
  poolAddress: Address
): StakingPosition {
  let user = getOrCreateUser(userAddress)
  let userId = Bytes.fromHexString(userAddress.toHexString())
  let poolId = Bytes.fromHexString(poolAddress.toHexString())
  let positionId = getPositionId(userId, poolId)

  let position = StakingPosition.load(positionId)
  if (position == null) {
    position = new StakingPosition(positionId)
    position.user = userId
    position.pool = poolId
    position.stakedAmount = ZERO_BI
    position.unclaimedRewards = ZERO_BI
    position.rewardPerTokenPaid = ZERO_BI
    position.lastStakedAt = ZERO_BI
    position.lastUnstakedAt = null
    position.lastClaimedAt = null
  }
  return position
}

function updateMetricsTVL(delta: BigInt, timestamp: BigInt): void {
  let metrics = ProtocolMetrics.load(PROTOCOL_METRICS_ID)
  if (metrics == null) return

  if (delta.gt(ZERO_BI)) {
    metrics.totalValueLocked = metrics.totalValueLocked.plus(delta)
  } else {
    let absDelta = delta.neg()
    if (metrics.totalValueLocked.ge(absDelta)) {
      metrics.totalValueLocked = metrics.totalValueLocked.minus(absDelta)
    }
  }
  metrics.updatedAt = timestamp
  metrics.save()
}

export function handleStaked(event: Staked): void {
  let userAddress = event.params.user
  let amount = event.params.amount
  let poolAddress = event.address

  let user = getOrCreateUser(userAddress)
  let userId = Bytes.fromHexString(userAddress.toHexString())
  let pool = getOrCreatePool(poolAddress, event.block.timestamp)

  let wasZero = user.stakedBalance.isZero()

  user.stakedBalance = user.stakedBalance.plus(amount)
  user.totalStakingTransactions = user.totalStakingTransactions.plus(ONE_BI)
  user.save()

  let position = getOrCreatePosition(userAddress, poolAddress)
  let wasNewPosition = position.stakedAmount.isZero()
  position.stakedAmount = position.stakedAmount.plus(amount)
  position.lastStakedAt = event.block.timestamp
  position.save()

  pool.totalStaked = pool.totalStaked.plus(amount)
  if (wasNewPosition) {
    pool.stakerCount = pool.stakerCount.plus(ONE_BI)
  }
  pool.save()

  updateMetricsTVL(amount, event.block.timestamp)

  let stakingEvent = new StakingEvent(getEventId(event))
  stakingEvent.user = userId
  stakingEvent.pool = pool.id
  stakingEvent.amount = amount
  stakingEvent.timestamp = event.block.timestamp
  stakingEvent.blockNumber = event.block.number
  stakingEvent.transactionHash = event.transaction.hash
  stakingEvent.type = 'Stake'
  stakingEvent.save()
}

export function handleUnstaked(event: Unstaked): void {
  let userAddress = event.params.user
  let amount = event.params.amount
  let poolAddress = event.address

  let user = getOrCreateUser(userAddress)
  let userId = Bytes.fromHexString(userAddress.toHexString())
  let pool = getOrCreatePool(poolAddress, event.block.timestamp)

  if (user.stakedBalance.ge(amount)) {
    user.stakedBalance = user.stakedBalance.minus(amount)
  }
  user.totalStakingTransactions = user.totalStakingTransactions.plus(ONE_BI)
  user.save()

  let position = getOrCreatePosition(userAddress, poolAddress)
  if (position.stakedAmount.ge(amount)) {
    position.stakedAmount = position.stakedAmount.minus(amount)
  }
  position.lastUnstakedAt = event.block.timestamp
  position.save()

  if (pool.totalStaked.ge(amount)) {
    pool.totalStaked = pool.totalStaked.minus(amount)
  }
  if (position.stakedAmount.isZero()) {
    if (pool.stakerCount.gt(ZERO_BI)) {
      pool.stakerCount = pool.stakerCount.minus(ONE_BI)
    }
  }
  pool.save()

  let negAmount = ZERO_BI.minus(amount)
  updateMetricsTVL(negAmount, event.block.timestamp)

  let stakingEvent = new StakingEvent(getEventId(event))
  stakingEvent.user = userId
  stakingEvent.pool = pool.id
  stakingEvent.amount = amount
  stakingEvent.timestamp = event.block.timestamp
  stakingEvent.blockNumber = event.block.number
  stakingEvent.transactionHash = event.transaction.hash
  stakingEvent.type = 'Unstake'
  stakingEvent.save()
}

export function handleRewardsClaimed(event: RewardsClaimed): void {
  let userAddress = event.params.user
  let amount = event.params.amount
  let poolAddress = event.address

  let user = getOrCreateUser(userAddress)
  let userId = Bytes.fromHexString(userAddress.toHexString())
  let pool = getOrCreatePool(poolAddress, event.block.timestamp)

  user.totalResurgeEarned = user.totalResurgeEarned.plus(amount)
  user.rewardsClaimed = user.rewardsClaimed.plus(amount)
  user.save()

  let position = getOrCreatePosition(userAddress, poolAddress)
  position.unclaimedRewards = ZERO_BI
  position.lastClaimedAt = event.block.timestamp
  position.save()

  let token = ResurgeTokenEntity.load(RESURGE_TOKEN_ID)
  if (token != null) {
    token.totalRewardsDistributed = token.totalRewardsDistributed.plus(amount)
    token.save()
  }

  let claimEvent = new RewardClaimEvent(getEventId(event))
  claimEvent.user = userId
  claimEvent.pool = pool.id
  claimEvent.amount = amount
  claimEvent.timestamp = event.block.timestamp
  claimEvent.blockNumber = event.block.number
  claimEvent.transactionHash = event.transaction.hash
  claimEvent.save()
}

export function handleRewardRateUpdated(event: RewardRateUpdated): void {
  let pool = getOrCreatePool(event.address, event.block.timestamp)
  pool.rewardRatePerSecond = event.params.newRatePerSecond
  pool.save()
}

export function handleBridgeClaimed(event: BridgeClaimed): void {
  let userAddress = event.params.user
  let amount = event.params.amount
  let messageId = event.params.messageId
  let poolAddress = event.address

  let user = getOrCreateUser(userAddress)
  let userId = Bytes.fromHexString(userAddress.toHexString())
  let pool = getOrCreatePool(poolAddress, event.block.timestamp)

  user.totalResurgeEarned = user.totalResurgeEarned.plus(amount)
  user.rewardsClaimed = user.rewardsClaimed.plus(amount)
  user.save()

  let position = getOrCreatePosition(userAddress, poolAddress)
  position.unclaimedRewards = ZERO_BI
  position.lastClaimedAt = event.block.timestamp
  position.save()

  let claimEvent = new BridgeClaimEvent(getEventId(event))
  claimEvent.user = userId
  claimEvent.pool = pool.id
  claimEvent.amount = amount
  claimEvent.messageId = Bytes.fromByteArray(messageId)
  claimEvent.timestamp = event.block.timestamp
  claimEvent.blockNumber = event.block.number
  claimEvent.transactionHash = event.transaction.hash
  claimEvent.save()
}
