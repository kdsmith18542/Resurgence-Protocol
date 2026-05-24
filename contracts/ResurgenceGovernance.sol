// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/governance/IGovernor.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ResurgenceTimelockController.sol";
import "./ResurgeToken.sol";

interface IResurgeStakingPool {
    function getPastStakedVotes(address account, uint256 blockNumber) external view returns (uint256);
}

/// @title ResurgenceGovernance - Governance contract for the Resurgence Protocol
/// @notice Implements on-chain governance using OpenZeppelin Governor components
/// @dev Uses GovernorSettings, CountingSimple, Votes, QuorumFraction, and TimelockControl
contract ResurgenceGovernance is 
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    /// @dev Track the latest proposal ID
    uint256 private _latestProposalId;

    /// @notice RSP address for staked vote aggregation; address(0) if not yet deployed.
    address public immutable stakingPool;

    /// @notice Initializes the governance contract
    /// @param _resurgeToken The native RESURGE token address (IVotes compatible)
    /// @param _timelock The TimelockController address
    /// @param _stakingPool ResurgeStakingPool address for staked vote aggregation (address(0) to skip)
    /// @param _votingDelay Number of blocks between proposal and voting start
    /// @param _votingPeriod Duration of the voting period in blocks
    /// @param _quorumPercentage Percentage of total supply needed for quorum (e.g. 4)
    /// @param _proposalThreshold Number of votes needed to create a proposal
    constructor(
        ResurgeToken _resurgeToken,
        ResurgenceTimelockController _timelock,
        address _stakingPool,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _quorumPercentage,
        uint256 _proposalThreshold
    )
        Governor("ResurgenceGovernor")
        GovernorSettings(
            uint48(_votingDelay),
            uint32(_votingPeriod),
            _proposalThreshold
        )
        GovernorVotes(IVotes(address(_resurgeToken)))
        GovernorVotesQuorumFraction(_quorumPercentage)
        GovernorTimelockControl(_timelock)
    {
        stakingPool = _stakingPool;
    }

    // The following functions are overrides required by Solidity

    /// @notice Returns the current voting delay
    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    /// @notice Returns the current voting period
    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    /// @notice Returns the quorum required for a specific block number
    function quorum(uint256 blockNumber) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }

    /// @notice Returns the current state of a proposal
    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }

    /// @notice Returns the number of votes required to create a proposal
    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    /// @notice Creates a new proposal
    /// @param targets Target addresses for the proposal calls
    /// @param values ETH values for the proposal calls
    /// @param calldatas Encoded function calls
    /// @param description Text description of the proposal
    /// @return proposalId The unique identifier for the created proposal
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor) returns (uint256) {
        uint256 proposalId = super.propose(targets, values, calldatas, description);
        _latestProposalId = proposalId;
        return proposalId;
    }

    /// @notice Executes a successful and queued proposal
    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    /// @notice Cancels a proposal
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    /// @notice Returns the address of the executor (the timelock)
    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }

    /// @notice Checks if the contract supports an interface
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    /// @notice Returns the voting power of an account at a specific block
    function getVotes(address account, uint256 blockNumber)
        public
        view
        override(Governor)
        returns (uint256)
    {
        return super.getVotes(account, blockNumber);
    }

    /// @dev Aggregates liquid RESURGE votes (ERC20Votes) and staked RESURGE votes (RSP checkpoints).
    ///      1 RESURGE = 1 vote regardless of source; boosts only affect reward yield, not vote weight.
    function _getVotes(address account, uint256 timepoint, bytes memory params)
        internal
        view
        virtual
        override(Governor, GovernorVotes)
        returns (uint256)
    {
        uint256 liquidVotes = super._getVotes(account, timepoint, params);
        uint256 stakedVotes = stakingPool != address(0)
            ? IResurgeStakingPool(stakingPool).getPastStakedVotes(account, timepoint)
            : 0;
        return liquidVotes + stakedVotes;
    }

    /// @notice Returns the most recently created proposal ID
    function latestProposalId() public view returns (uint256) {
        return _latestProposalId;
    }

    /// @dev Internal function to count votes
    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 totalWeight,
        bytes memory params
    ) internal override(Governor, GovernorCountingSimple) returns (uint256) {
        return super._countVote(proposalId, account, support, totalWeight, params);
    }

    /// @dev Internal function to check if quorum is reached
    function _quorumReached(uint256 proposalId)
        internal
        view
        override(Governor, GovernorCountingSimple)
        returns (bool)
    {
        return super._quorumReached(proposalId);
    }

    /// @dev Internal function to check if vote succeeded
    function _voteSucceeded(uint256 proposalId)
        internal
        view
        override(Governor, GovernorCountingSimple)
        returns (bool)
    {
        return super._voteSucceeded(proposalId);
    }

    /// @notice Returns the timelock address
    function timelock() public view override(GovernorTimelockControl) returns (address) {
        return super.timelock();
    }

    function proposalNeedsQueuing(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }
}