// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

interface IRewardDistributorBridge {
    function mintForBridge(address user, uint256 amount) external;
}

/// @title CrossChainReceiver - CCIP message receiver on the Arbitrum hub
/// @notice Receives reward-claim messages from spoke chains and triggers RESURGE minting
/// @dev Non-upgradeable — router address is immutable; redeploy via deployCrossChainReceiver.js
contract CrossChainReceiver is AccessControl {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");

    error CrossChainReceiver_InvalidRouter();
    error CrossChainReceiver_InvalidAddress();
    error CrossChainReceiver_UnauthorizedSource();
    error CrossChainReceiver_MessageAlreadyProcessed();
    error CrossChainReceiver_InvalidPayload();
    error CrossChainReceiver_OnlyRouter();

    address public immutable ccipRouter;
    address public rewardDistributor;

    /// @notice sourceChainSelector => abi.encode(senderAddress) that is trusted
    mapping(uint64 => bytes) public authorizedSources;
    /// @notice messageId => already processed (replay guard)
    mapping(bytes32 => bool) public processedMessages;

    event RewardBridged(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        address indexed user,
        uint256 amount
    );
    event SourceAuthorized(uint64 indexed chainSelector, bytes sender);
    event SourceRevoked(uint64 indexed chainSelector);
    event RewardDistributorUpdated(address indexed newDistributor);

    constructor(address _router, address _rewardDistributor, address _timelock) {
        if (_router == address(0)) revert CrossChainReceiver_InvalidRouter();
        if (_rewardDistributor == address(0) || _timelock == address(0))
            revert CrossChainReceiver_InvalidAddress();

        ccipRouter = _router;
        rewardDistributor = _rewardDistributor;

        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TIMELOCK_ROLE, msg.sender);
    }

    /// @notice Called by the CCIP router when a cross-chain message arrives
    function ccipReceive(Client.Any2EVMMessage calldata message) external {
        if (msg.sender != ccipRouter) revert CrossChainReceiver_OnlyRouter();
        if (processedMessages[message.messageId])
            revert CrossChainReceiver_MessageAlreadyProcessed();

        bytes memory trusted = authorizedSources[message.sourceChainSelector];
        if (trusted.length == 0 || keccak256(message.sender) != keccak256(trusted))
            revert CrossChainReceiver_UnauthorizedSource();

        if (message.data.length < 64) revert CrossChainReceiver_InvalidPayload();
        (address user, uint256 amount) = abi.decode(message.data, (address, uint256));

        processedMessages[message.messageId] = true;
        IRewardDistributorBridge(rewardDistributor).mintForBridge(user, amount);

        emit RewardBridged(message.messageId, message.sourceChainSelector, user, amount);
    }

    /// @notice Authorize a spoke chain sender to submit bridge claims
    /// @param chainSelector CCIP chain selector for the spoke chain
    /// @param sender abi.encode(CrossChainSender address on that chain)
    function setAuthorizedSource(uint64 chainSelector, bytes calldata sender)
        external
        onlyRole(TIMELOCK_ROLE)
    {
        authorizedSources[chainSelector] = sender;
        emit SourceAuthorized(chainSelector, sender);
    }

    /// @notice Remove authorization for a spoke chain
    function revokeAuthorizedSource(uint64 chainSelector) external onlyRole(TIMELOCK_ROLE) {
        delete authorizedSources[chainSelector];
        emit SourceRevoked(chainSelector);
    }

    /// @notice Update the reward distributor address (governance-controlled)
    function setRewardDistributor(address _rewardDistributor) external onlyRole(TIMELOCK_ROLE) {
        if (_rewardDistributor == address(0)) revert CrossChainReceiver_InvalidAddress();
        rewardDistributor = _rewardDistributor;
        emit RewardDistributorUpdated(_rewardDistributor);
    }
}
