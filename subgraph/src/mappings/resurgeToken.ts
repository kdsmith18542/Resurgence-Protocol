import { Transfer, Approval } from '../../generated/ResurgeToken/ResurgeToken'
import { User, ResurgeToken as ResurgeTokenEntity } from '../../generated/schema'
import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts'

const RESURGE_TOKEN_ID = 'resurge-token'

function getOrCreateToken(): ResurgeTokenEntity {
  let token = ResurgeTokenEntity.load(RESURGE_TOKEN_ID)
  if (token == null) {
    token = new ResurgeTokenEntity(RESURGE_TOKEN_ID)
    token.name = 'Resurgence Protocol'
    token.symbol = 'RESURGE'
    token.totalSupply = BigInt.zero()
    token.totalStakedAllPools = BigInt.zero()
    token.totalRewardsDistributed = BigInt.zero()
  }
  return token
}

function getOrCreateUser(address: Address): User {
  let id = Bytes.fromHexString(address.toHexString())
  let user = User.load(id)
  if (user == null) {
    user = new User(id)
    user.stakedBalance = BigInt.zero()
    user.totalResurgeEarned = BigInt.zero()
    user.rewardsClaimed = BigInt.zero()
    user.totalStakingTransactions = BigInt.zero()
    user.save()
  }
  return user
}

export function handleTransfer(event: Transfer): void {
  let token = getOrCreateToken()
  let totalSupply = token.totalSupply

  let fromAddress = event.params.from
  let toAddress = event.params.to
  let value = event.params.value

  if (fromAddress == Address.zero()) {
    totalSupply = totalSupply.plus(value)
  }
  if (toAddress == Address.zero()) {
    totalSupply = totalSupply.minus(value)
  }

  token.totalSupply = totalSupply
  token.save()

  // Index users involved
  if (fromAddress != Address.zero()) {
    getOrCreateUser(fromAddress)
  }
  if (toAddress != Address.zero()) {
    getOrCreateUser(toAddress)
  }
}

export function handleApproval(event: Approval): void {
  // Approval events tracked for reference; no entity updates needed
}
