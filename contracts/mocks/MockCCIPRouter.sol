// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

interface ICCIPReceiver {
    function ccipReceive(Client.Any2EVMMessage calldata message) external;
}

/// @title MockCCIPRouter - Minimal CCIP router stub for Hardhat unit tests
/// @dev Emits MessageSent on ccipSend; allows tests to manually deliver messages to a receiver
contract MockCCIPRouter {
    uint256 private _msgCounter;

    event MessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        bytes receiver,
        bytes data,
        address feeToken,
        uint256 fee
    );

    mapping(uint64 => bool) public supportedChains;

    function setSupportedChain(uint64 chainSelector, bool supported) external {
        supportedChains[chainSelector] = supported;
    }

    function isChainSupported(uint64 destChainSelector) external view returns (bool) {
        return supportedChains[destChainSelector];
    }

    function getFee(
        uint64,
        Client.EVM2AnyMessage memory
    ) external pure returns (uint256) {
        return 0.1 ether; // Fixed mock fee (0.1 LINK equivalent)
    }

    function ccipSend(
        uint64 destinationChainSelector,
        Client.EVM2AnyMessage calldata message
    ) external payable returns (bytes32 messageId) {
        messageId = keccak256(abi.encode(block.timestamp, _msgCounter++, destinationChainSelector, message.data));
        emit MessageSent(
            messageId,
            destinationChainSelector,
            message.receiver,
            message.data,
            message.feeToken,
            0.1 ether
        );
    }

    /// @notice Test helper: simulate message delivery from a spoke to a hub receiver
    function deliverMessage(
        address receiver,
        bytes32 messageId,
        uint64 sourceChainSelector,
        bytes calldata sender,
        bytes calldata data
    ) external {
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: messageId,
            sourceChainSelector: sourceChainSelector,
            sender: sender,
            data: data,
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
        ICCIPReceiver(receiver).ccipReceive(message);
    }
}
