### Resurgence Protocol TO-DO List

**I. Smart Contract Architecture & Specifications**

*   **A. Core Contracts Development:**
    *   **1. `ResurgeToken.sol` (RESURGE ERC-20 Token):**
    *   [x] Implement ERC-20 standard.
    *   [x] Inherit `ERC20`, `ERC20Burnable`, `AccessControl` from OpenZeppelin.
    *   [x] Set name "Resurgence Protocol" and symbol "RESURGE" in constructor.
    *   [x] Define `MAX_SUPPLY`, `MINTER_ROLE_GRANTER`, `PAUSER_ROLE_GRANTER` state variables.
    *   [x] Assign `MINTER_ROLE` to `RewardDistributor` and Governance initially.
    *   [x] Assign `PAUSER_ROLE` to Governance for emergency.
    *   [x] Implement standard ERC-20 functions (`transfer`, `approve`, `transferFrom`, `balanceOf`, `totalSupply`).
    *   [x] Implement standard ERC-20 events (`Transfer`, `Approval`).
    *   [x] Implement `RoleGranted` and `RoleRevoked` events.
    *   [x] Implement `mint(address to, uint256 amount)` with `MINTER_ROLE` permission and supply check.
    *   [x] Implement `grantRole(bytes32 role, address account)` and `revokeRole(bytes32 role, address account)`.
    *   **2. `StakingPoolManager.sol`:**
    *   [x] Implement central registry and controller for `DeadCoinStakingPool` instances.
    *   [x] Inherit `AccessControl` (or similar for governance control).
    *   [x] Define state variables: `address public immutable RESURGE`, `address public immutable STAKING_POOL_IMPLEMENTATION`, `mapping(address => address) public deadCoinToStakingPool`, `address[] public supportedDeadCoins`.
    *   [x] Implement `addStakingPool` (deploys new pool, registers it, sets initial reward rate).
    *   [x] Implement `setRewardRate`.
    *   [x] Implement `pauseStakingPool` (emergency feature).
    *   [x] Implement `unpauseStakingPool`.
    *   [x] Implement `removeStakingPool` (handle implications for staked funds).
    *   [x] Implement events: `StakingPoolAdded`, `RewardRateUpdated`, `StakingPoolPaused`, `StakingPoolUnpaused`.
    *   **3. `DeadCoinStakingPool.sol`:**
    *   [x] Implement staking and reward distribution for a single "dead coin."
    *   [x] Inherit `ReentrancyGuard`, `Initializable` from OpenZeppelin.
    *   [x] Define `initialize(address _deadCoinToken, address _resurgeToken)` function as the proxy initializer.
    *   [x] Define state variables: `IERC20 public immutable deadCoinToken`, `IERC20 public immutable resurgeToken`, `uint256 public rewardRatePerSecond`, `uint256 public lastUpdateTime`, `uint256 public rewardPerTokenStored`, `mapping(address => uint256) public userStakedBalance`, `mapping(address => uint256) public userRewardPerTokenPaid`, `mapping(address => uint256) public userUnclaimedRewards`.
    *   [x] Implement `_updateReward()` internal helper function.
    *   [x] Implement `_earned(address account)` internal view helper function.
    *   [x] Implement `stake(uint256 amount)` with `nonReentrant` modifier.
    *   [x] Implement `unstake(uint256 amount)` with `nonReentrant` modifier.
    *   [x] Implement `claimRewards()` with `nonReentrant` modifier.
    *   [x] Implement `setRewardRate(uint256 _newRate)` (callable by StakingPoolManager or Governance) with access control.
    *   [x] Implement `totalStaked()` public view function.
    *   [x] Implement events: `Staked`, `Unstaked`, `RewardsClaimed`, `RewardRateUpdated`.
    *   **4. `RewardDistributor.sol`:**
    *   [x] Manage controlled release of RESURGE tokens to staking pools and handle minting.
    *   [x] Inherit `AccessControl` (transfer ownership to Governance post-deployment).
    *   [x] Define state variables: `ResurgeToken public resurgenceToken`, `uint256 public totalResurgeMinted`, `uint256 public MAX_MINT_SUPPLY`.
    *   [x] Implement `mintAndDistribute(address _to, uint256 _amount)`.
    *   [x] Implement `setMaxMintSupply(uint256 _newMaxSupply)`.
    *   [x] Implement `transferOwnershipOfToken()`.
    *   [x] Implement events: `TokensMintedAndDistributed`, `MaxMintSupplyUpdated`.
    *   **5. `ResurgenceGovernance.sol`:**
    *   [x] Implement central governance contract for the protocol.
    *   [x] Use OpenZeppelin's Governor (e.g., `GovernorComp` or `GovernorVotes`) with `TimelockController`.
    *   [x] Inherit `Governor`, `GovernorSettings`, `GovernorCountingSimple`, `GovernorVotes`, `GovernorTimelockControl`.
    *   [x] Set constructor parameters (voting delay, voting period, quorum, timelock address).
    *   [x] Implement standard governor functions (proposing, voting, executing proposals).
    *   **6. `TimelockController.sol`:**
        *   [x] Implement delay for executing governance-approved proposals.
        *   [x] Inherit `TimelockController` from OpenZeppelin.
        *   [x] Configure minimum delay, proposers, and executors.

*   **B. Deployment Flow (Simplified):**
    *   Deploy `ResurgeToken.sol`.
    *   [x] Deploy `TimelockController.sol`.
    *   [x] Deploy `ResurgenceGovernance.sol` (linking to `ResurgeToken` and `TimelockController`).
    *   [x] Deploy `RewardDistributor.sol` (linking to `ResurgeToken`, set initial `maxMintSupply`).
    *   [x] Deploy `StakingPoolManager.sol` (linking to `ResurgeToken` and `RewardDistributor`).
    *   [x] Transfer ownership of `ResurgeToken`'s `minter` role to `RewardDistributor`.
    *   [x] Transfer ownership of `StakingPoolManager` and `RewardDistributor` to `ResurgenceGovernance` via a governance proposal (multi-sig or initial dev account proposal).
    *   [x] Governance proposes and votes to add the first set of `DeadCoinStakingPool` instances using `StakingPoolManager`.
    *   [x] Initial RESURGE liquidity provision on DEX.

**II. Off-Chain Infrastructure & Frontend**

*   **A. The Graph Subgraph:**
    *   Define entities: `User`, `StakingPool`, `StakingEvent`, `RewardClaimEvent`, `GovernanceProposal`.
    *   Identify data sources: `ResurgeToken`, `StakingPoolManager`, all deployed `DeadCoinStakingPool` contracts.
    *   Write AssemblyScript mapping handlers to process events and update entities.
*   **B. Frontend (dApp) Development:**
    *   **1. Setup:**
        *   [x] Choose Frontend framework: React / Next.js.
        *   [x] Choose Web3 Library: Ethers.js or Web3.js.
        *   [x] Choose State Management: Zustand, Jotai, or React Context.
        *   [x] Choose Styling framework: Tailwind CSS or Material-UI.
        *   [x] Set up IPFS/Arweave for decentralized hosting.
        *   [x] Configure Infura/Alchemy for RPC node access.
    *   **2. Core Pages/Components:**
        *   [x] Create `_app.js / _document.js` for global layout and Web3 context provider (e.g., wagmi).
        *   [x] Develop `Header/Navigation` (Connect Wallet button, links to Dashboard, Staking Pools, Governance).
        *   [x] Implement `Wallet Connection Modal` (MetaMask, WalletConnect, Coinbase Wallet integration).
    *   **3. Dashboard (`/`):**
        *   [x] Display user's aggregated stats (total RESURGE earned, total dead coins staked).
        *   [x] Summarize active staking pools.
        *   [x] Provide links to individual pool pages.
        *   [x] Fetch and display current RESURGE price (from DEX API like CoinGecko/Uniswap V3).
    *   **4. Staking Pools (`/pools`):**
    *   [x] List all supported `DeadCoinStakingPools`.
    *   [x] For each pool, display:
        *   [x] Dead coin name/symbol.
        *   [x] Current APR/APY (calculated on frontend).
        *   [x] User's staked amount.
        *   [x] User's pending RESURGE rewards (using `earned()` call).
        *   [x] Total TVL (from Subgraph).
        *   [x] "Stake", "Unstake", "Claim Rewards" buttons.
    *   **5. Individual Staking Pool Page (`/pools/[deadCoinAddress]`):**
    *   [x] Display detailed information for a single pool.
    *   [x] Show historical staking and reward data for the user (from Subgraph).
    *   [x] Implement charts for total staked amount, reward rate over time.
    *   [x] Prominent Stake/Unstake/Claim actions.
    *   **6. Stake/Unstake Modals:**
    *   [x] Input field for amount.
    *   [x] "Approve" button (for first-time staking).
    *   [x] "Stake" / "Unstake" buttons.
    *   [x] Gas fee estimation.
    *   [x] Transaction status feedback (pending, confirmed, failed).
    *   **7. Governance (`/governance`):**
    *   [x] List active, pending, and executed proposals (from Subgraph/on-chain calls).
    *   [x] Display details for each proposal: description, votes, proposer, voting period, status.
    *   [x] "Vote" button for active proposals.
    *   [x] "Create Proposal" button (for eligible RESURGE token holders).
    *   **8. About/Docs (`/docs`):**
    *   [x] Link to comprehensive documentation (whitepaper, how-to guides).
    *   **9. Cross-cutting Concerns:**
    *   [x] Implement robust error handling for blockchain transactions.
    *   [x] Ensure mobile-first responsive design.
    *   [x] Manage wallet connection, selected chain, user balances, staking pool data via state management.

**III. Security & Auditing Strategy**

*   **A. Code Standards & Best Practices:**
    *   Follow Solidity style guide.
    *   Utilize OpenZeppelin for battle-tested components.
    *   Minimize contract complexity.
    *   Implement checks-effects-interactions pattern.
    *   Guard against reentrancy, integer overflow/underflow (Solidity 0.8+ handles default).
    *   Implement strict access control on sensitive functions.
*   **B. Extensive Testing:**
    *   Write comprehensive Unit Tests (aim for 90%+ coverage).
    *   Develop Integration Tests for multi-contract interactions.
    *   Perform Fork Testing/Mainnet Simulation.
    *   Implement Fuzzing using tools like Echidna or Foundry's fuzzer.
    *   (Recommended) Conduct Formal Verification for core logic (e.g., Certora, K-framework).
*   **C. Professional Smart Contract Audits:**
    *   Engage for Phase 1 Audit (Pre-Alpha).
    *   Engage for Phase 2 Audit (Pre-Launch).
    *   Plan for Post-Launch Audits for major upgrades.
*   **D. Bug Bounty Program:**
    *   Launch a public bug bounty on platforms like Immunefi or HackenProof.
*   **E. Multi-Sig for Critical Operations:**
    *   Set up a Gnosis Safe (or similar) multi-signature wallet for controlling high-privilege addresses (pre-full DAO governance).
*   **F. Monitoring & Alerting:**
    *   Set up real-time monitoring for contract events, large transactions, potential exploits, and abnormal activity (e.g., Tenderly, Forta, Blocknative).

**IV. Deployment & Post-Launch Operations**

*   **A. Deployment Scripts:**
    *   Develop automated deployment scripts using Hardhat or Foundry.
    *   Verify contract code on block explorers (e.g., PolygonScan) after deployment.
*   **B. Documentation:**
    *   Create a Whitepaper.
    *   Develop Technical Documentation (READMEs, Natspec comments, Subgraph API docs).
    *   Write comprehensive User Guides.
*   **C. Community & Support:**
    *   Establish clear communication channels (Discord, Telegram, Twitter/X).
    *   Set up prompt support for user queries.
    *   Foster an active and engaged community around the RESURGE DAO.
*   **D. Upgradeable Contracts (UUPS Proxy Pattern):**
    *   Implement OpenZeppelin's UUPS proxy pattern for all core contracts (`ResurgeToken`, `StakingPoolManager`, `RewardDistributor`, `DeadCoinStakingPool` template).