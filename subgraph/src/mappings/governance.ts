import {
  ProposalCreated,
  ProposalExecuted,
  ProposalCanceled,
  ProposalQueued,
  VoteCast,
} from '../../generated/ResurgenceGovernance/ResurgenceGovernance'
import {
  GovernanceProposal,
  VoteReceipt,
  User,
  ProtocolMetrics,
} from '../../generated/schema'
import { Address, BigInt, Bytes, log } from '@graphprotocol/graph-ts'
import { ZERO_BI, ONE_BI, getProposalId, getVoteId } from '../utils'

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

function getOrCreateVoter(address: Address): User {
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

export function handleProposalCreated(event: ProposalCreated): void {
  let proposalId = event.params.proposalId
  let id = getProposalId(proposalId)

  let proposal = new GovernanceProposal(id)
  proposal.proposalId = proposalId
  proposal.proposer = event.params.proposer
  proposal.targets = changetype<Bytes[]>(event.params.targets)
  proposal.values = event.params.values
  proposal.signatures = event.params.signatures
  proposal.calldatas = changetype<Bytes[]>(event.params.calldatas)
  proposal.description = event.params.description
  proposal.startBlock = event.params.startBlock
  proposal.endBlock = event.params.endBlock
  proposal.forVotes = ZERO_BI
  proposal.againstVotes = ZERO_BI
  proposal.abstainVotes = ZERO_BI
  proposal.executed = false
  proposal.canceled = false
  proposal.queued = false
  proposal.eta = null
  proposal.createdAt = event.block.timestamp
  proposal.executedAt = null
  proposal.save()

  let metrics = getOrCreateMetrics()
  metrics.totalProposals = metrics.totalProposals.plus(ONE_BI)
  metrics.updatedAt = event.block.timestamp
  metrics.save()

  log.info('ProposalCreated: id={}, proposer={}', [
    proposalId.toString(),
    event.params.proposer.toHexString(),
  ])
}

export function handleProposalExecuted(event: ProposalExecuted): void {
  let proposalId = event.params.proposalId
  let id = getProposalId(proposalId)
  let proposal = GovernanceProposal.load(id)

  if (proposal != null) {
    proposal.executed = true
    proposal.executedAt = event.block.timestamp
    proposal.save()
  }
}

export function handleProposalCanceled(event: ProposalCanceled): void {
  let proposalId = event.params.proposalId
  let id = getProposalId(proposalId)
  let proposal = GovernanceProposal.load(id)

  if (proposal != null) {
    proposal.canceled = true
    proposal.save()
  }
}

export function handleProposalQueued(event: ProposalQueued): void {
  let proposalId = event.params.proposalId
  let id = getProposalId(proposalId)
  let proposal = GovernanceProposal.load(id)

  if (proposal != null) {
    proposal.queued = true
    proposal.save()
  }
}

export function handleVoteCast(event: VoteCast): void {
  let proposalId = event.params.proposalId
  let voterAddress = event.params.voter
  let support = event.params.support
  let weight = event.params.weight
  let reason = event.params.reason

  let proposalIdStr = getProposalId(proposalId)
  let voteId = getVoteId(proposalId, Bytes.fromHexString(voterAddress.toHexString()))

  let proposal = GovernanceProposal.load(proposalIdStr)
  if (proposal == null) {
    log.warning('handleVoteCast: proposal not found for {}', [proposalId.toString()])
    return
  }

  let voter = getOrCreateVoter(voterAddress)

  let receipt = new VoteReceipt(voteId)
  receipt.proposal = proposalIdStr
  receipt.voter = voter.id
  receipt.support = support // 0=Against, 1=For, 2=Abstain
  receipt.votes = weight
  receipt.reason = reason
  receipt.timestamp = event.block.timestamp
  receipt.blockNumber = event.block.number
  receipt.transactionHash = event.transaction.hash
  receipt.save()

  if (support == 0) {
    proposal.againstVotes = proposal.againstVotes.plus(weight)
  } else if (support == 1) {
    proposal.forVotes = proposal.forVotes.plus(weight)
  } else if (support == 2) {
    proposal.abstainVotes = proposal.abstainVotes.plus(weight)
  }
  proposal.save()
}
