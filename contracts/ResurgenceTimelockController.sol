// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/// @title ResurgenceTimelockController - Governance timelock for the Resurgence Protocol
/// @notice Delays execution of governance proposals to allow user review
/// @dev Wraps OpenZeppelin's TimelockController with the default Resurgence configuration
/// @custom:security-contact grywrm1337@gmail.com
contract ResurgenceTimelockController is TimelockController {
    // Define roles needed for the TimelockController
    // In this context, the Governor contract will be the PROPOSER and EXECUTOR.
    // A multi-sig can be set as ADMIN if needed for initial setup.
    /// @notice Constructs the timelock controller
    /// @param minDelay Minimum delay in seconds before a queued proposal can be executed
    /// @param proposers Addresses authorized to propose actions
    /// @param executors Addresses authorized to execute actions
    /// @param admin Address with administrative privileges (typically the deployer, later renounced)
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {} 
} 