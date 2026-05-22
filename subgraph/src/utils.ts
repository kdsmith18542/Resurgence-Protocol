import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'

export const ZERO_BI = BigInt.fromI32(0)
export const ONE_BI = BigInt.fromI32(1)

export function getEventId(event: ethereum.Event): Bytes {
  return event.transaction.hash.concat(
    Bytes.fromByteArray(Bytes.fromBigInt(event.logIndex))
  )
}

export function getPositionId(user: Bytes, pool: Bytes): Bytes {
  return user.concat(Bytes.fromHexString('0x')).concat(pool)
}

export function getProposalId(proposalId: BigInt): Bytes {
  return Bytes.fromByteArray(Bytes.fromBigInt(proposalId))
}

export function getVoteId(proposalId: BigInt, voter: Bytes): Bytes {
  return voter
    .concat(Bytes.fromHexString('0x'))
    .concat(Bytes.fromByteArray(Bytes.fromBigInt(proposalId)))
}
