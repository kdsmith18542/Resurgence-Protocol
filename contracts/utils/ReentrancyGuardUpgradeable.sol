// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StorageSlot} from "@openzeppelin/contracts/utils/StorageSlot.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @dev Upgradeable reentrancy guard using the same ERC-7201 namespaced storage slot
 * as OZ v5's ReentrancyGuard, ensuring storage layout compatibility and proxy safety.
 */
abstract contract ReentrancyGuardUpgradeable is Initializable {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    error ReentrancyGuardReentrantCall();

    function __ReentrancyGuard_init() internal onlyInitializing {
        REENTRANCY_GUARD_STORAGE.getUint256Slot().value = NOT_ENTERED;
    }

    modifier nonReentrant() {
        if (REENTRANCY_GUARD_STORAGE.getUint256Slot().value == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }
        REENTRANCY_GUARD_STORAGE.getUint256Slot().value = ENTERED;
        _;
        REENTRANCY_GUARD_STORAGE.getUint256Slot().value = NOT_ENTERED;
    }

    function _reentrancyGuardEntered() internal view returns (bool) {
        return REENTRANCY_GUARD_STORAGE.getUint256Slot().value == ENTERED;
    }
}
