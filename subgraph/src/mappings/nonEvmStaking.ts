import { WalletRegistered, WalletUnregistered } from '../../generated/NonEvmStakingPool/NonEvmStakingPool'
import { NonEvmWallet, User } from '../../generated/schema'
import { Address, BigInt, Bytes, log } from '@graphprotocol/graph-ts'

function getOrCreateUser(address: Address): User {
  let id = Bytes.fromHexString(address.toHexString())
  let user = User.load(id)
  if (user == null) {
    user = new User(id)
    user.stakedBalance = BigInt.fromI32(0)
    user.totalResurgeEarned = BigInt.fromI32(0)
    user.rewardsClaimed = BigInt.fromI32(0)
    user.totalStakingTransactions = BigInt.fromI32(0)
    user.save()
  }
  return user
}

export function handleWalletRegistered(event: WalletRegistered): void {
  let id = event.params.chainId.concat(event.params.walletHash)
  let wallet = new NonEvmWallet(id)

  let user = getOrCreateUser(event.params.staker)

  wallet.chainId = event.params.chainId
  wallet.walletHash = event.params.walletHash
  wallet.wallet = event.params.wallet
  wallet.staker = user.id
  wallet.registeredAt = event.params.registeredAt
  wallet.active = true
  wallet.registeredAtBlock = event.block.number
  wallet.registeredAtTx = event.transaction.hash
  wallet.save()

  log.info('WalletRegistered: chain={} wallet={} staker={}', [
    event.params.chainId.toHexString(),
    event.params.wallet,
    event.params.staker.toHexString(),
  ])
}

export function handleWalletUnregistered(event: WalletUnregistered): void {
  let id = event.params.chainId.concat(event.params.walletHash)
  let wallet = NonEvmWallet.load(id)
  if (wallet != null) {
    wallet.active = false
    wallet.save()
  }

  log.info('WalletUnregistered: chain={} wallet={} staker={}', [
    event.params.chainId.toHexString(),
    event.params.wallet,
    event.params.staker.toHexString(),
  ])
}
