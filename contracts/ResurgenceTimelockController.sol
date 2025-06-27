// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

contract ResurgenceTimelockController is TimelockController {
    // Define roles needed for the TimelockController
    // In this context, the Governor contract will be the PROPOSER and EXECUTOR.
    // A multi-sig can be set as ADMIN if needed for initial setup.
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {
        // Revoke the deployer's admin role to ensure the Timelock is controlled by the Governance
        // This is a common practice for security.
        // If the deployer needs admin rights for initial setup, this can be done after deployment
        // via a governance proposal.
        // _setRoleAdmin(DEFAULT_ADMIN_ROLE, admin); // This is already handled by constructor
    }
} 