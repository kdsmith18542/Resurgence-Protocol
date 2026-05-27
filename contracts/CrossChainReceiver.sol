// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IAny2EVMMessageReceiver} from "@chainlink/contracts-ccip/contracts/interfaces/IAny2EVMMessageReceiver.sol";

interface IRewardDistributorBridge {
    function mintForBridge(address user, uint256 amount) external;
}

/// @title CrossChainReceiver - CCIP message receiver on the Arbitrum hub
/// @notice Receives reward-claim messages from spoke chains and triggers RESURGE minting
/// @dev Non-upgradeable — router address is immutable; redeploy via deployCrossChainReceiver.js
contract CrossChainReceiver is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant EMERGENCY_PAUSER = keccak256("EMERGENCY_PAUSER");

    error CrossChainReceiver_InvalidRouter();
    error CrossChainReceiver_InvalidAddress();
    error CrossChainReceiver_UnauthorizedSource();
    error CrossChainReceiver_MessageAlreadyProcessed();
    error CrossChainReceiver_InvalidPayload();
    error CrossChainReceiver_OnlyRouter();
    error CrossChainReceiver_AmountExceedsCap();

    address public immutable ccipRouter;
    address public rewardDistributor;
    uint256 public maxBridgeMintPerMessage;

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
    event MaxBridgeMintUpdated(uint256 newMax);

    constructor(address _router, address _rewardDistributor, address _timelock) {
        if (_router == address(0)) revert CrossChainReceiver_InvalidRouter();
        if (_rewardDistributor == address(0) || _timelock == address(0))
            revert CrossChainReceiver_InvalidAddress();

        ccipRouter = _router;
        rewardDistributor = _rewardDistributor;
        maxBridgeMintPerMessage = 100_000 * 1e18;

        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(EMERGENCY_PAUSER, _timelock);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TIMELOCK_ROLE, msg.sender);
        _grantRole(EMERGENCY_PAUSER, msg.sender);
    }

    /// @notice Called by the CCIP router when a cross-chain message arrives
    function ccipReceive(Client.Any2EVMMessage calldata message) external whenNotPaused nonReentrant {
        if (msg.sender != ccipRouter) revert CrossChainReceiver_OnlyRouter();
        if (processedMessages[message.messageId])
            revert CrossChainReceiver_MessageAlreadyProcessed();

        bytes memory trusted = authorizedSources[message.sourceChainSelector];
        if (trusted.length == 0 || keccak256(message.sender) != keccak256(trusted))
            revert CrossChainReceiver_UnauthorizedSource();

        if (message.data.length < 64) revert CrossChainReceiver_InvalidPayload();
        (address user, uint256 amount) = abi.decode(message.data, (address, uint256));

        if (amount > maxBridgeMintPerMessage) revert CrossChainReceiver_AmountExceedsCap();

        processedMessages[message.messageId] = true;
        emit RewardBridged(message.messageId, message.sourceChainSelector, user, amount);
        IRewardDistributorBridge(rewardDistributor).mintForBridge(user, amount);
    }

    /// @notice Required so CCIP Router recognises this contract as a valid message receiver.
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAny2EVMMessageReceiver).interfaceId || super.supportsInterface(interfaceId);
    }

    function pause() external onlyRole(EMERGENCY_PAUSER) { _pause(); }
    function unpause() external onlyRole(TIMELOCK_ROLE) { _unpause(); }

    /// @notice Updates the per-message mint cap (governance-controlled)
    function setMaxBridgeMintPerMessage(uint256 _max) external onlyRole(TIMELOCK_ROLE) {
        maxBridgeMintPerMessage = _max;
        emit MaxBridgeMintUpdated(_max);
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
