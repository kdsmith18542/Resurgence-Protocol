export const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

interface SubgraphResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function query<T>(queryString: string): Promise<T | null> {
  if (!SUBGRAPH_URL) return null;
  try {
    const res = await fetch(SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryString }),
    });
    const json: SubgraphResponse<T> = await res.json();
    if (json.errors) {
      console.error('Subgraph errors:', json.errors);
      return null;
    }
    return json.data || null;
  } catch (err) {
    console.error('Subgraph fetch error:', err);
    return null;
  }
}

export async function fetchProtocolMetrics(): Promise<{
  totalValueLocked: string;
  totalPools: string;
  totalStakers: string;
  totalProposals: string;
} | null> {
  return query(`
    {
      protocolMetrics(id: "protocol-metrics") {
        totalValueLocked
        totalPools
        totalStakers
        totalProposals
      }
    }
  `).then((d: any) => d?.protocolMetrics || null);
}

export async function fetchResurgeToken(): Promise<{
  totalSupply: string;
  totalStakedAllPools: string;
  totalRewardsDistributed: string;
} | null> {
  return query(`
    {
      resurgeToken(id: "resurge-token") {
        totalSupply
        totalStakedAllPools
        totalRewardsDistributed
      }
    }
  `).then((d: any) => d?.resurgeToken || null);
}

export interface SubgraphPool {
  id: string;
  deadCoinToken: string;
  poolAddress: string;
  rewardRatePerSecond: string;
  totalStaked: string;
  paused: boolean;
  createdAt: string;
  stakerCount: string;
}

export interface SubgraphPoolWithPosition extends SubgraphPool {
  position?: {
    stakedAmount: string;
    unclaimedRewards: string;
  };
}

export async function fetchPools(): Promise<SubgraphPool[]> {
  return query(`
    {
      stakingPools(first: 100, orderBy: createdAt, orderDirection: desc) {
        id
        deadCoinToken
        poolAddress
        rewardRatePerSecond
        totalStaked
        paused
        createdAt
        stakerCount
      }
    }
  `).then((d: any) => d?.stakingPools || []);
}

export async function fetchPoolsWithUserPosition(userAddress: string): Promise<SubgraphPoolWithPosition[]> {
  return query(`
    {
      stakingPools(first: 100, orderBy: createdAt, orderDirection: desc) {
        id
        deadCoinToken
        poolAddress
        rewardRatePerSecond
        totalStaked
        paused
        createdAt
        stakerCount
      }
    }
  `).then(async (d: any) => {
    const pools: SubgraphPoolWithPosition[] = d?.stakingPools || [];
    if (userAddress && pools.length > 0) {
      const poolIds = pools.map((p: any) => `"${p.id}"`).join(',');
      const posData = await query(`
        {
          stakingPositions(where: { user: "${userAddress.toLowerCase()}", pool_in: [${poolIds}] }) {
            pool { id }
            stakedAmount
            unclaimedRewards
          }
        }
      `);
      const positions: any[] = posData?.stakingPositions || [];
      const posMap = new Map(positions.map((p: any) => [p.pool.id, p]));
      pools.forEach((pool: SubgraphPoolWithPosition) => {
        pool.position = posMap.get(pool.id);
      });
    }
    return pools;
  });
}

export async function fetchUserPosition(
  userAddress: string,
  poolAddress: string
): Promise<{
  id: string;
  stakedAmount: string;
  unclaimedRewards: string;
} | null> {
  const lowerUser = userAddress.toLowerCase();
  const lowerPool = poolAddress.toLowerCase();
  return query(`
    {
      stakingPosition(id: "${lowerUser}0x${lowerPool.slice(2)}") {
        id
        stakedAmount
        unclaimedRewards
        pool { id }
      }
    }
  `).then((d: any) => d?.stakingPosition || null);
}

export async function fetchUserStakingHistory(userAddress: string, first: number = 20): Promise<any[]> {
  return query(`
    {
      stakingEvents(
        first: ${first},
        orderBy: timestamp,
        orderDirection: desc,
        where: { user: "${userAddress.toLowerCase()}" }
      ) {
        id
        type
        amount
        timestamp
        transactionHash
        pool { id deadCoinToken poolAddress }
      }
    }
  `).then((d: any) => d?.stakingEvents || []);
}

export interface SubgraphProposal {
  id: string;
  proposalId: string;
  proposer: string;
  description: string;
  startBlock: string;
  endBlock: string;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  executed: boolean;
  canceled: boolean;
  queued: boolean;
  eta: string | null;
  createdAt: string;
}

export async function fetchProposals(): Promise<SubgraphProposal[]> {
  return query(`
    {
      governanceProposals(
        first: 50,
        orderBy: createdAt,
        orderDirection: desc
      ) {
        id
        proposalId
        proposer
        description
        startBlock
        endBlock
        forVotes
        againstVotes
        abstainVotes
        executed
        canceled
        queued
        eta
        createdAt
      }
    }
  `).then((d: any) => d?.governanceProposals || []);
}

export async function fetchProposal(proposalId: string): Promise<SubgraphProposal | null> {
  return query(`
    {
      governanceProposal(id: "${proposalId}") {
        id
        proposalId
        proposer
        description
        targets
        values
        signatures
        calldatas
        startBlock
        endBlock
        forVotes
        againstVotes
        abstainVotes
        executed
        canceled
        queued
        eta
        createdAt
        receipts {
          id
          voter { id }
          support
          votes
          reason
          timestamp
        }
      }
    }
  `).then((d: any) => d?.governanceProposal || null);
}

export async function fetchUserVotes(userAddress: string): Promise<any[]> {
  return query(`
    {
      voteReceipts(
        first: 20,
        orderBy: timestamp,
        orderDirection: desc,
        where: { voter: "${userAddress.toLowerCase()}" }
      ) {
        id
        support
        votes
        reason
        timestamp
        proposal {
          id
          proposalId
          description
        }
      }
    }
  `).then((d: any) => d?.voteReceipts || []);
}

export async function fetchUserRewardClaims(userAddress: string, first: number = 20): Promise<any[]> {
  return query(`
    {
      rewardClaimEvents(
        first: ${first},
        orderBy: timestamp,
        orderDirection: desc,
        where: { user: "${userAddress.toLowerCase()}" }
      ) {
        id
        amount
        timestamp
        transactionHash
        pool { id deadCoinToken }
      }
    }
  `).then((d: any) => d?.rewardClaimEvents || []);
}

export async function fetchAllUsers(first: number = 100): Promise<any[]> {
  return query(`
    {
      users(first: ${first}, orderBy: stakedBalance, orderDirection: desc) {
        id
        stakedBalance
        totalResurgeEarned
        rewardsClaimed
      }
    }
  `).then((d: any) => d?.users || []);
}

export async function fetchUser(userAddress: string): Promise<{
  id: string;
  stakedBalance: string;
  totalResurgeEarned: string;
  rewardsClaimed: string;
  stakingPositions?: Array<{
    stakedAmount: string;
    unclaimedRewards: string;
    pool: { id: string; poolAddress: string; deadCoinToken: string };
  }>;
} | null> {
  return query(`
    {
      user(id: "${userAddress.toLowerCase()}") {
        id
        stakedBalance
        totalResurgeEarned
        rewardsClaimed
        stakingPositions {
          stakedAmount
          unclaimedRewards
          pool {
            id
            poolAddress
            deadCoinToken
          }
        }
      }
    }
  `).then((d: any) => d?.user || null);
}
