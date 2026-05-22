import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-4xl font-bold mb-2">Documentation</h1>
      <p className="text-gray-400 mb-10">Everything you need to understand and use the Resurgence Protocol.</p>

      {/* Quick Nav */}
      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-10">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">On This Page</h2>
        <ul className="space-y-1 text-sm">
          {['What Is Resurgence?', 'How Staking Works', 'RESURGE Token', 'Governance', 'Tokenomics', 'Security', 'Deployment'].map(s => (
            <li key={s}>
              <a href={`#${s.toLowerCase().replace(/\s+/g, '-').replace(/[?]/g, '')}`} className="text-blue-400 hover:text-blue-300 transition-colors">
                {s}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <section id="what-is-resurgence" className="mb-12">
        <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">What Is Resurgence?</h2>
        <p className="text-gray-300 mb-3">
          Resurgence Protocol is a <strong>Proof-of-Dormancy</strong> staking system. It lets holders of abandoned
          ("dead") ERC-20 tokens stake them to earn <strong>RESURGE</strong>, the protocol's native governance and
          rewards token.
        </p>
        <p className="text-gray-300 mb-3">
          A "dead coin" is any ERC-20 token whose project has failed, been abandoned, or ceased activity — yet whose
          tokens still exist on-chain. By staking these tokens, holders can extract residual value from assets that
          would otherwise remain permanently idle.
        </p>
        <p className="text-gray-300">
          The protocol is governed by RESURGE holders through on-chain proposals and time-locked execution.
          No single team member retains privileged access post-launch.
        </p>
      </section>

      <section id="how-staking-works" className="mb-12">
        <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">How Staking Works</h2>
        <ol className="list-decimal list-inside space-y-3 text-gray-300">
          <li><strong>Browse pools</strong> — Each pool represents one supported dead coin. APR varies by reward rate and total staked.</li>
          <li><strong>Approve</strong> — Before staking, approve the pool contract to transfer your dead coin tokens.</li>
          <li><strong>Stake</strong> — Deposit dead coin tokens. Rewards begin accruing per-second immediately.</li>
          <li><strong>Earn</strong> — RESURGE rewards accumulate every second, proportional to your share of the pool.</li>
          <li><strong>Claim</strong> — Claim RESURGE rewards at any time with no lockup. Rewards are freshly minted.</li>
          <li><strong>Unstake</strong> — Withdraw your dead coin tokens at any time (no lockup on dead coin staking pools).</li>
        </ol>

        <h3 className="text-lg font-semibold mt-6 mb-2">Reward Formula</h3>
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 mb-3">
          earnedRewards = stakedAmount × (rewardPerToken − userRewardPerTokenPaid) / 1e18
        </div>
        <p className="text-gray-400 text-sm">
          Rewards accrue per-second using a rewardPerToken accumulator. This design avoids expensive on-chain loops.
        </p>

        <h3 className="text-lg font-semibold mt-6 mb-2">RESURGE Staking Pool</h3>
        <p className="text-gray-300">
          RESURGE itself can also be staked in the native RESURGE staking pool for boosted yield. Early unstake (before
          7 days) incurs a 5% penalty, which is burned. Voting power is retained while staked.
        </p>
      </section>

      <section id="resurge-token" className="mb-12">
        <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">RESURGE Token</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[
            ['Standard', 'ERC-20 (EIP-20)'],
            ['Max Supply', '1,000,000,000 RESURGE'],
            ['Minting', 'Controlled by RewardDistributor'],
            ['Governance', 'ERC20Votes (on-chain snapshots)'],
            ['Permits', 'ERC20Permit (gasless approvals)'],
            ['Upgradeability', 'UUPS Proxy'],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-sm text-white font-medium">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-gray-300">
          RESURGE is minted exclusively by the RewardDistributor contract when stakers claim rewards. No pre-mine
          or team allocation — all RESURGE enters circulation through staking activity.
        </p>
      </section>

      <section id="governance" className="mb-12">
        <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">Governance</h2>
        <p className="text-gray-300 mb-4">
          Resurgence Protocol uses OpenZeppelin Governor with a TimelockController. All protocol changes require
          a successful governance vote and a mandatory execution delay.
        </p>

        <h3 className="text-lg font-semibold mb-2">Governance Flow</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-300 mb-4">
          <li><strong>Propose</strong> — Requires ≥100,000 RESURGE voting power.</li>
          <li><strong>Vote</strong> — Voting period of ~7 days (50,400 blocks). Vote For, Against, or Abstain.</li>
          <li><strong>Quorum</strong> — 4% of total RESURGE supply must vote.</li>
          <li><strong>Queue</strong> — Successful proposals are queued in the Timelock.</li>
          <li><strong>Execute</strong> — After a 1-hour minimum delay, any address can execute.</li>
        </ol>

        <h3 className="text-lg font-semibold mb-2">What Governance Controls</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Adding and removing dead coin staking pools</li>
          <li>Setting reward rates per pool</li>
          <li>Adjusting the RewardDistributor's max mintable supply</li>
          <li>Upgrading core contracts via UUPS proxies</li>
          <li>Emergency pause / unpause of any pool</li>
        </ul>

        <h3 className="text-lg font-semibold mt-4 mb-2">Delegation</h3>
        <p className="text-gray-300">
          RESURGE voting power must be delegated before it can be used in votes. Delegate to yourself or to a trusted
          address using the <strong>Delegate</strong> button in the header. On-chain snapshots ensure votes reflect
          balances at the proposal's creation block.
        </p>
      </section>

      <section id="tokenomics" className="mb-12">
        <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">Tokenomics</h2>
        <p className="text-gray-300 mb-4">
          RESURGE has a hard cap of <strong>1 billion tokens</strong>. There is no pre-mine, no team allocation,
          and no investor allocation. 100% of supply enters circulation through staking rewards.
        </p>

        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Emission Model</h3>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li>Each staking pool has an independent <code className="bg-gray-700 px-1 rounded">rewardRatePerSecond</code> set by governance.</li>
            <li>Rates can be adjusted dynamically based on TVL and RESURGE price oracle data (Chainlink).</li>
            <li>The RewardDistributor enforces a global <code className="bg-gray-700 px-1 rounded">maxMintSupply</code> cap.</li>
            <li>Higher RESURGE price → higher emission multiplier (up to 2×), rewarding early adopters.</li>
          </ul>
        </div>

        <p className="text-gray-400 text-sm">
          Exact emission rates for initial pools will be set via governance vote before mainnet launch.
        </p>
      </section>

      <section id="security" className="mb-12">
        <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">Security</h2>
        <ul className="space-y-2 text-gray-300">
          <li>✅ <strong>ReentrancyGuard</strong> on all stake / unstake / claim functions</li>
          <li>✅ <strong>UUPS Proxy</strong> pattern for upgradeable contracts — upgrades require governance</li>
          <li>✅ <strong>TimelockController</strong> — all privileged actions delayed ≥1 hour</li>
          <li>✅ <strong>AccessControl</strong> — role-based permissions on all sensitive functions</li>
          <li>✅ <strong>Checks-Effects-Interactions</strong> pattern throughout</li>
          <li>✅ <strong>Oracle staleness checks</strong> — Chainlink price data validated before use</li>
          <li>✅ <strong>165 passing tests</strong> including fuzz / randomized invariant tests</li>
        </ul>

        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4 mt-4">
          <p className="text-yellow-300 text-sm">
            <strong>Audit Status:</strong> Pre-audit. Do not deposit significant value until a professional audit
            is complete. See <a href="https://github.com/kdsmith18542/Resurgence-Protocol" className="underline" target="_blank" rel="noopener noreferrer">GitHub</a> for the latest security checklist.
          </p>
        </div>
      </section>

      <section id="deployment" className="mb-12">
        <h2 className="text-2xl font-bold mb-4 border-b border-gray-700 pb-2">Deployment</h2>
        <p className="text-gray-300 mb-4">
          The protocol is designed for Polygon mainnet (primary) with L2 support for Arbitrum and Optimism.
        </p>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Contract Addresses</h3>
          <p className="text-gray-400 text-sm">Mainnet addresses will be published here after deployment and verification on Polygonscan.</p>
        </div>

        <h3 className="text-lg font-semibold mt-6 mb-2">Resources</h3>
        <ul className="space-y-1 text-sm">
          <li>
            <a href="https://github.com/kdsmith18542/Resurgence-Protocol" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">
              GitHub Repository
            </a>
          </li>
          <li>
            <Link href="/governance" className="text-blue-400 hover:text-blue-300">
              Governance Portal
            </Link>
          </li>
          <li>
            <Link href="/analytics" className="text-blue-400 hover:text-blue-300">
              Protocol Analytics
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
