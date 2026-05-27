// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/// @title CrossChainSender - CCIP message sender deployed on each spoke chain
/// @notice DeadCoinStakingPool instances call sendRewardClaim() (CCIP path) or
///         bridgeClaimRelay() (BaaLS relay path) to bridge accrued debt to the hub.
/// @dev Non-upgradeable; LINK-funded; one deployment per spoke chain
contract CrossChainSender is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");

    error CrossChainSender_InvalidAddress();
    error CrossChainSender_UnauthorizedCaller();
    error CrossChainSender_InsufficientLinkBalance();
    error CrossChainSender_ChainNotSupported();
    error CrossChainSender_FeeTooHigh();
    error CrossChainSender_CCIPDisabled();
    error CrossChainSender_RelayDisabled();

    IRouterClient public immutable router;
    IERC20 public immutable linkToken;

    uint64 public hubChainSelector;
    address public hubReceiver;
    uint256 public maxLinkFee;   // safety cap — prevents fee drain on misconfigured hub
    uint256 public gasLimit;

    bool public ccipEnabled;   // governance can disable CCIP path
    bool public relayEnabled;  // governance can disable relay path

    uint256 public relayNonce; // monotonically increasing per-sender nonce for replay protection

    /// @notice Only registered DeadCoinStakingPool proxies may call sendRewardClaim/bridgeClaimRelay
    mapping(address => bool) public authorizedCallers;

    event RewardClaimSent(
        bytes32 indexed messageId,
        address indexed user,
        uint256 amount,
        uint256 ccipFee
    );
    /// @notice Emitted when a relay bridge claim is queued for BaaLS EVMSubmitter pickup
    event BridgeClaimRequested(
        address indexed staker,
        uint256 amount,
        uint256 nonce
    );
    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);
    event HubUpdated(uint64 chainSelector, address receiver);
    event LinkWithdrawn(address indexed to, uint256 amount);
    event CCIPEnabledSet(bool enabled);
    event RelayEnabledSet(bool enabled);

    constructor(
        address _router,
        address _linkToken,
        uint64 _hubChainSelector,
        address _hubReceiver,
        address _timelock
    ) {
        if (_router == address(0) || _linkToken == address(0) || _hubReceiver == address(0) || _timelock == address(0))
            revert CrossChainSender_InvalidAddress();

        router = IRouterClient(_router);
        linkToken = IERC20(_linkToken);
        hubChainSelector = _hubChainSelector;
        hubReceiver = _hubReceiver;
        maxLinkFee = 1e18;    // 1 LINK default cap
        gasLimit = 200_000;
        ccipEnabled = true;
        relayEnabled = true;

        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TIMELOCK_ROLE, msg.sender);
    }

    /// @notice Send a reward claim to the hub chain via CCIP
    /// @param user The user on the spoke chain whose debt is being bridged
    /// @param amount Total RESURGE debt to mint on the hub (gross — no fee deducted)
    /// @return messageId The CCIP message ID for tracking
    function sendRewardClaim(address user, uint256 amount)
        external
        nonReentrant
        returns (bytes32 messageId)
    {
        if (!authorizedCallers[msg.sender]) revert CrossChainSender_UnauthorizedCaller();
        if (!ccipEnabled) revert CrossChainSender_CCIPDisabled();
        if (!router.isChainSupported(hubChainSelector)) revert CrossChainSender_ChainNotSupported();

        bytes memory payload = abi.encode(user, amount);

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(hubReceiver),
            data: payload,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(linkToken),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: gasLimit}))
        });

        uint256 fee = router.getFee(hubChainSelector, message);
        if (fee > maxLinkFee) revert CrossChainSender_FeeTooHigh();
        if (linkToken.balanceOf(address(this)) < fee) revert CrossChainSender_InsufficientLinkBalance();

        linkToken.forceApprove(address(router), fee);
        messageId = router.ccipSend(hubChainSelector, message);

        emit RewardClaimSent(messageId, user, amount, fee);
    }

    /// @notice Authorize a DeadCoinStakingPool proxy to call sendRewardClaim
    function authorizeCaller(address caller) external onlyRole(TIMELOCK_ROLE) {
        if (caller == address(0)) revert CrossChainSender_InvalidAddress();
        authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
    }

    /// @notice Remove a pool from the authorized callers list
    function revokeCaller(address caller) external onlyRole(TIMELOCK_ROLE) {
        authorizedCallers[caller] = false;
        emit CallerRevoked(caller);
    }

    /// @notice Update the hub chain selector and receiver address (governance only)
    function setHub(uint64 _chainSelector, address _receiver) external onlyRole(TIMELOCK_ROLE) {
        if (_receiver == address(0)) revert CrossChainSender_InvalidAddress();
        hubChainSelector = _chainSelector;
        hubReceiver = _receiver;
        emit HubUpdated(_chainSelector, _receiver);
    }

    /// @notice Update the LINK fee safety cap
    function setMaxLinkFee(uint256 _maxFee) external onlyRole(TIMELOCK_ROLE) {
        maxLinkFee = _maxFee;
    }

    /// @notice Update gas limit for CCIP destination execution
    function setGasLimit(uint256 _gasLimit) external onlyRole(TIMELOCK_ROLE) {
        gasLimit = _gasLimit;
    }

    /// @notice Queue a reward claim for relay via BaaLS EVMSubmitter (no CCIP, no LINK fee)
    /// @param staker The user whose reward should be minted on the hub
    /// @param amount Total RESURGE to mint on the hub
    /// @dev Emits BridgeClaimRequested; BaaLS EVMSubmitter watches this event and calls
    ///      RewardDistributor.mintForRelay(staker, amount, sourceChainId, address(this), nonce) on the hub.
    ///      The nonce + sender address form a globally unique replay-protection key on the hub.
    function bridgeClaimRelay(address staker, uint256 amount) external nonReentrant {
        if (!authorizedCallers[msg.sender]) revert CrossChainSender_UnauthorizedCaller();
        if (!relayEnabled) revert CrossChainSender_RelayDisabled();
        uint256 nonce = relayNonce++;
        emit BridgeClaimRequested(staker, amount, nonce);
    }

    /// @notice Enable or disable the CCIP bridge path
    function setCCIPEnabled(bool _enabled) external onlyRole(TIMELOCK_ROLE) {
        ccipEnabled = _enabled;
        emit CCIPEnabledSet(_enabled);
    }

    /// @notice Enable or disable the BaaLS relay bridge path
    function setRelayEnabled(bool _enabled) external onlyRole(TIMELOCK_ROLE) {
        relayEnabled = _enabled;
        emit RelayEnabledSet(_enabled);
    }

    /// @notice Withdraw LINK from this contract (governance emergency recovery)
    function withdrawLink(address to, uint256 amount) external onlyRole(TIMELOCK_ROLE) nonReentrant {
        if (to == address(0)) revert CrossChainSender_InvalidAddress();
        linkToken.safeTransfer(to, amount);
        emit LinkWithdrawn(to, amount);
    }
}
