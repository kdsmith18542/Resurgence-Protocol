import {
  StakingPoolAdded,
  RewardRateUpdated,
  StakingPoolPaused,
  StakingPoolUnpaused,
  StakingPoolRemoved,
  ImplementationUpdated,
} from '../../generated/StakingPoolManager/StakingPoolManager'
import {
  DeadCoinStakingPool as DeadCoinStakingPoolTemplate,
} from '../../generated/templates'
import { StakingPool, ProtocolMetrics } from '../../generated/schema'
import { BigInt, Bytes, crypto, log } from '@graphprotocol/graph-ts'
import { ZERO_BI, ONE_BI } from '../utils'

const PROTOCOL_METRICS_ID = 'protocol-metrics'

function getOrCreateMetrics(): ProtocolMetrics {
  let metrics = ProtocolMetrics.load(PROTOCOL_METRICS_ID)
  if (metrics == null) {
    metrics = new ProtocolMetrics(PROTOCOL_METRICS_ID)
    metrics.totalValueLocked = ZERO_BI
    metrics.totalPools = ZERO_BI
    metrics.totalStakers = ZERO_BI
    metrics.totalProposals = ZERO_BI
    metrics.updatedAt = ZERO_BI
  }
  return metrics
}

export function handleStakingPoolAdded(event: StakingPoolAdded): void {
  let deadCoinAddress = event.params.deadCoinAddress
  let poolAddress = event.params.poolAddress

  let pool = new StakingPool(
    Bytes.fromHexString(deadCoinAddress.toHexString())
  )
  pool.deadCoinToken = deadCoinAddress
  pool.poolAddress = poolAddress
  pool.resurgeToken = Bytes.empty()
  pool.rewardRatePerSecond = event.params.initialRewardRate
  pool.lastUpdateTime = BigInt.fromI32(0)
  pool.rewardPerTokenStored = ZERO_BI
  pool.totalStaked = ZERO_BI
  pool.paused = false
  pool.createdAt = event.block.timestamp
  pool.stakerCount = ZERO_BI
  pool.save()

  // Update protocol metrics
  let metrics = getOrCreateMetrics()
  metrics.totalPools = metrics.totalPools.plus(ONE_BI)
  metrics.updatedAt = event.block.timestamp
  metrics.save()

  // Start indexing events from this pool
  DeadCoinStakingPoolTemplate.create(poolAddress)

  log.info('StakingPoolAdded: deadCoin={}, pool={}, rate={}', [
    deadCoinAddress.toHexString(),
    poolAddress.toHexString(),
    event.params.initialRewardRate.toString(),
  ])
}

export function handleRewardRateUpdated(event: RewardRateUpdated): void {
  let deadCoinAddress = event.params.deadCoinAddress
  let poolId = Bytes.fromHexString(deadCoinAddress.toHexString())
  let pool = StakingPool.load(poolId)

  if (pool != null) {
    pool.rewardRatePerSecond = event.params.newRatePerSecond
    pool.save()
  }

  log.info('RewardRateUpdated: deadCoin={}, newRate={}', [
    deadCoinAddress.toHexString(),
    event.params.newRatePerSecond.toString(),
  ])
}

export function handleStakingPoolPaused(event: StakingPoolPaused): void {
  let poolId = Bytes.fromHexString(event.params.deadCoinAddress.toHexString())
  let pool = StakingPool.load(poolId)

  if (pool != null) {
    pool.paused = true
    pool.save()
  }
}

export function handleStakingPoolUnpaused(event: StakingPoolUnpaused): void {
  let poolId = Bytes.fromHexString(event.params.deadCoinAddress.toHexString())
  let pool = StakingPool.load(poolId)

  if (pool != null) {
    pool.paused = false
    pool.save()
  }
}

export function handleStakingPoolRemoved(event: StakingPoolRemoved): void {
  let poolId = Bytes.fromHexString(event.params.deadCoinAddress.toHexString())
  let pool = StakingPool.load(poolId)

  if (pool != null) {
    pool.paused = true
    pool.save()
  }

  let metrics = getOrCreateMetrics()
  if (metrics.totalPools.gt(ZERO_BI)) {
    metrics.totalPools = metrics.totalPools.minus(ONE_BI)
  }
  metrics.updatedAt = event.block.timestamp
  metrics.save()
}

export function handleImplementationUpdated(event: ImplementationUpdated): void {
  log.info('ImplementationUpdated: newImpl={}', [
    event.params.newImplementation.toHexString(),
  ])
}
