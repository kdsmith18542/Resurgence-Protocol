// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

contract ResurgeToken is AccessControl, ERC20Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint256 public immutable MAX_SUPPLY;
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        address rewardDistributor,
        address timelock
    ) ERC20(name, symbol) ERC20Pausable() {
        MAX_SUPPLY = maxSupply;
        
        // Setup initial admin roles
        _grantRole(DEFAULT_ADMIN_ROLE, timelock);
        _grantRole(PAUSER_ROLE, timelock);
        
        // Grant MINTER_ROLE to RewardDistributor
        _grantRole(MINTER_ROLE, rewardDistributor);
        
        // Set role admin for MINTER_ROLE and PAUSER_ROLE to DEFAULT_ADMIN_ROLE
        _setRoleAdmin(MINTER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(PAUSER_ROLE, DEFAULT_ADMIN_ROLE);
    }
    
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "ResurgeToken: cannot exceed max supply");
        _mint(to, amount);
    }
    
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // The following functions are overrides required by Solidity for multiple inheritance.

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20Pausable)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
