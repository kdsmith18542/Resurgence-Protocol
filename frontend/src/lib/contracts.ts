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
    ResurgeToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    RewardDistributor: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    StakingPoolManager: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    ResurgenceGovernance: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    ResurgenceTimelockController: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
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
