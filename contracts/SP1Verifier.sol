// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ISP1Verifier - Interface for SP1 Groth16 proof verification
/// @notice Standard interface for SP1 verifiers on EVM chains
interface ISP1Verifier {
    /// @notice Verifies an SP1 Groth16 proof
    /// @param proof The Groth16 proof bytes
    /// @param publicValues The public values/commitments from the proof
    /// @return valid True if the proof is valid, false otherwise
    function verify(bytes calldata proof, bytes calldata publicValues) external view returns (bool);
    
    /// @notice Verifies an SP1 Groth16 proof with a specific program ID
    /// @param proof The Groth16 proof bytes
    /// @param publicValues The public values/commitments from the proof
    /// @param programId The program ID that was used to generate the proof
    /// @return valid True if the proof is valid, false otherwise
    function verifyProof(bytes calldata proof, bytes calldata publicValues, bytes32 programId) external view returns (bool);
}

/// @title SP1DormancyVerifier - Verifies SP1 Groth16 dormancy proofs
/// @notice Implements SP1 proof verification for non-EVM dormancy oracle
/// @dev Deployed on Arbitrum Sepolia testnet and mainnet for Resurgence Protocol
contract SP1DormancyVerifier {
    /// @notice Reference to the SP1 Groth16 verifier contract
    ISP1Verifier public sp1Verifier;
    
    /// @notice Program ID for the dormancy calculation guest program
    /// @dev This is the hash of the compiled SP1 ELF program (chrononode-zkvm-program)
    bytes32 public dormancyProgramId;
    
    /// @notice Cached list of verified proof hashes (prevents re-verification)
    mapping(bytes32 => bool) public verifiedProofs;
    
    /// @notice Emitted when a dormancy proof is verified
    event DormancyProofVerified(
        bytes32 indexed proofHash,
        bytes32 indexed chainId,
        string indexed address,
        uint64 dormantSinceBlock,
        uint64 currentBlock,
        uint64 thresholdBlocks
    );
    
    /// @notice Emitted when SP1 verifier is updated
    event SP1VerifierUpdated(address indexed newVerifier);
    
    /// @notice Emitted when dormancy program ID is updated
    event DormancyProgramIdUpdated(bytes32 indexed newProgramId);
    
    /// @notice Custom errors
    error SP1DormancyVerifier_InvalidProof();
    error SP1DormancyVerifier_InvalidProgramId();
    error SP1DormancyVerifier_ProofAlreadyVerified();
    error SP1DormancyVerifier_VerifierNotSet();
    error SP1DormancyVerifier_UnauthorizedCaller();

    address public owner;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "SP1DormancyVerifier_UnauthorizedCaller");
        _;
    }

    /// @notice Initializes the SP1DormancyVerifier
    /// @param _sp1Verifier Address of the SP1 Groth16 verifier contract
    /// @param _dormancyProgramId Program ID for the dormancy guest program
    constructor(address _sp1Verifier, bytes32 _dormancyProgramId) {
        require(_sp1Verifier != address(0), "SP1DormancyVerifier_InvalidVerifier");
        sp1Verifier = ISP1Verifier(_sp1Verifier);
        dormancyProgramId = _dormancyProgramId;
        owner = msg.sender;
    }

    /// @notice Verifies an SP1 Groth16 dormancy proof
    /// @param proof Hex-encoded SP1 Groth16 proof bytes
    /// @param publicInputs Hex-encoded public inputs from the proof (commitments)
    /// @param chainId The blockchain chain ID (e.g., "bitcoin", "dogecoin")
    /// @param address The watched address that is claimed dormant
    /// @param dormantSinceBlock The block height when dormancy window started
    /// @param currentBlock The current block height
    /// @param thresholdBlocks The minimum dormancy window required
    /// @return proofHash The keccak256 hash of the proof for tracking
    function verifyDormancyProof(
        bytes calldata proof,
        bytes calldata publicInputs,
        bytes32 chainId,
        string calldata address,
        uint64 dormantSinceBlock,
        uint64 currentBlock,
        uint64 thresholdBlocks
    ) external returns (bytes32 proofHash) {
        if (address(sp1Verifier) == address(0)) revert SP1DormancyVerifier_VerifierNotSet();
        
        // Verify the SP1 proof
        bool valid = sp1Verifier.verifyProof(proof, publicInputs, dormancyProgramId);
        if (!valid) revert SP1DormancyVerifier_InvalidProof();
        
        // Compute proof hash for deduplication
        proofHash = keccak256(abi.encodePacked(
            chainId,
            address,
            dormantSinceBlock,
            currentBlock,
            thresholdBlocks
        ));
        
        // Prevent re-verification of same proof
        if (verifiedProofs[proofHash]) revert SP1DormancyVerifier_ProofAlreadyVerified();
        verifiedProofs[proofHash] = true;
        
        emit DormancyProofVerified(
            proofHash,
            chainId,
            address,
            dormantSinceBlock,
            currentBlock,
            thresholdBlocks
        );
        
        return proofHash;
    }

    /// @notice Checks if a dormancy proof has already been verified
    /// @param chainId The blockchain chain ID
    /// @param address The watched address
    /// @param dormantSinceBlock Block when dormancy started
    /// @param currentBlock Current block height
    /// @param thresholdBlocks Dormancy threshold
    /// @return True if the proof has been verified
    function isProofVerified(
        bytes32 chainId,
        string calldata address,
        uint64 dormantSinceBlock,
        uint64 currentBlock,
        uint64 thresholdBlocks
    ) external view returns (bool) {
        bytes32 proofHash = keccak256(abi.encodePacked(
            chainId,
            address,
            dormantSinceBlock,
            currentBlock,
            thresholdBlocks
        ));
        return verifiedProofs[proofHash];
    }

    /// @notice Updates the SP1 Groth16 verifier contract address
    /// @dev Only callable by owner (or could be governance in production)
    /// @param newVerifier Address of the new SP1 verifier
    function setSP1Verifier(address newVerifier) external onlyOwner {
        require(newVerifier != address(0), "SP1DormancyVerifier_InvalidVerifier");
        sp1Verifier = ISP1Verifier(newVerifier);
        emit SP1VerifierUpdated(newVerifier);
    }

    /// @notice Updates the dormancy program ID
    /// @dev Only callable by owner; must be updated if the guest program changes
    /// @param newProgramId The new program ID (hash of compiled ELF)
    function setDormancyProgramId(bytes32 newProgramId) external onlyOwner {
        require(newProgramId != bytes32(0), "SP1DormancyVerifier_InvalidProgramId");
        dormancyProgramId = newProgramId;
        emit DormancyProgramIdUpdated(newProgramId);
    }

    /// @notice Transfers ownership to a new address
    /// @param newOwner Address of the new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "SP1DormancyVerifier_InvalidOwner");
        owner = newOwner;
    }
}
