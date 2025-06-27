While this specification uses detailed Markdown, for truly critical sections (e.g., reward calculation logic in DeadCoinStakingPool), a formal specification language like TLA+ or Alloy could be used to mathematically prove properties, and should be considered in a dedicated docs/formal_specs directory.

I. RESURGE Token (ERC-20)
Contract File: contracts/ResurgeToken.sol
Inherits: OpenZeppelin ERC20, AccessControl (or Ownable initially, then migrate to AccessControl for MINTER_ROLE).
Purpose: The utility and governance token for the Resurgence Protocol.

State Variables:

string public name: Token name ("Resurgence Protocol Token").
string public symbol: Token symbol ("RESURGE").
uint8 public constant decimals = 18: Standard decimal places.
uint256 public MAX_SUPPLY: The maximum total supply of RESURGE tokens. (e.g., 1,000,000,000 * 10**18 for 1 billion tokens with 18 decimals).
address public MINTER_ROLE_GRANTER: Address initially allowed to grant MINTER_ROLE. (Should be transferred to Governance after deployment).
address public PAUSER_ROLE_GRANTER: Address initially allowed to grant PAUSER_ROLE. (Should be transferred to Governance after deployment).
Roles (using OpenZeppelin AccessControl):

MINTER_ROLE: Has permission to call _mint(). Granted to RewardDistributor and Governance initially.
PAUSER_ROLE: Has permission to pause transfers if ERC20Pausable is used. Granted to Governance for emergency.
Events:

All standard ERC20 events (Transfer, Approval).
RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
Functions:

constructor(string memory _name, string memory _symbol, uint256 _maxSupply)

Visibility: public
Parameters:
_name: Token name.
_symbol: Token symbol.
_maxSupply: Maximum total supply.
Pre-conditions: None.
Post-conditions:
name is set to _name.
symbol is set to _symbol.
MAX_SUPPLY is set to _maxSupply.
DEFAULT_ADMIN_ROLE is granted to msg.sender.
Initial supply (e.g., 0 or a pre-minted amount to a treasury) is handled.
Notes: Initial minting to a Treasury or Timelock contract should be done carefully, or MAX_SUPPLY and minting will be entirely controlled by the RewardDistributor and Governance.
mint(address to, uint256 amount)

Visibility: internal (exposed via _mint but permissioned by MINTER_ROLE)
Parameters:
to: Address to mint tokens to.
amount: Amount of tokens to mint.
Pre-conditions:
msg.sender must have MINTER_ROLE.
totalSupply() + amount <= MAX_SUPPLY.
Post-conditions:
balanceOf(to) increases by amount.
totalSupply() increases by amount.
Transfer event emitted from address(0) to to with amount.
Notes: This function is typically wrapped by _mint in ERC-20 implementations and controlled via AccessControl for external callers.
grantRole(bytes32 role, address account)

Visibility: public
Permissions: DEFAULT_ADMIN_ROLE or specific role administrators.
Pre-conditions: msg.sender has permission to grant role.
Post-conditions: account is granted role. RoleGranted event emitted.
Notes: Crucial for setting up initial roles (e.g., MINTER_ROLE to RewardDistributor).
revokeRole(bytes32 role, address account)

Visibility: public
Permissions: DEFAULT_ADMIN_ROLE or specific role administrators.
Pre-conditions: msg.sender has permission to revoke role. account must have role.
Post-conditions: account has role revoked. RoleRevoked event emitted.
Standard ERC-20 Functions: transfer, transferFrom, approve, allowance, balanceOf, totalSupply.

Follow EIP-20 specifications. Include SafeERC20 wrapper for external token interactions.
II. DeadCoinStakingPool (Proxied Implementation)
Contract File: contracts/staking/DeadCoinStakingPool.sol
Inherits: OpenZeppelin ReentrancyGuard, Initializable (for UUPS proxy).
Purpose: Manages staking for a single "dead coin" and calculates RESURGE rewards.

State Variables:

IERC20 public immutable deadCoinToken: Address of the specific dead coin's ERC-20 contract (immutable after initialization).
IERC20 public immutable resurgeToken: Address of the ResurgeToken contract (immutable after initialization).
uint256 public rewardRatePerSecond: Current RESURGE reward rate per second for this specific pool.
uint256 public lastUpdateTime: Last timestamp when rewards were updated or a stake/unstake/claim occurred.
uint256 public rewardPerTokenStored: Total RESURGE rewards accrued per unit of deadCoinToken staked, multiplied by 1e18 for precision (accumulator).
mapping(address => uint256) public userStakedBalance: Amount of deadCoinToken staked by each user.
mapping(address => uint256) public userRewardPerTokenPaid: rewardPerTokenStored value at the time a user last claimed or staked.
mapping(address => uint256) public userUnclaimedRewards: Accumulated RESURGE rewards for each user, not yet claimed.
Events:

Staked(address indexed user, uint256 amount)
Unstaked(address indexed user, uint256 amount)
RewardsClaimed(address indexed user, uint256 amount)
RewardRateUpdated(uint256 newRate)
Functions:

initialize(address _deadCoinToken, address _resurgeToken)

Visibility: public
Parameters:
_deadCoinToken: Address of the specific dead coin.
_resurgeToken: Address of the RESURGE token.
Pre-conditions: _deadCoinToken != address(0), _resurgeToken != address(0), and must not be initialized before (_initialized internal flag from OpenZeppelin).
Post-conditions:
deadCoinToken and resurgeToken are set.
lastUpdateTime is set to block.timestamp.
rewardRatePerSecond is initially 0.
Sets __Initialized__ flag.
Notes: This is the proxy initializer, not a regular constructor.
_updateReward() (Internal Helper Function)

Visibility: internal
Pre-conditions: None.
Post-conditions:
rewardPerTokenStored is updated based on time elapsed and rewardRatePerSecond.
lastUpdateTime is set to block.timestamp.
Logic:
uint256 timeElapsed = block.timestamp - lastUpdateTime;
if (timeElapsed > 0 && totalStaked() > 0):
uint256 reward = timeElapsed * rewardRatePerSecond;
resurgeToken.transfer(address(this), reward); // Pulls rewards from RewardDistributor
rewardPerTokenStored += (reward * 1e18) / totalStaked();
lastUpdateTime = block.timestamp;
Invariant: lastUpdateTime <= block.timestamp. rewardPerTokenStored is monotonically non-decreasing.
_earned(address account) (Internal View Helper Function)

Visibility: internal view
Parameters: account: The user's address.
Returns: uint256 - Amount of RESURGE rewards pending for account.
Logic:
return (userStakedBalance[account] * (rewardPerTokenStored - userRewardPerTokenPaid[account])) / 1e18 + userUnclaimedRewards[account];
Invariant: Returns non-negative value.
stake(uint256 amount)

Visibility: public
Parameters: amount: Amount of deadCoinToken to stake.
Pre-conditions:
amount > 0.
IERC20(deadCoinToken).transferFrom(msg.sender, address(this), amount) must succeed (user must approve).
Post-conditions:
User's userUnclaimedRewards are updated via _earned(msg.sender) and then stored.
userStakedBalance[msg.sender] increases by amount.
deadCoinToken.balanceOf(address(this)) increases by amount.
_updateReward() is called.
userRewardPerTokenPaid[msg.sender] is set to rewardPerTokenStored.
Staked event emitted.
Security: nonReentrant modifier.
unstake(uint256 amount)

Visibility: public
Parameters: amount: Amount of deadCoinToken to unstake.
Pre-conditions:
amount > 0.
userStakedBalance[msg.sender] >= amount.
Post-conditions:
User's userUnclaimedRewards are updated via _earned(msg.sender) and then stored.
userStakedBalance[msg.sender] decreases by amount.
IERC20(deadCoinToken).transfer(msg.sender, amount) succeeds.
_updateReward() is called.
userRewardPerTokenPaid[msg.sender] is set to rewardPerTokenStored.
Unstaked event emitted.
Security: nonReentrant modifier.
claimRewards()

Visibility: public
Pre-conditions: earned(msg.sender) > 0.
Post-conditions:
uint256 rewards = earned(msg.sender) is calculated.
userUnclaimedRewards[msg.sender] is set to 0.
resurgeToken.transfer(msg.sender, rewards) succeeds.
_updateReward() is called.
userRewardPerTokenPaid[msg.sender] is set to rewardPerTokenStored.
RewardsClaimed event emitted.
Security: nonReentrant modifier.
setRewardRate(uint256 _newRate)

Visibility: public
Parameters: _newRate: The new RESURGE reward rate per second for this pool.
Pre-conditions:
msg.sender must be the StakingPoolManager or its authorized governance.
_updateReward() is called before updating the rate (to accurately calculate pending rewards with the old rate).
Post-conditions:
rewardRatePerSecond is set to _newRate.
RewardRateUpdated event emitted.
Access Control: This function MUST be protected so only the StakingPoolManager (controlled by Governance) can call it.
totalStaked()

Visibility: public view
Returns: uint256 - Total amount of deadCoinToken currently staked in this pool.
Logic: Returns IERC20(deadCoinToken).balanceOf(address(this)).
III. StakingPoolManager
Contract File: contracts/staking/StakingPoolManager.sol
Inherits: OpenZeppelin AccessControl (or similar for governance control).
Purpose: Centralized management of DeadCoinStakingPool deployments and configuration.

State Variables:

address public immutable RESURGE: Address of the ResurgeToken.
address public immutable STAKING_POOL_IMPLEMENTATION: Address of the DeadCoinStakingPool logic contract for proxy deployments.
mapping(address => address) public deadCoinToStakingPool: Maps dead coin address to its deployed staking pool proxy address.
address[] public supportedDeadCoins: Array of addresses of supported dead coins. (Used for iteration, could also be a linked list for more gas-efficient removal).
Roles:

POOL_ADMIN_ROLE: Role for governance or an authorized admin to deploy and manage pools.
Events:

StakingPoolDeployed(address indexed deadCoinToken, address indexed poolAddress)
PoolRewardRateUpdated(address indexed deadCoinToken, uint256 newRate)
StakingPoolRemoved(address indexed deadCoinToken, address indexed poolAddress)
Functions:

constructor(address _resurgeToken, address _stakingPoolImplementation)

Visibility: public
Parameters:
_resurgeToken: Address of the RESURGE token.
_stakingPoolImplementation: Address of the DeadCoinStakingPool implementation contract.
Pre-conditions: _resurgeToken != address(0), _stakingPoolImplementation != address(0).
Post-conditions:
RESURGE and STAKING_POOL_IMPLEMENTATION are set.
DEFAULT_ADMIN_ROLE (or POOL_ADMIN_ROLE) is granted to msg.sender (to be transferred to Timelock/Governance).
deployStakingPool(address _deadCoinToken)

Visibility: public
Parameters: _deadCoinToken: Address of the dead coin for the new pool.
Pre-conditions:
msg.sender must have POOL_ADMIN_ROLE.
_deadCoinToken must not already have an active pool (deadCoinToStakingPool[_deadCoinToken] == address(0)).
Post-conditions:
A new DeadCoinStakingPool proxy is deployed.
The new pool is initialized with _deadCoinToken and RESURGE.
deadCoinToStakingPool[_deadCoinToken] is set to the new pool's address.
_deadCoinToken is added to supportedDeadCoins.
StakingPoolDeployed event emitted.
Implementation Detail: Use OpenZeppelinClones.sol or ERC1967Proxy with an initializer call.
setPoolRewardRate(address _deadCoinToken, uint256 _newRate)

Visibility: public
Parameters:
_deadCoinToken: Address of the dead coin whose pool rate is being set.
_newRate: The new reward rate.
Pre-conditions:
msg.sender must have POOL_ADMIN_ROLE.
deadCoinToStakingPool[_deadCoinToken] must be a valid, deployed pool.
Post-conditions:
Calls setRewardRate(_newRate) on the target DeadCoinStakingPool contract.
PoolRewardRateUpdated event emitted.
removeStakingPool(address _deadCoinToken)

Visibility: public
Parameters: _deadCoinToken: Address of the dead coin whose pool is to be "removed".
Pre-conditions:
msg.sender must have POOL_ADMIN_ROLE.
deadCoinToStakingPool[_deadCoinToken] must be a valid, deployed pool.
Post-conditions:
Marks the pool as inactive in the manager (e.g., set its reward rate to 0, or remove it from supportedDeadCoins).
StakingPoolRemoved event emitted.
Critical Note: This function should ideally disable new stakes for the pool but allow existing stakers to unstake and claim rewards. It should NOT physically delete the contract or locked funds. A governance vote would likely precede this, potentially with a long timelock.
getAllSupportedDeadCoins() (View Function)

Visibility: public view
Returns: address[] - Array of all supported dead coin addresses.
IV. RewardDistributor
Contract File: contracts/rewards/RewardDistributor.sol
Inherits: OpenZeppelin AccessControl (for EMISSION_MANAGER_ROLE).
Purpose: Controls the minting and distribution of RESURGE tokens to staking pools.

State Variables:

address public immutable RESURGE: Address of ResurgeToken.
address public immutable STAKING_POOL_MANAGER: Address of StakingPoolManager.
uint256 public totalEmissionRatePerSecond: The global rate at which RESURGE tokens are emitted from the ResurgeToken supply to all active pools.
uint256 public lastDistributionTime: Last timestamp when distributeRewards() was successfully called.
Roles:

EMISSION_MANAGER_ROLE: Role to set the totalEmissionRatePerSecond.
Events:

RewardsDistributed(uint256 amountDistributed)
TotalEmissionRateUpdated(uint256 newRate)
Functions:

constructor(address _resurgeToken, address _stakingPoolManager)

Visibility: public
Parameters:
_resurgeToken: Address of the RESURGE token.
_stakingPoolManager: Address of the StakingPoolManager.
Pre-conditions: Valid addresses.
Post-conditions:
RESURGE and STAKING_POOL_MANAGER are set.
DEFAULT_ADMIN_ROLE (or EMISSION_MANAGER_ROLE) is granted to msg.sender (to be transferred to Timelock/Governance).
lastDistributionTime initialized to block.timestamp.
distributeRewards()

Visibility: public (can be called by anyone, e.g., a keeper bot or user).
Pre-conditions:
totalEmissionRatePerSecond > 0.
block.timestamp > lastDistributionTime.
Post-conditions:
uint256 amountToMint = (block.timestamp - lastDistributionTime) * totalEmissionRatePerSecond;
If amountToMint > 0:
RESURGE.mint(address(this), amountToMint) is called. (Requires RewardDistributor to have MINTER_ROLE on ResurgeToken).
Iterates through STAKING_POOL_MANAGER.getAllSupportedDeadCoins().
For each active pool, calculates poolShare = pool.rewardRatePerSecond / totalActiveRewardRate * amountToMint.
RESURGE.transfer(poolAddress, poolShare) is called. (Requires approval or direct transfer if DeadCoinStakingPool pulls).
RewardsDistributed event emitted with amountToMint.
lastDistributionTime is updated to block.timestamp.
Optimization: To prevent gas limits with many pools, the distribution could be batched or require multiple calls. Alternatively, the DeadCoinStakingPool contracts could pull their rewards from RewardDistributor on staking/claiming actions, which is generally more gas efficient and decentralized. If pulling, the RewardDistributor simply holds the minted RESURGE and DeadCoinStakingPool calls resurgeToken.transfer(address(this), reward) to pull its share when _updateReward is called. The pulling mechanism (as outlined in DeadCoinStakingPool functions) is highly recommended. In this case, distributeRewards() would simply call RESURGE.mint(address(this), amountToMint) to ensure RESURGE is available for pools to pull.
setTotalEmissionRate(uint256 _newRate)

Visibility: public
Parameters: _newRate: The new global emission rate.
Pre-conditions: msg.sender must have EMISSION_MANAGER_ROLE.
Post-conditions: totalEmissionRatePerSecond is set to _newRate. TotalEmissionRateUpdated event emitted.
V. Governance and Timelock
Contract Files: contracts/governance/ResurgenceGovernor.sol, contracts/governance/ResurgenceTimelock.sol
Inherits: OpenZeppelin Governor, GovernorVotes, GovernorTimelockControl, TimelockController.
Purpose: Provide decentralized governance for the protocol and a time-delayed execution of proposals.

Key Parameters (configured in ResurgenceGovernor.sol constructor/via governance):

votingDelay: Number of blocks after proposal creation before voting starts.
votingPeriod: Number of blocks for which voting is open.
proposalThreshold: Minimum RESURGE voting power required to create a proposal.
quorumNumerator, quorumDenominator: Defines the fraction of total voting power required for a proposal to pass quorum (e.g., 4/100 for 4%).
minDelay: Minimum delay in seconds for TimelockController (e.g., 2 days = 172800 seconds).
Governance Flow:

Proposal Creation: A RESURGE holder (with sufficient proposalThreshold) calls propose() on ResurgenceGovernor.
Voting: RESURGE holders vote For, Against, or Abstain during votingPeriod. Voting power is determined by RESURGE token balance (or delegated balance) at proposalSnapshot block.
Quorum & Success Check: After votingPeriod, the system checks if quorum is met and if For votes outweigh Against votes.
Queueing: If successful, the proposal is queue()d in ResurgenceTimelock.
Execution Delay: The minDelay period starts.
Execution: After minDelay, any address can execute() the proposal via ResurgenceGovernor, which then calls execute on ResurgenceTimelock.
Critical Ownership Transfers Post-Deployment:

ResurgeToken.DEFAULT_ADMIN_ROLE (or minter/pauser roles) should be transferred to the TimelockController.
StakingPoolManager.POOL_ADMIN_ROLE should be transferred to the TimelockController.
RewardDistributor.EMISSION_MANAGER_ROLE should be transferred to the TimelockController.
The TimelockController should grant PROPOSER_ROLE and EXECUTOR_ROLE to the ResurgenceGovernor contract.
VI. Off-Chain Infrastructure (Technical Specifications)
The Graph Subgraph:

schema.graphql: Define all entities as described in the "Technical Architecture" section.
subgraph.yaml:
dataSources: Specify ResurgeToken, StakingPoolManager, DeadCoinStakingPool (template or individual sources), ResurgenceGovernor, ResurgenceTimelock contracts.
eventHandlers: Map relevant events to mapping.ts functions.
mapping.ts:
Implement handlers for all defined events (Transfer, Approval, Staked, Unstaked, RewardsClaimed, StakingPoolDeployed, PoolRewardRateUpdated, RewardsDistributed, ProposalCreated, VoteCast, etc.).
Logic to update/create entities based on event data.
Ensure correct handling of BigInt and BigDecimal for numerical operations.
Frontend dApp:

Technology Stack: Next.js (React), TypeScript, Ethers.js/Wagmi/viem, Tailwind CSS.
State Management: Global state management (e.g., Zustand/Jotai) for wallet connection, network, and user-specific data.
Data Fetching:
On-chain (Real-time): Use Ethers.js/Wagmi hooks for wallet balance, allowance checks, current rewardRatePerSecond, totalStaked(), earned().
Subgraph (Historical/Aggregated): Use Apollo Client or useQuery hooks (if using Wagmi) for lists of pools, user staking history, governance proposals, and vote data.
Component Specification:
Wallet Connector: Uses wagmi/connectors to support MetaMask, WalletConnect, Coinbase Wallet. Displays connected address, network.
Network Selector: Allows switching between supported networks (L2/Ethereum).
Dead Coin Pool Cards:
Props: deadCoinAddress, poolAddress, rewardRate, totalStaked, userStaked, userEarned.
Actions: approveDeadCoin, stakeDeadCoin, unstakeDeadCoin, claimResurge.
Input validation for staking/unstaking amounts.
Governance Components:
ProposalList: Displays summarized proposals (ID, proposer, state, votes).
ProposalDetail: Displays full proposal details, includes voting buttons (For, Against, Abstain).
CreateProposalForm: Allows users meeting proposalThreshold to draft executable proposals.
Error Handling: Implement robust error handling for failed transactions, RPC issues, and contract reverts. Provide user-friendly messages.
Gas Estimation: Display estimated gas costs for transactions where possible.
VII. Testing and Verification Strategy
Unit Tests (Solidity):
Framework: Hardhat / Foundry.
Coverage: Aim for 100% line and branch coverage.
Scenarios:
Token minting/burning, transfer mechanics.
Staking:
Initial stake, subsequent stakes.
Staking when rewardRatePerSecond changes.
Multiple users staking/unstaking in the same pool.
Edge cases: amount = 0, max uint256 values.
Unstaking: Full and partial unstakes.
Reward Calculation: Verify earned() accuracy over time, with different rewardRatePerSecond, and with multiple users. Test for precision issues.
Claiming: Verify correct reward transfer and state updates.
Governance: Proposal creation, voting, quorum checks, execution flow, timelock delays.
Access Control: Ensure only authorized roles can call restricted functions.
Reentrancy protection.
Integration Tests:
Test interactions between DeadCoinStakingPool, StakingPoolManager, RewardDistributor, ResurgeToken, Governance, and Timelock.
Simulate a full lifecycle: Deploying a new pool via governance, setting its rate, users staking, claiming, changing rates, executing upgrades.
Fuzz Testing (Foundry):
Target critical functions (e.g., stake, unstake, claim, _updateReward) with arbitrary valid inputs to uncover unexpected behaviors or overflows/underflows.
Security Audits:
Engage multiple reputable third-party auditing firms.
Provide them with this formal specification alongside the code.
Bug Bounty Program:
Launch a public bug bounty program (e.g., on Immunefi).
Continuous Integration/Continuous Deployment (CI/CD):
Automate unit/integration tests on every code commit.
Automate deployment to testnets upon successful test runs.
