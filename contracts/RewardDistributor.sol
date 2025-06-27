// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./ResurgenceProtocol.sol";

contract RewardDistributor is AccessControl, Pausable {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant EMERGENCY_PAUSER = keccak256("EMERGENCY_PAUSER");
    
    ResurgenceProtocol public resurgenceToken;
    uint256 public totalResurgeMinted;
    uint256 public maxMintSupply;
    mapping(address => bool) public authorizedStakingPools;

    event TokensMintedAndDistributed(address indexed to, uint256 amount);
    event MaxMintSupplyUpdated(uint256 newMaxSupply);
    event StakingPoolAuthorized(address indexed stakingPool);
    event StakingPoolUnauthorized(address indexed stakingPool);
    event DebugLog(string message, address addr, uint256 value1, uint256 value2, uint256 value3);
    event DebugLogString(string message);

    constructor(
        address _resurgenceTokenAddress, 
        uint256 _initialMaxMintSupply,
        address _timelock
    ) {
        resurgenceToken = ResurgenceProtocol(_resurgenceTokenAddress);
        maxMintSupply = _initialMaxMintSupply;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(EMERGENCY_PAUSER, _timelock);
    }

    function authorizeStakingPool(address _stakingPool) public onlyRole(TIMELOCK_ROLE) whenNotPaused {
        require(_stakingPool != address(0), "Invalid address");
        authorizedStakingPools[_stakingPool] = true;
        emit StakingPoolAuthorized(_stakingPool);
    }

    function unauthorizeStakingPool(address _stakingPool) public onlyRole(TIMELOCK_ROLE) whenNotPaused {
        require(_stakingPool != address(0), "Invalid address");
        authorizedStakingPools[_stakingPool] = false;
        emit StakingPoolUnauthorized(_stakingPool);
    }

    function mintAndDistribute(address _to, uint256 _amount) public whenNotPaused returns (bool) {
        emit DebugLog("Starting mintAndDistribute", msg.sender, _amount, 0, 0);
        
        // Check if caller is authorized
        bool isAuthorized = authorizedStakingPools[msg.sender];
        emit DebugLog("Authorization check", msg.sender, isAuthorized ? 1 : 0, 0, 0);
        require(isAuthorized, "Caller is not an authorized staking pool");
        
        // Check supply limits
        uint256 newTotalMinted = totalResurgeMinted + _amount;
        bool withinSupplyLimit = newTotalMinted <= maxMintSupply;
        emit DebugLog("Supply check", _to, newTotalMinted, maxMintSupply, withinSupplyLimit ? 1 : 0);
        require(withinSupplyLimit, "Minting would exceed max supply");
        
        // Get current balance for verification
        uint256 balanceBefore = resurgenceToken.balanceOf(_to);
        emit DebugLog("Balance before mint", _to, balanceBefore, 0, 0);
        
        // Try to mint with detailed error handling
        try resurgenceToken.mint(_to, _amount) {
            totalResurgeMinted = newTotalMinted;
            emit TokensMintedAndDistributed(_to, _amount);
            emit DebugLog("Successfully minted", _to, _amount, totalResurgeMinted, 0);
            
            // Verify the tokens were actually minted
            uint256 balanceAfter = resurgenceToken.balanceOf(_to);
            uint256 actualMinted = balanceAfter - balanceBefore;
            emit DebugLog("Balance after mint", _to, balanceAfter, actualMinted, 0);
            
            if (actualMinted != _amount) {
                emit DebugLog("Minting amount mismatch", _to, _amount, actualMinted, 0);
                return false;
            }
            
            return true;
        } catch Error(string memory reason) {
            emit DebugLog("Minting failed with error", _to, _amount, 0, 0);
            emit DebugLogString(reason);
            
            // Additional debug for minter role
            bytes32 minterRole = resurgenceToken.MINTER_ROLE();
            bool hasMinterRole = resurgenceToken.hasRole(minterRole, address(this));
            bytes32 minterRoleAdmin = resurgenceToken.getRoleAdmin(minterRole);
            emit DebugLog("Minter role check", address(this), hasMinterRole ? 1 : 0, 0, 0);
            emit DebugLog("MINTER_ROLE admin", address(0), uint256(minterRoleAdmin), 0, 0);
            
            return false;
        } catch (bytes memory) {
            emit DebugLog("Minting failed with unknown error", _to, _amount, 0, 0);
            return false;
        }
    }

    function setMaxMintSupply(uint256 _newMaxSupply) public onlyRole(TIMELOCK_ROLE) whenNotPaused {
        maxMintSupply = _newMaxSupply;
        emit MaxMintSupplyUpdated(_newMaxSupply);
    }

    function pause() public onlyRole(EMERGENCY_PAUSER) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}