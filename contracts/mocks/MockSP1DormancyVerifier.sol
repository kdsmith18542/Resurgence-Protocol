// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockSP1DormancyVerifier {
    mapping(bytes32 => bool) public verifiedProofs;
    
    function verifyDormancyProof(
        bytes calldata /* proof */,
        bytes calldata /* publicInputs */,
        bytes32 chainId,
        string calldata walletAddress,
        uint64 dormantSinceBlock,
        uint64 currentBlock,
        uint64 thresholdBlocks
    ) external returns (bytes32) {
        bytes32 proofHash = keccak256(abi.encodePacked(
            chainId,
            walletAddress,
            dormantSinceBlock,
            currentBlock,
            thresholdBlocks
        ));
        verifiedProofs[proofHash] = true;
        return proofHash;
    }
}
