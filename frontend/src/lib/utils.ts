export function truncateAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  const value = Number(amount) / 10 ** decimals;
  if (value === 0) return '0';
  if (value < 0.0001) return '<0.0001';
  if (value < 1) return value.toFixed(4);
  if (value < 1000) return value.toFixed(2);
  if (value < 1000000) return `${(value / 1000).toFixed(2)}K`;
  if (value < 1000000000) return `${(value / 1000000).toFixed(2)}M`;
  return `${(value / 1000000000).toFixed(2)}B`;
}

export function formatUSD(value: number): string {
  if (value === 0) return '$0.00';
  if (value < 0.01) return '<$0.01';
  return `$${value.toFixed(2)}`;
}

export function formatAPR(ratePerSecond: bigint, totalStaked: bigint): number {
  if (totalStaked === 0n) return 0;
  const rewardsPerYear = Number(ratePerSecond) * 365 * 24 * 60 * 60;
  const staked = Number(totalStaked);
  if (staked === 0) return 0;
  return (rewardsPerYear / staked) * 100;
}

export function shortenProposalId(id: string): string {
  return `${id.slice(0, 10)}...${id.slice(-6)}`;
}

export function proposalStateLabel(state: number): string {
  const labels = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed'];
  return labels[state] || 'Unknown';
}
