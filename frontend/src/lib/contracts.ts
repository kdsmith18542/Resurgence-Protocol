export const CONTRACTS: Record<number, {
  ResurgeToken: string;
  RewardDistributor: string;
  StakingPoolManager: string;
  ResurgenceGovernance: string;
  ResurgenceTimelockController: string;
}> = {
  137: {
    ResurgeToken: process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '',
    RewardDistributor: process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '',
    StakingPoolManager: process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '',
  },
  80001: {
    ResurgeToken: process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '',
    RewardDistributor: process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '',
    StakingPoolManager: process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '',
  },
  31337: {
    ResurgeToken: process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    RewardDistributor: process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    StakingPoolManager: process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  },
  42161: {
    ResurgeToken: process.env.NEXT_PUBLIC_ARBITRUM_RESURGE_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '',
    RewardDistributor: process.env.NEXT_PUBLIC_ARBITRUM_REWARD_DISTRIBUTOR_ADDRESS || process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '',
    StakingPoolManager: process.env.NEXT_PUBLIC_ARBITRUM_STAKING_POOL_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_ARBITRUM_GOVERNANCE_ADDRESS || process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_ARBITRUM_TIMELOCK_ADDRESS || process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '',
  },
  10: {
    ResurgeToken: process.env.NEXT_PUBLIC_OPTIMISM_RESURGE_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '',
    RewardDistributor: process.env.NEXT_PUBLIC_OPTIMISM_REWARD_DISTRIBUTOR_ADDRESS || process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '',
    StakingPoolManager: process.env.NEXT_PUBLIC_OPTIMISM_STAKING_POOL_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_OPTIMISM_GOVERNANCE_ADDRESS || process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_OPTIMISM_TIMELOCK_ADDRESS || process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '',
  },
};

export function getContractAddress(chainId: number, name: keyof typeof CONTRACTS[137]): string {
  return CONTRACTS[chainId]?.[name] || '';
}

export const SUPPORTED_CHAINS = [1, 137, 80001, 31337] as const;

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  10: 'Optimism',
  137: 'Polygon Mainnet',
  42161: 'Arbitrum One',
  80001: 'Mumbai Testnet',
  31337: 'Hardhat Local',
};
