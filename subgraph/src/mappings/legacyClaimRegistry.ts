import {
  LegacyClaimSubmitted,
  ClaimQuarantined,
  ClaimReleased,
  ClaimRejected,
  ClaimMinted,
  CampaignUpdated,
  PolicyUpdated,
  LegacyClaimRegistry,
  VaultAddressUpdated,
  BurnAddressUpdated
} from '../../generated/LegacyClaimRegistry/LegacyClaimRegistry'
import {
  LegacyClaim,
  TransferClaim,
  LaceQuarantineEvent,
  LaceCampaign,
  LacePolicy,
  User,
  LaceVault,
  LaceBurnAddress
} from '../../generated/schema'
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

export function handleLegacyClaimSubmitted(event: LegacyClaimSubmitted): void {
  let claimId = event.params.claimId
  let claim = new LegacyClaim(claimId)

  let user = getOrCreateUser(event.params.evmWallet)

  claim.sourceChainId = event.params.sourceChainId
  claim.evmWallet = user.id
  claim.claimType = event.params.claimType
  claim.rewardAmount = event.params.rewardAmount
  claim.status = 'Pending' // Initial status, will be overwritten if auto-minted or quarantined
  claim.submittedAt = event.block.timestamp
  claim.submittedAtBlock = event.block.number
  claim.submittedAtTx = event.transaction.hash

  // Bind contract to fetch the remaining struct fields
  let contract = LegacyClaimRegistry.bind(event.address)
  let claimResult = contract.try_claims(claimId)
  if (!claimResult.reverted) {
    let value = claimResult.value
    claim.sourceAddressHash = value.getSourceAddressHash()
    claim.proofHash = value.getProofHash()
    claim.sourceTxHash = value.getSourceTxHash()
    claim.confidenceTier = value.getConfidenceTier()
    claim.lastSeenTimestamp = value.getLastSeenTimestamp()
    claim.dormancySeconds = value.getDormancySeconds()
    claim.campaignId = value.getCampaignId()
  } else {
    // Fallback if call fails
    claim.sourceAddressHash = Bytes.fromHexString('0x0000000000000000000000000000000000000000000000000000000000000000')
    claim.proofHash = Bytes.fromHexString('0x0000000000000000000000000000000000000000000000000000000000000000')
    claim.sourceTxHash = Bytes.fromHexString('0x0000000000000000000000000000000000000000000000000000000000000000')
    claim.confidenceTier = 0
    claim.lastSeenTimestamp = BigInt.fromI32(0)
    claim.dormancySeconds = BigInt.fromI32(0)
    claim.campaignId = BigInt.fromI32(0)
  }

  claim.save()

  // Create TransferClaim entity for transfer/burn claims
  let claimType = event.params.claimType
  if (claimType == 1 || claimType == 2) { // TransferToVault or BurnProof
    let transferClaim = new TransferClaim(claimId)
    transferClaim.legacyClaim = claimId
    transferClaim.claimType = claimType == 1 ? 'TransferToVault' : 'BurnProof'
    transferClaim.sourceChainId = event.params.sourceChainId
    transferClaim.evmWallet = user.id
    transferClaim.rewardAmount = event.params.rewardAmount
    transferClaim.status = 'Pending'
    transferClaim.submittedAt = event.block.timestamp
    transferClaim.submittedAtBlock = event.block.number
    transferClaim.submittedAtTx = event.transaction.hash

    // Fetch sourceTxHash from contract
    if (!claimResult.reverted) {
      transferClaim.sourceTxHash = claimResult.value.getSourceTxHash()
    }

    transferClaim.save()
    log.info('TransferClaim created: claimId={} type={}', [
      claimId.toHexString(),
      claimType == 1 ? 'TransferToVault' : 'BurnProof'
    ])
  }

  log.info('LegacyClaimSubmitted: claimId={} user={}', [
    claimId.toHexString(),
    event.params.evmWallet.toHexString()
  ])
}

export function handleClaimQuarantined(event: ClaimQuarantined): void {
  let claimId = event.params.claimId
  let claim = LegacyClaim.load(claimId)
  if (claim != null) {
    claim.status = 'Quarantined'
    claim.quarantineReason = event.params.reason
    claim.save()
  }

  let eventId = event.transaction.hash.concat(claimId)
  let quarantineEvent = new LaceQuarantineEvent(eventId)
  quarantineEvent.claim = claimId
  quarantineEvent.eventType = 'Quarantined'
  quarantineEvent.reason = event.params.reason
  quarantineEvent.timestamp = event.block.timestamp
  quarantineEvent.blockNumber = event.block.number
  quarantineEvent.transactionHash = event.transaction.hash
  quarantineEvent.save()
}

export function handleClaimReleased(event: ClaimReleased): void {
  let claimId = event.params.claimId
  let claim = LegacyClaim.load(claimId)
  if (claim != null) {
    claim.status = 'Minted'
    claim.save()
  }

  let eventId = event.transaction.hash.concat(claimId)
  let quarantineEvent = new LaceQuarantineEvent(eventId)
  quarantineEvent.claim = claimId
  quarantineEvent.eventType = 'Released'
  quarantineEvent.timestamp = event.block.timestamp
  quarantineEvent.blockNumber = event.block.number
  quarantineEvent.transactionHash = event.transaction.hash
  quarantineEvent.save()
}

export function handleClaimRejected(event: ClaimRejected): void {
  let claimId = event.params.claimId
  let claim = LegacyClaim.load(claimId)
  if (claim != null) {
    claim.status = 'Rejected'
    claim.save()
  }

  let eventId = event.transaction.hash.concat(claimId)
  let quarantineEvent = new LaceQuarantineEvent(eventId)
  quarantineEvent.claim = claimId
  quarantineEvent.eventType = 'Rejected'
  quarantineEvent.timestamp = event.block.timestamp
  quarantineEvent.blockNumber = event.block.number
  quarantineEvent.transactionHash = event.transaction.hash
  quarantineEvent.save()
}

export function handleClaimMinted(event: ClaimMinted): void {
  let claimId = event.params.claimId
  let claim = LegacyClaim.load(claimId)
  if (claim != null) {
    claim.status = 'Minted'
    claim.save()
  }

  // Update user reward metrics
  let user = getOrCreateUser(event.params.to)
  user.totalResurgeEarned = user.totalResurgeEarned.plus(event.params.amount)
  user.save()
}

export function handleCampaignUpdated(event: CampaignUpdated): void {
  let campaignIdStr = event.params.campaignId.toString()
  let campaign = LaceCampaign.load(campaignIdStr)
  if (campaign == null) {
    campaign = new LaceCampaign(campaignIdStr)
    campaign.rewardsMinted = BigInt.fromI32(0)
  }

  // Fetch details from contract
  let contract = LegacyClaimRegistry.bind(event.address)
  let campaignResult = contract.try_campaigns(event.params.campaignId)
  if (!campaignResult.reverted) {
    let val = campaignResult.value
    campaign.active = val.getActive()
    campaign.startTime = val.getStartTime()
    campaign.endTime = val.getEndTime()
    campaign.maxTotalRewards = val.getMaxTotalRewards()
    campaign.rewardsMinted = val.getRewardsMinted()
  } else {
    campaign.active = event.params.active
    campaign.startTime = BigInt.fromI32(0)
    campaign.endTime = BigInt.fromI32(0)
    campaign.maxTotalRewards = BigInt.fromI32(0)
  }

  campaign.updatedAt = event.block.timestamp
  campaign.updatedAtBlock = event.block.number
  campaign.updatedAtTx = event.transaction.hash
  campaign.save()
}

export function handlePolicyUpdated(event: PolicyUpdated): void {
  let sourceChainId = event.params.sourceChainId
  let policy = LacePolicy.load(sourceChainId)
  if (policy == null) {
    policy = new LacePolicy(sourceChainId)
  }

  let contract = LegacyClaimRegistry.bind(event.address)
  let policyResult = contract.try_claimPolicies(sourceChainId)
  if (!policyResult.reverted) {
    let val = policyResult.value
    policy.enabled = val.getEnabled()
    policy.transferToVaultEnabled = val.getTransferToVaultEnabled()
    policy.burnProofEnabled = val.getBurnProofEnabled()
    policy.lockProofEnabled = val.getLockProofEnabled()
    policy.signatureProofEnabled = val.getSignatureProofEnabled()
    policy.rpcEvidenceEnabled = val.getRpcEvidenceEnabled()
    policy.explorerEvidenceEnabled = val.getExplorerEvidenceEnabled()
    policy.zkProofEnabled = val.getZkProofEnabled()
    policy.minDormancySeconds = val.getMinDormancySeconds()
    policy.minHistoricalBalance = val.getMinHistoricalBalance()
    policy.maxRewardPerClaim = val.getMaxRewardPerClaim()
    policy.maxRewardPerEpoch = val.getMaxRewardPerEpoch()
    policy.minConfidenceTier = val.getMinConfidenceTier()
  } else {
    policy.enabled = event.params.enabled
    policy.transferToVaultEnabled = false
    policy.burnProofEnabled = false
    policy.lockProofEnabled = false
    policy.signatureProofEnabled = false
    policy.rpcEvidenceEnabled = false
    policy.explorerEvidenceEnabled = false
    policy.zkProofEnabled = false
    policy.minDormancySeconds = BigInt.fromI32(0)
    policy.minHistoricalBalance = BigInt.fromI32(0)
    policy.maxRewardPerClaim = BigInt.fromI32(0)
    policy.maxRewardPerEpoch = BigInt.fromI32(0)
    policy.minConfidenceTier = 0
  }

  policy.updatedAt = event.block.timestamp
  policy.updatedAtBlock = event.block.number
  policy.updatedAtTx = event.transaction.hash
  policy.save()
}

export function handleVaultAddressUpdated(event: VaultAddressUpdated): void {
  let sourceChainId = event.params.sourceChainId
  let vault = LaceVault.load(sourceChainId)
  if (vault == null) {
    vault = new LaceVault(sourceChainId)
  }
  vault.vaultAddress = event.params.vaultAddress
  vault.updatedAt = event.block.timestamp
  vault.updatedAtBlock = event.block.number
  vault.updatedAtTx = event.transaction.hash
  vault.save()
}

export function handleBurnAddressUpdated(event: BurnAddressUpdated): void {
  let sourceChainId = event.params.sourceChainId
  let burn = LaceBurnAddress.load(sourceChainId)
  if (burn == null) {
    burn = new LaceBurnAddress(sourceChainId)
  }
  burn.burnAddress = event.params.burnAddress
  burn.updatedAt = event.block.timestamp
  burn.updatedAtBlock = event.block.number
  burn.updatedAtTx = event.transaction.hash
  burn.save()
}
