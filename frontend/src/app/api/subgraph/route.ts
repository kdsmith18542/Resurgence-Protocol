import { NextRequest, NextResponse } from 'next/server';

// Match the deterministic Hardhat deployment addresses
const CONTRACTS = {
  ResurgeToken: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  TimelockController: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  RewardDistributor: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  DeadCoinStakingPoolImpl: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
  StakingPoolManager: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
  ResurgeStakingPool: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
  ResurgenceGovernance: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
};

const MOCK_POOL_ID = '0xdead0000000000000000000000000000000001';

const MOCK_POOLS = [
  {
    id: MOCK_POOL_ID,
    deadCoinToken: '0xdead0000000000000000000000000000000001',
    poolAddress: CONTRACTS.StakingPoolManager,
    rewardRatePerSecond: '1000000000000000000',
    totalStaked: '50000000000000000000000',
    paused: false,
    createdAt: '1000000',
    stakerCount: '3',
  },
  {
    id: CONTRACTS.ResurgeStakingPool,
    deadCoinToken: CONTRACTS.ResurgeToken,
    poolAddress: CONTRACTS.ResurgeStakingPool,
    rewardRatePerSecond: '1000000000000000000',
    totalStaked: '100000000000000000000000',
    paused: false,
    createdAt: '1000001',
    stakerCount: '5',
  },
];

const MOCK_PROPOSALS = [
  {
    id: '1',
    proposalId: '1',
    proposer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    description: 'Add Dead Doge (DDOGE) staking pool',
    targets: [CONTRACTS.StakingPoolManager],
    values: ['0'],
    signatures: [''],
    calldatas: ['0x'],
    startBlock: '1',
    endBlock: '50401',
    forVotes: '750000000000000000000000',
    againstVotes: '250000000000000000000000',
    abstainVotes: '50000000000000000000000',
    executed: true,
    canceled: false,
    queued: true,
    eta: null,
    createdAt: '1000000',
    receipts: [
      { id: '1-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', voter: { id: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' }, support: 1, votes: '500000000000000000000000', reason: 'Great idea!', timestamp: '1001000' },
      { id: '1-0x70997970C51812dc3A010C7d01b50e0d17dc79C8', voter: { id: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' }, support: 0, votes: '250000000000000000000000', reason: 'Need more info', timestamp: '1002000' },
    ],
  },
  {
    id: '2',
    proposalId: '2',
    proposer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    description: 'Increase reward rate for ZOMB pool',
    targets: [CONTRACTS.StakingPoolManager],
    values: ['0'],
    signatures: [''],
    calldatas: ['0x'],
    startBlock: '50402',
    endBlock: '100802',
    forVotes: '0',
    againstVotes: '0',
    abstainVotes: '0',
    executed: false,
    canceled: false,
    queued: false,
    eta: null,
    createdAt: '1000002',
    receipts: [],
  },
];

function makeUser(id: string) {
  return {
    id: id.toLowerCase(),
    stakedBalance: '25000000000000000000000',
    totalResurgeEarned: '500000000000000000000',
    rewardsClaimed: '100000000000000000000',
    stakingPositions: MOCK_POOLS.map(p => ({
      stakedAmount: '15000000000000000000000',
      unclaimedRewards: '250000000000000000000',
      pool: { id: p.id, poolAddress: p.poolAddress, deadCoinToken: p.deadCoinToken },
    })),
  };
}

function parseQuery(body: string): string {
  // Simple heuristic: find the first top-level field name
  const match = body.match(/\b(\w+)\s*\(/);
  if (match) return match[1];
  const singleMatch = body.match(/(\w+)\s*\{/);
  if (singleMatch) return singleMatch[1];
  return 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const queryName = parseQuery(body);

    if (body.includes('protocolMetrics')) {
      return NextResponse.json({
        data: {
          protocolMetrics: {
            id: 'protocol-metrics',
            totalValueLocked: '150000000000000000000000',
            totalPools: MOCK_POOLS.length.toString(),
            totalStakers: '8',
            totalProposals: MOCK_PROPOSALS.length.toString(),
          },
        },
      });
    }

    if (body.includes('resurgeToken(') || (body.includes('resurgeToken') && body.includes('totalSupply'))) {
      return NextResponse.json({
        data: {
          resurgeToken: {
            id: 'resurge-token',
            totalSupply: '500000000000000000000000000',
            totalStakedAllPools: '150000000000000000000000',
            totalRewardsDistributed: '50000000000000000000000',
          },
        },
      });
    }

    if (body.includes('stakingPools(') || (body.includes('stakingPools') && !body.includes('position'))) {
      return NextResponse.json({
        data: { stakingPools: MOCK_POOLS },
      });
    }

    if (body.includes('stakingPositions(')) {
      const userMatch = body.match(/user:\s*"([^"]+)"/i);
      const user = userMatch ? userMatch[1].toLowerCase() : '0x0000000000000000000000000000000000000000';
      return NextResponse.json({
        data: {
          stakingPositions: MOCK_POOLS.map(p => ({
            pool: { id: p.id },
            stakedAmount: p.totalStaked,
            unclaimedRewards: '500000000000000000000',
            user: user,
          })),
        },
      });
    }

    if (body.includes('stakingPosition(')) {
      return NextResponse.json({
        data: {
          stakingPosition: {
            id: '0x0000000000000000000000000000000000000000' + MOCK_POOL_ID,
            stakedAmount: '15000000000000000000000',
            unclaimedRewards: '250000000000000000000',
            pool: { id: MOCK_POOL_ID },
          },
        },
      });
    }

    if (body.includes('stakingEvents(')) {
      const userMatch = body.match(/user:\s*"([^"]+)"/i);
      const user = userMatch ? userMatch[1].toLowerCase() : '0x0000000000000000000000000000000000000000';
      return NextResponse.json({
        data: {
          stakingEvents: [
            { id: 'evt-1', type: 'Stake', amount: '5000000000000000000000', timestamp: '1000000', transactionHash: '0xabc', pool: { id: MOCK_POOL_ID, deadCoinToken: '0xdead0000000000000000000000000000000001', poolAddress: MOCK_POOLS[0].poolAddress }, user },
            { id: 'evt-2', type: 'ClaimRewards', amount: '100000000000000000000', timestamp: '1000001', transactionHash: '0xdef', pool: { id: MOCK_POOL_ID, deadCoinToken: '0xdead0000000000000000000000000000000001', poolAddress: MOCK_POOLS[0].poolAddress }, user },
          ],
        },
      });
    }

    if (body.includes('governanceProposals(') || (body.includes('governanceProposals') && body.includes('id'))) {
      return NextResponse.json({
        data: { governanceProposals: MOCK_PROPOSALS },
      });
    }

    if (body.includes('governanceProposal(')) {
      const idMatch = body.match(/governanceProposal\s*\([^)]*id:\s*"([^"]+)"/);
      const id = idMatch ? idMatch[1] : '1';
      const proposal = MOCK_PROPOSALS.find(p => p.id === id) || MOCK_PROPOSALS[0];
      return NextResponse.json({
        data: { governanceProposal: proposal },
      });
    }

    if (body.includes('voteReceipts(')) {
      return NextResponse.json({
        data: {
          voteReceipts: MOCK_PROPOSALS.flatMap(p => p.receipts.map(r => ({
            ...r,
            proposal: { id: p.id, proposalId: p.proposalId, description: p.description },
          }))),
        },
      });
    }

    if (body.includes('rewardClaimEvents(')) {
      return NextResponse.json({
        data: {
          rewardClaimEvents: [
            { id: 'claim-1', amount: '100000000000000000000', timestamp: '1001000', transactionHash: '0x123', pool: { id: MOCK_POOL_ID, deadCoinToken: '0xdead0000000000000000000000000000000001' } },
          ],
        },
      });
    }

    if (body.includes('users(')) {
      return NextResponse.json({
        data: {
          users: [
            { id: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', stakedBalance: '50000000000000000000000', totalResurgeEarned: '1000000000000000000000', rewardsClaimed: '200000000000000000000' },
            { id: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', stakedBalance: '25000000000000000000000', totalResurgeEarned: '500000000000000000000', rewardsClaimed: '100000000000000000000' },
          ],
        },
      });
    }

    if (body.includes('user(') || body.includes('user (')) {
      const userMatch = body.match(/user\s*\([^)]*id:\s*"([^"]+)"/);
      const user = userMatch ? userMatch[1] : '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      return NextResponse.json({
        data: { user: makeUser(user) },
      });
    }

    return NextResponse.json({ data: null });
  } catch (err) {
    console.error('Subgraph simulator error:', err);
    return NextResponse.json({ data: null, errors: [{ message: 'Internal server error' }] });
  }
}
