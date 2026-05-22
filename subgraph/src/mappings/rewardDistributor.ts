import {
  TokensMintedAndDistributed,
  MaxMintSupplyUpdated,
  StakingPoolAuthorized,
  StakingPoolDeauthorized,
} from '../../generated/RewardDistributor/RewardDistributor'
import { ResurgeToken as ResurgeTokenEntity } from '../../generated/schema'
import { BigInt, log } from '@graphprotocol/graph-ts'

const RESURGE_TOKEN_ID = 'resurge-token'

export function handleTokensMintedAndDistributed(
  event: TokensMintedAndDistributed
): void {
  let token = ResurgeTokenEntity.load(RESURGE_TOKEN_ID)
  if (token != null) {
    token.totalRewardsDistributed = token.totalRewardsDistributed.plus(
      event.params.amount
    )
    token.totalSupply = token.totalSupply.plus(event.params.amount)
    token.save()
  }

  log.info('TokensMintedAndDistributed: to={}, amount={}', [
    event.params.to.toHexString(),
    event.params.amount.toString(),
  ])
}

export function handleMaxMintSupplyUpdated(event: MaxMintSupplyUpdated): void {
  log.info('MaxMintSupplyUpdated: newMaxSupply={}', [
    event.params.newMaxSupply.toString(),
  ])
}

export function handleStakingPoolAuthorized(event: StakingPoolAuthorized): void {
  log.info('StakingPoolAuthorized: pool={}', [
    event.params.stakingPool.toHexString(),
  ])
}

export function handleStakingPoolDeauthorized(
  event: StakingPoolDeauthorized
): void {
  log.info('StakingPoolDeauthorized: pool={}', [
    event.params.stakingPool.toHexString(),
  ])
}
