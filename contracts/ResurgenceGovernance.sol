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
import "@openzeppelin/contracts/governance/extensions/IGovernorTimelock.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ResurgenceTimelockController.sol";
import "./ResurgenceProtocol.sol"; // Updated import to match the new token contract name

contract ResurgenceGovernance is 
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    // Track the latest proposal ID
    uint256 private _latestProposalId;
    constructor(
        ResurgenceProtocol _resurgeToken,
        ResurgenceTimelockController _timelock,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _quorumPercentage
    )
        Governor("ResurgenceGovernor")
        GovernorSettings(
            _votingDelay, /* 1 block */
            _votingPeriod, /* 1 week */
            0
        )
        GovernorVotes(IVotes(address(_resurgeToken)))
        GovernorVotesQuorumFraction(_quorumPercentage)
        GovernorTimelockControl(_timelock)
    {
        // The timelock is where proposals get executed. Ensure it's correctly set up.
        // The `TimelockController` should grant the `PROPOSER_ROLE` and `EXECUTOR_ROLE` to this Governor contract.
        // This needs to be done *after* the Governor is deployed, usually by the Timelock's initial admin.

        // Set the timelock address for the Governor
        _timelock.grantRole(_timelock.PROPOSER_ROLE(), address(this));
        _timelock.grantRole(_timelock.EXECUTOR_ROLE(), address(this));

        // Set the quorum for votes

    }

    // The following functions are overrides required by Solidity
    function votingDelay() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber) public view override(IGovernor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }

    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor, IGovernor) returns (uint256) {
        uint256 proposalId = super.propose(targets, values, calldatas, description);
        _latestProposalId = proposalId;
        return proposalId;
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    function getVotes(address account, uint256 blockNumber)
        public
        view
        override(Governor, IGovernor)
        returns (uint256)
    {
        return super.getVotes(account, blockNumber);
    }

    function latestProposalId() public view returns (uint256) {
        return _latestProposalId;
    }

    // The following functions are overrides required by Solidity
    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 weight,
        bytes memory params
    ) internal override(Governor, GovernorCountingSimple) {
        super._countVote(proposalId, account, support, weight, params);
    }

    function _quorumReached(uint256 proposalId)
        internal
        view
        override(Governor, GovernorCountingSimple)
        returns (bool)
    {
        return super._quorumReached(proposalId);
    }

    function _voteSucceeded(uint256 proposalId)
        internal
        view
        override(Governor, GovernorCountingSimple)
        returns (bool)
    {
        return super._voteSucceeded(proposalId);
    }

    function timelock() public view override(GovernorTimelockControl) returns (address) {
        return super.timelock();
    }

    // Standard governor functions for proposing, voting, and executing proposals
    // These are inherited, but can be overridden for custom logic.

    // Key Proposals:
    // - Adding/removing new DeadCoinStakingPool instances via StakingPoolManager.
    // - Adjusting reward rates for existing pools.
    // - Upgrading core contracts (via UUPSUpgradeable proxies, recommended for future-proofing).
    // - Managing the RewardDistributor (e.g., updating maxMintSupply).
    // - Managing a potential treasury for protocol operations.
}