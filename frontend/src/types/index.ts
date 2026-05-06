export interface PoolInfo {
  address: string;
  deadCoinAddress: string;
  deadCoinName: string;
  deadCoinSymbol: string;
  stakedAmount: bigint;
  totalStaked: bigint;
  rewardRate: bigint;
  userRewards: bigint;
  tvl: number;
  apr: number;
}

export interface ProposalInfo {
  id: string;
  description: string;
  state: number;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  startBlock: bigint;
  endBlock: bigint;
  proposer: string;
}

export interface DelegationInfo {
  delegatee: string;
  currentVotes: bigint;
  pastVotes: bigint;
}

export interface UserPosition {
  totalStaked: bigint;
  totalRewards: bigint;
  votingPower: bigint;
  delegatedTo: string;
}

export enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed,
}

export interface TransactionState {
  status: 'idle' | 'pending' | 'confirming' | 'success' | 'error';
  hash?: string;
  error?: string;
}
