export const CONTRACTS: Record<number, {
  ResurgeToken: string;
  RewardDistributor: string;
  StakingPoolManager: string;
  ResurgenceGovernance: string;
  ResurgenceTimelockController: string;
  CrossChainSender: string;
  CrossChainReceiver: string;
}> = {
  137: {
    ResurgeToken: process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '',
    RewardDistributor: process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '',
    StakingPoolManager: process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '',
    CrossChainSender: process.env.NEXT_PUBLIC_POLYGON_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
  80002: {
    ResurgeToken: process.env.NEXT_PUBLIC_AMOY_RESURGE_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '',
    RewardDistributor: process.env.NEXT_PUBLIC_AMOY_REWARD_DISTRIBUTOR_ADDRESS || process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '',
    StakingPoolManager: process.env.NEXT_PUBLIC_AMOY_STAKING_POOL_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_AMOY_GOVERNANCE_ADDRESS || process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_AMOY_TIMELOCK_ADDRESS || process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '',
    CrossChainSender: process.env.NEXT_PUBLIC_AMOY_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
  31337: {
    ResurgeToken: process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    RewardDistributor: process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    StakingPoolManager: process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    CrossChainSender: '',
    CrossChainReceiver: '',
  },
  42161: {
    ResurgeToken: process.env.NEXT_PUBLIC_ARBITRUM_RESURGE_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '',
    RewardDistributor: process.env.NEXT_PUBLIC_ARBITRUM_REWARD_DISTRIBUTOR_ADDRESS || process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '',
    StakingPoolManager: process.env.NEXT_PUBLIC_ARBITRUM_STAKING_POOL_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_ARBITRUM_GOVERNANCE_ADDRESS || process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_ARBITRUM_TIMELOCK_ADDRESS || process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '',
    CrossChainSender: '',
    CrossChainReceiver: process.env.NEXT_PUBLIC_ARBITRUM_CROSS_CHAIN_RECEIVER_ADDRESS || '',
  },
  421614: {
    ResurgeToken: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RESURGE_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '',
    RewardDistributor: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_REWARD_DISTRIBUTOR_ADDRESS || process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '',
    StakingPoolManager: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_STAKING_POOL_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_GOVERNANCE_ADDRESS || process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_TIMELOCK_ADDRESS || process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '',
    CrossChainSender: '',
    CrossChainReceiver: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_CROSS_CHAIN_RECEIVER_ADDRESS || '',
  },
  10: {
    ResurgeToken: process.env.NEXT_PUBLIC_OPTIMISM_RESURGE_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS || '',
    RewardDistributor: process.env.NEXT_PUBLIC_OPTIMISM_REWARD_DISTRIBUTOR_ADDRESS || process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS || '',
    StakingPoolManager: process.env.NEXT_PUBLIC_OPTIMISM_STAKING_POOL_MANAGER_ADDRESS || process.env.NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: process.env.NEXT_PUBLIC_OPTIMISM_GOVERNANCE_ADDRESS || process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '',
    ResurgenceTimelockController: process.env.NEXT_PUBLIC_OPTIMISM_TIMELOCK_ADDRESS || process.env.NEXT_PUBLIC_TIMELOCK_ADDRESS || '',
    CrossChainSender: process.env.NEXT_PUBLIC_OPTIMISM_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
  // Tier 1 spoke chains (StakingPoolManager + CrossChainSender; hub contracts empty)
  56: {
    ResurgeToken: '',
    RewardDistributor: '',
    StakingPoolManager: process.env.NEXT_PUBLIC_BSC_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: '',
    ResurgenceTimelockController: '',
    CrossChainSender: process.env.NEXT_PUBLIC_BSC_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
  97: {
    ResurgeToken: '',
    RewardDistributor: '',
    StakingPoolManager: process.env.NEXT_PUBLIC_BSC_TESTNET_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: '',
    ResurgenceTimelockController: '',
    CrossChainSender: process.env.NEXT_PUBLIC_BSC_TESTNET_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
  8453: {
    ResurgeToken: '',
    RewardDistributor: '',
    StakingPoolManager: process.env.NEXT_PUBLIC_BASE_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: '',
    ResurgenceTimelockController: '',
    CrossChainSender: process.env.NEXT_PUBLIC_BASE_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
  84532: {
    ResurgeToken: '',
    RewardDistributor: '',
    StakingPoolManager: process.env.NEXT_PUBLIC_BASE_SEPOLIA_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: '',
    ResurgenceTimelockController: '',
    CrossChainSender: process.env.NEXT_PUBLIC_BASE_SEPOLIA_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
  // Tier 2 spoke chains
  1: {
    ResurgeToken: '',
    RewardDistributor: '',
    StakingPoolManager: process.env.NEXT_PUBLIC_ETHEREUM_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: '',
    ResurgenceTimelockController: '',
    CrossChainSender: process.env.NEXT_PUBLIC_ETHEREUM_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
  11155111: {
    ResurgeToken: '',
    RewardDistributor: '',
    StakingPoolManager: process.env.NEXT_PUBLIC_SEPOLIA_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: '',
    ResurgenceTimelockController: '',
    CrossChainSender: process.env.NEXT_PUBLIC_SEPOLIA_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
  43114: {
    ResurgeToken: '',
    RewardDistributor: '',
    StakingPoolManager: process.env.NEXT_PUBLIC_AVALANCHE_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: '',
    ResurgenceTimelockController: '',
    CrossChainSender: process.env.NEXT_PUBLIC_AVALANCHE_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
  43113: {
    ResurgeToken: '',
    RewardDistributor: '',
    StakingPoolManager: process.env.NEXT_PUBLIC_AVALANCHE_FUJI_STAKING_POOL_MANAGER_ADDRESS || '',
    ResurgenceGovernance: '',
    ResurgenceTimelockController: '',
    CrossChainSender: process.env.NEXT_PUBLIC_AVALANCHE_FUJI_CROSS_CHAIN_SENDER_ADDRESS || '',
    CrossChainReceiver: '',
  },
};

export function getContractAddress(chainId: number, name: keyof typeof CONTRACTS[137]): string {
  return CONTRACTS[chainId]?.[name] || '';
}

export function isSpokeChain(chainId: number): boolean {
  const c = CONTRACTS[chainId];
  return !!c && !c.RewardDistributor && !!c.StakingPoolManager;
}

export function isHubChain(chainId: number): boolean {
  const c = CONTRACTS[chainId];
  return !!c && !!c.RewardDistributor;
}

export const SUPPORTED_CHAINS = [
  1, 11155111,        // Ethereum Mainnet, Sepolia
  10, 11155420,       // Optimism, Optimism Sepolia
  56, 97,             // BSC Mainnet, BSC Testnet
  137, 80002,         // Polygon, Amoy
  8453, 84532,        // Base, Base Sepolia
  42161, 421614,      // Arbitrum, Arbitrum Sepolia (hub)
  43114, 43113,       // Avalanche, Fuji
  31337,              // Hardhat Local
] as const;

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  11155111: 'Sepolia',
  10: 'Optimism',
  11155420: 'Optimism Sepolia',
  56: 'BNB Chain',
  97: 'BSC Testnet',
  137: 'Polygon',
  80002: 'Amoy Testnet',
  8453: 'Base',
  84532: 'Base Sepolia',
  42161: 'Arbitrum One',
  421614: 'Arbitrum Sepolia',
  43114: 'Avalanche C-Chain',
  43113: 'Avalanche Fuji',
  31337: 'Hardhat Local',
};
