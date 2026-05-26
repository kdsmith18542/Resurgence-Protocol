// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/SP1Verifier.sol";
import "../contracts/RewardDistributor.sol";
import "../contracts/ResurgeToken.sol";

/// @title MockSP1Verifier - Mock SP1 Groth16 verifier for testing
contract MockSP1Verifier is ISP1Verifier {
    /// @dev In tests, we accept any proof format
    function verify(bytes calldata, bytes calldata) external pure override returns (bool) {
        return true;
    }

    function verifyProof(bytes calldata, bytes calldata, bytes32) external pure override returns (bool) {
        return true;
    }
}

/// @title SP1VerifierTest - Test suite for SP1DormancyVerifier contract
contract SP1VerifierTest is Test {
    SP1DormancyVerifier verifier;
    MockSP1Verifier mockSP1;
    bytes32 programId = bytes32(uint256(0x1234567890abcdef));

    function setUp() public {
        mockSP1 = new MockSP1Verifier();
        verifier = new SP1DormancyVerifier(address(mockSP1), programId);
    }

    function test_VerifierInitialization() public {
        assertEq(address(verifier.sp1Verifier()), address(mockSP1));
        assertEq(verifier.dormancyProgramId(), programId);
        assertEq(verifier.owner(), address(this));
    }

    function test_VerifyDormancyProof() public {
        bytes memory proof = hex"deadbeef";
        bytes memory publicInputs = hex"cafebabe";
        bytes32 chainId = bytes32(uint256(1));
        string memory addr = "1A1z7agoat";
        uint64 dormantSince = 100000;
        uint64 current = 850000;
        uint64 threshold = 26280;

        bytes32 proofHash = verifier.verifyDormancyProof(
            proof,
            publicInputs,
            chainId,
            addr,
            dormantSince,
            current,
            threshold
        );

        // Verify the proof hash is computed correctly
        bytes32 expectedHash = keccak256(abi.encodePacked(
            chainId,
            addr,
            dormantSince,
            current,
            threshold
        ));
        assertEq(proofHash, expectedHash);

        // Verify the proof is marked as verified
        assertTrue(verifier.isProofVerified(
            chainId,
            addr,
            dormantSince,
            current,
            threshold
        ));
    }

    function test_ProofAlreadyVerifiedRevert() public {
        bytes memory proof = hex"deadbeef";
        bytes memory publicInputs = hex"cafebabe";
        bytes32 chainId = bytes32(uint256(1));
        string memory addr = "1A1z7agoat";
        uint64 dormantSince = 100000;
        uint64 current = 850000;
        uint64 threshold = 26280;

        // Verify the proof once
        verifier.verifyDormancyProof(
            proof,
            publicInputs,
            chainId,
            addr,
            dormantSince,
            current,
            threshold
        );

        // Attempt to verify the same proof again should revert
        vm.expectRevert(SP1DormancyVerifier.SP1DormancyVerifier_ProofAlreadyVerified.selector);
        verifier.verifyDormancyProof(
            proof,
            publicInputs,
            chainId,
            addr,
            dormantSince,
            current,
            threshold
        );
    }

    function test_UpdateSP1Verifier() public {
        address newVerifier = address(new MockSP1Verifier());
        verifier.setSP1Verifier(newVerifier);
        assertEq(address(verifier.sp1Verifier()), newVerifier);
    }

    function test_UpdateDormancyProgramId() public {
        bytes32 newProgramId = bytes32(uint256(0xfedcba9876543210));
        verifier.setDormancyProgramId(newProgramId);
        assertEq(verifier.dormancyProgramId(), newProgramId);
    }

    function test_OnlyOwnerCanUpdate() public {
        address notOwner = address(0x1234567890123456789012345678901234567890);
        vm.prank(notOwner);
        vm.expectRevert(SP1DormancyVerifier.SP1DormancyVerifier_UnauthorizedCaller.selector);
        verifier.setSP1Verifier(address(mockSP1));
    }

    function test_TransferOwnership() public {
        address newOwner = address(0xdeadbeef);
        verifier.transferOwnership(newOwner);
        assertEq(verifier.owner(), newOwner);
    }
}

/// @title RewardDistributorSP1Test - Test suite for SP1 integration in RewardDistributor
contract RewardDistributorSP1Test is Test {
    RewardDistributor distributor;
    ResurgeToken token;
    SP1DormancyVerifier sp1Verifier;
    MockSP1Verifier mockSP1;
    address timelock = address(0x1111111111111111111111111111111111111111);
    address owner = address(this);
    bytes32 programId = bytes32(uint256(0x1234567890abcdef));

    function setUp() public {
        token = new ResurgeToken();
        distributor = new RewardDistributor();
        mockSP1 = new MockSP1Verifier();
        sp1Verifier = new SP1DormancyVerifier(address(mockSP1), programId);

        distributor.initialize(address(token), 1000000e18, timelock);

        // Grant necessary roles
        distributor.grantRole(distributor.SP1_VERIFIER_ROLE(), address(this));
        distributor.setSP1DormancyVerifier(address(sp1Verifier));
        distributor.setSP1RewardAmount(1000e18);

        // Mint initial tokens to distributor
        token.mint(address(distributor), 1000000e18);
    }

    function test_VerifyAndMint() public {
        bytes memory proof = hex"deadbeef";
        bytes memory publicInputs = hex"cafebabe";
        bytes32 chainId = bytes32(uint256(1));
        string memory addr = "1A1z7agoat";
        uint64 dormantSince = 100000;
        uint64 current = 850000;
        uint64 threshold = 26280;
        address evmWallet = address(0xdeadbeef);

        uint256 balanceBefore = token.balanceOf(evmWallet);

        bytes32 proofHash = distributor.verifyAndMint(
            proof,
            publicInputs,
            chainId,
            addr,
            dormantSince,
            current,
            threshold,
            evmWallet
        );

        uint256 balanceAfter = token.balanceOf(evmWallet);
        assertEq(balanceAfter - balanceBefore, 1000e18);
        assertNotEq(proofHash, bytes32(0));
    }

    function test_VerifyAndMintProofAlreadyProcessed() public {
        bytes memory proof = hex"deadbeef";
        bytes memory publicInputs = hex"cafebabe";
        bytes32 chainId = bytes32(uint256(1));
        string memory addr = "1A1z7agoat";
        uint64 dormantSince = 100000;
        uint64 current = 850000;
        uint64 threshold = 26280;
        address evmWallet = address(0xdeadbeef);

        // Mint once
        distributor.verifyAndMint(
            proof,
            publicInputs,
            chainId,
            addr,
            dormantSince,
            current,
            threshold,
            evmWallet
        );

        // Attempt to mint same proof again
        vm.expectRevert(RewardDistributor.RewardDistributor_ProofAlreadyProcessed.selector);
        distributor.verifyAndMint(
            proof,
            publicInputs,
            chainId,
            addr,
            dormantSince,
            current,
            threshold,
            evmWallet
        );
    }

    function test_VerifyAndMintUnauthorized() public {
        address unauthorized = address(0x9999999999999999999999999999999999999999);
        bytes memory proof = hex"deadbeef";
        bytes memory publicInputs = hex"cafebabe";

        vm.prank(unauthorized);
        vm.expectRevert();
        distributor.verifyAndMint(
            proof,
            publicInputs,
            bytes32(uint256(1)),
            "1A1z7agoat",
            100000,
            850000,
            26280,
            address(0xdeadbeef)
        );
    }

    function test_VerifyAndMintExceedsMaxSupply() public {
        // Create a new distributor with very low max supply
        RewardDistributor smallDistributor = new RewardDistributor();
        smallDistributor.initialize(address(token), 1e18, timelock);
        smallDistributor.grantRole(smallDistributor.SP1_VERIFIER_ROLE(), address(this));
        smallDistributor.setSP1DormancyVerifier(address(sp1Verifier));
        smallDistributor.setSP1RewardAmount(1000e18); // More than max supply

        bytes memory proof = hex"deadbeef";
        bytes memory publicInputs = hex"cafebabe";

        vm.expectRevert(RewardDistributor.RewardDistributor_ExceedsMaxSupply.selector);
        smallDistributor.verifyAndMint(
            proof,
            publicInputs,
            bytes32(uint256(1)),
            "1A1z7agoat",
            100000,
            850000,
            26280,
            address(0xdeadbeef)
        );
    }

    function test_SetSP1RewardAmount() public {
        distributor.setSP1RewardAmount(5000e18);
        // We can't directly read sp1RewardAmount as it's internal, but we can verify via mint
    }

    function test_SetSP1DormancyVerifier() public {
        MockSP1Verifier newMockSP1 = new MockSP1Verifier();
        SP1DormancyVerifier newVerifier = new SP1DormancyVerifier(address(newMockSP1), programId);
        
        vm.prank(timelock);
        distributor.setSP1DormancyVerifier(address(newVerifier));
    }
}

/// @title E2EPhase7Test - End-to-end test for Phase 7 SP1 integration
contract E2EPhase7Test is Test {
    RewardDistributor distributor;
    ResurgeToken token;
    SP1DormancyVerifier sp1Verifier;
    MockSP1Verifier mockSP1;
    address timelock = address(0x1111111111111111111111111111111111111111);
    bytes32 programId = bytes32(uint256(0x1234567890abcdef));

    function setUp() public {
        token = new ResurgeToken();
        distributor = new RewardDistributor();
        mockSP1 = new MockSP1Verifier();
        sp1Verifier = new SP1DormancyVerifier(address(mockSP1), programId);

        distributor.initialize(address(token), 1000000e18, timelock);
        distributor.grantRole(distributor.SP1_VERIFIER_ROLE(), address(this));
        distributor.setSP1DormancyVerifier(address(sp1Verifier));
        distributor.setSP1RewardAmount(1000e18);
        token.mint(address(distributor), 1000000e18);
    }

    function test_FullSP1Workflow() public {
        // Simulate complete SP1 workflow:
        // 1. ChronoNode generates SP1 proof off-chain
        // 2. Proof is submitted to verify endpoint
        // 3. Verifier validates the proof
        // 4. RewardDistributor mints RESURGE to EVM wallet

        address evmWallet = address(0x201624cBa366250D08bCdA95e6eF64151687A447);
        bytes memory zkProof = hex"deadbeefdeadbeefdeadbeef"; // Simulated SP1 proof
        bytes memory publicInputs = hex"cafebabecafebabecafebabe"; // Simulated public values
        
        bytes32 chainId = keccak256("bitcoin");
        string memory btcAddress = "1A1z7agoat";
        uint64 dormantSince = 100000;
        uint64 current = 850000;
        uint64 threshold = 26280;

        // Step 1: Verify proof and mint
        bytes32 proofHash = distributor.verifyAndMint(
            zkProof,
            publicInputs,
            chainId,
            btcAddress,
            dormantSince,
            current,
            threshold,
            evmWallet
        );

        // Verify results
        assertEq(token.balanceOf(evmWallet), 1000e18);
        assertNotEq(proofHash, bytes32(0));

        // Step 2: Verify proof is marked as processed
        assertTrue(sp1Verifier.isProofVerified(
            chainId,
            btcAddress,
            dormantSince,
            current,
            threshold
        ));

        // Step 3: Attempt replay should fail
        vm.expectRevert(RewardDistributor.RewardDistributor_ProofAlreadyProcessed.selector);
        distributor.verifyAndMint(
            zkProof,
            publicInputs,
            chainId,
            btcAddress,
            dormantSince,
            current,
            threshold,
            evmWallet
        );
    }

    function test_MultipleIndependentProofs() public {
        // Test that different dormancy proofs can be verified independently
        address wallet1 = address(0x1111111111111111111111111111111111111111);
        address wallet2 = address(0x2222222222222222222222222222222222222222);

        bytes32 chainId1 = keccak256("bitcoin");
        bytes32 chainId2 = keccak256("dogecoin");

        // First proof
        distributor.verifyAndMint(
            hex"deadbeef01",
            hex"cafebabe01",
            chainId1,
            "1A1z7agoat",
            100000,
            850000,
            26280,
            wallet1
        );

        // Second proof (different address and chain)
        distributor.verifyAndMint(
            hex"deadbeef02",
            hex"cafebabe02",
            chainId2,
            "DFundooostash7QQQq",
            50000,
            500000,
            50000,
            wallet2
        );

        // Both wallets received rewards
        assertEq(token.balanceOf(wallet1), 1000e18);
        assertEq(token.balanceOf(wallet2), 1000e18);
    }
}
