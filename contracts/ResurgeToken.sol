// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title ResurgeToken - The native governance and reward token of the Resurgence Protocol
/// @notice ERC20 token with governance capabilities, pausable, burnable, and capped supply
/// @dev Implements all required extensions per rpbp.txt: governance voting, permits, capped supply. UUPS Upgradeable.
/// @custom:security-contact grywrm1337@gmail.com
contract ResurgeToken is 
    Initializable, 
    ERC20Upgradeable, 
    ERC20BurnableUpgradeable, 
    ERC20PausableUpgradeable, 
    ERC20PermitUpgradeable, 
    ERC20VotesUpgradeable, 
    ERC20CappedUpgradeable, 
    AccessControlUpgradeable,
    UUPSUpgradeable 
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the RESURGE token with all required extensions
    /// @param initialAdmin Address that will be granted admin roles initially
    /// @param cap Maximum supply of tokens that can ever be minted
    function initialize(address initialAdmin, uint256 cap) public initializer {
        __ERC20_init("Resurgence Protocol", "RESURGE");
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __ERC20Permit_init("Resurgence Protocol");
        __ERC20Votes_init();
        __ERC20Capped_init(cap);
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(MINTER_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialAdmin);
        _grantRole(TIMELOCK_ROLE, initialAdmin);
    }

    /// @notice Pauses all token transfers - emergency function
    /// @dev Only callable by accounts with PAUSER_ROLE
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Unpauses token transfers
    /// @dev Only callable by accounts with PAUSER_ROLE
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Mints new tokens to specified address
    /// @dev Only callable by accounts with MINTER_ROLE, respects cap limit
    /// @param to Address to mint tokens to
    /// @param amount Amount of tokens to mint
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /// @dev Internal function to authorize an upgrade
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(TIMELOCK_ROLE) {}

    // The following functions are overrides required by Solidity for multiple inheritance.

    function _update(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20PausableUpgradeable, ERC20VotesUpgradeable, ERC20CappedUpgradeable)
    {
        super._update(from, to, amount);
    }

    function nonces(address owner)
        public
        view
        override(ERC20PermitUpgradeable, NoncesUpgradeable)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    /**
     * @dev Gap for future storage variables.
     */
    uint256[50] private __gap;
}
