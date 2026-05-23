// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title NonEvmStakingPool — Registry for non-EVM wallet dormancy staking
/// @notice Users register their BTC/DOGE/LTC wallet addresses. When ChronoNode detects
///         dormancy and BaaLS attests it, the oracle queries this contract to find the
///         staker, then calls RewardDistributor.submitDormancyProof() to mint RESURGE.
/// @dev UUPS upgradeable. TIMELOCK_ROLE governs contract parameters.
contract NonEvmStakingPool is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");

    /// @notice Custom errors
    error NonEvmStakingPool_AlreadyRegistered();
    error NonEvmStakingPool_NotRegistered();
    error NonEvmStakingPool_NotOwner();
    error NonEvmStakingPool_InvalidInput();
    error NonEvmStakingPool_WalletTooLong();

    struct Registration {
        address staker;
        uint64 registeredAt;
        bool active;
    }

    /// @notice chainId (bytes32) => walletHash (bytes32) => Registration
    mapping(bytes32 => mapping(bytes32 => Registration)) private _registrations;

    /// @notice Store original wallet strings: chainId → walletHash → wallet string
    mapping(bytes32 => mapping(bytes32 => string)) private _walletStrings;

    /// @notice track which wallets a staker has registered: staker => chainId => walletHash => true
    mapping(address => mapping(bytes32 => mapping(bytes32 => bool))) private _stakerWallets;

    event WalletRegistered(
        bytes32 indexed chainId,
        bytes32 indexed walletHash,
        string wallet,
        address indexed staker,
        uint256 registeredAt
    );
    event WalletUnregistered(
        bytes32 indexed chainId,
        bytes32 indexed walletHash,
        string wallet,
        address indexed staker
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _timelock) public initializer {
        if (_timelock == address(0)) revert NonEvmStakingPool_InvalidInput();

        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TIMELOCK_ROLE, msg.sender);
    }

    /// @notice Register a non-EVM wallet under the caller's ownership.
    ///         ChronoNode should watch for this event to add the wallet to its watch list.
    /// @param chainId Chain identifier as bytes32 (e.g. "bitcoin")
    /// @param wallet The wallet address on the source chain (e.g. "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")
    function registerWallet(bytes32 chainId, string calldata wallet) external whenNotPaused {
        if (bytes(wallet).length == 0) revert NonEvmStakingPool_InvalidInput();
        if (bytes(wallet).length > 128) revert NonEvmStakingPool_WalletTooLong();

        bytes32 walletHash = keccak256(abi.encodePacked(wallet));

        if (_registrations[chainId][walletHash].active) {
            revert NonEvmStakingPool_AlreadyRegistered();
        }

        _registrations[chainId][walletHash] = Registration({
            staker: msg.sender,
            registeredAt: uint64(block.timestamp),
            active: true
        });
        _walletStrings[chainId][walletHash] = wallet;
        _stakerWallets[msg.sender][chainId][walletHash] = true;

        emit WalletRegistered(chainId, walletHash, wallet, msg.sender, block.timestamp);
    }

    /// @notice Unregister a wallet you previously registered
    /// @param chainId Chain identifier
    /// @param wallet The wallet address string
    function unregisterWallet(bytes32 chainId, string calldata wallet) external {
        bytes32 walletHash = keccak256(abi.encodePacked(wallet));
        Registration storage reg = _registrations[chainId][walletHash];

        if (!reg.active) revert NonEvmStakingPool_NotRegistered();
        if (reg.staker != msg.sender) revert NonEvmStakingPool_NotOwner();

        reg.active = false;
        _stakerWallets[msg.sender][chainId][walletHash] = false;

        emit WalletUnregistered(chainId, walletHash, wallet, msg.sender);
    }

    /// @notice Get the EVM staker address for a registered non-EVM wallet.
    ///         Called by the dormancy oracle before calling RewardDistributor.submitDormancyProof().
    /// @param chainId Chain identifier
    /// @param wallet The wallet address string
    /// @return staker The EVM address that registered this wallet (or address(0) if not found)
    function getStaker(bytes32 chainId, string calldata wallet) external view returns (address) {
        bytes32 walletHash = keccak256(abi.encodePacked(wallet));
        Registration storage reg = _registrations[chainId][walletHash];
        if (!reg.active) return address(0);
        return reg.staker;
    }

    /// @notice Check if a wallet is currently registered
    function isRegistered(bytes32 chainId, string calldata wallet) external view returns (bool) {
        bytes32 walletHash = keccak256(abi.encodePacked(wallet));
        return _registrations[chainId][walletHash].active;
    }

    /// @notice Get full registration details for a wallet
    function getRegistration(bytes32 chainId, string calldata wallet)
        external
        view
        returns (address staker, uint64 registeredAt, bool active)
    {
        bytes32 walletHash = keccak256(abi.encodePacked(wallet));
        Registration storage reg = _registrations[chainId][walletHash];
        return (reg.staker, reg.registeredAt, reg.active);
    }

    /// @notice Check if a staker owns a specific wallet
    function isStakerOwner(
        address staker,
        bytes32 chainId,
        string calldata wallet
    ) external view returns (bool) {
        bytes32 walletHash = keccak256(abi.encodePacked(wallet));
        return _registrations[chainId][walletHash].active
            && _registrations[chainId][walletHash].staker == staker;
    }

    /// @notice Pause registrations
    function pause() external onlyRole(TIMELOCK_ROLE) {
        _pause();
    }

    /// @notice Unpause registrations
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @dev UUPS upgrade authorization
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(TIMELOCK_ROLE) {}

    uint256[47] private __gap;
}
