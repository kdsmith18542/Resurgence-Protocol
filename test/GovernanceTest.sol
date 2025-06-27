// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/ResurgenceGovernance.sol";
import "../contracts/ResurgenceTimelockController.sol";
import "../contracts/ResurgeToken.sol";

contract GovernanceTest is Test {
    ResurgeToken token;
    ResurgenceTimelockController timelock;
    ResurgenceGovernance governor;
    
    address admin = address(0x1);
    address voter1 = address(0x2);
    address voter2 = address(0x3);
    
    function setUp() public {
        // Deploy contracts
        token = new ResurgeToken();
        
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = admin;
        executors[0] = admin;
        
        timelock = new ResurgenceTimelockController(3600, proposers, executors, admin);
        
        governor = new ResurgenceGovernance(
            token,
            timelock,
            1, // voting delay
            50400, // voting period (1 week in blocks)
            4 // quorum (4%)
        );
        
        // Setup roles
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(governor));
        
        // Distribute tokens to voters
        token.transfer(voter1, 1000 ether);
        token.transfer(voter2, 2000 ether);
    }
    
    function testProposalCreation() public {
        vm.startPrank(admin);
        
        address[] memory targets = new address[](1);
        targets[0] = address(token);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(token.transfer.selector, voter1, 100 ether);
        
        string memory description = "Transfer tokens to voter1";
        
        uint256 proposalId = governor.propose(targets, values, calldatas, description);
        
        // Check proposal state
        assertEq(uint256(governor.state(proposalId)), uint256(Governor.ProposalState.Pending));
        
        vm.stopPrank();
    }
    
    function testVoting() public {
        // Create proposal
        vm.startPrank(admin);
        address[] memory targets = new address[](1);
        targets[0] = address(token);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(token.transfer.selector, voter1, 100 ether);
        uint256 proposalId = governor.propose(targets, values, calldatas, "Transfer tokens");
        vm.stopPrank();
        
        // Vote with voter1
        vm.roll(block.number + governor.votingDelay() + 1);
        vm.startPrank(voter1);
        governor.castVote(proposalId, 1); // 1 = For
        vm.stopPrank();
        
        // Check vote count
        (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = governor.proposalVotes(proposalId);
        assertEq(forVotes, token.getVotes(voter1));
    }
    
    function testProposalExecution() public {
        // Create and pass proposal
        vm.startPrank(admin);
        address[] memory targets = new address[](1);
        targets[0] = address(token);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(token.transfer.selector, voter1, 100 ether);
        uint256 proposalId = governor.propose(targets, values, calldatas, "Transfer tokens");
        vm.stopPrank();
        
        // Vote
        vm.roll(block.number + governor.votingDelay() + 1);
        vm.startPrank(voter1);
        governor.castVote(proposalId, 1);
        vm.stopPrank();
        
        // Execute
        vm.roll(block.number + governor.votingPeriod() + 1);
        vm.startPrank(admin);
        governor.execute(targets, values, calldatas, keccak256(bytes("Transfer tokens")));
        vm.stopPrank();
        
        // Check execution
        assertEq(token.balanceOf(voter1), 1100 ether); // Initial 1000 + 100 from proposal
    }
    
    function testQuorum() public {
        // Create proposal
        vm.startPrank(admin);
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        uint256 proposalId = governor.propose(targets, values, calldatas, "Test quorum");
        vm.stopPrank();
        
        // Check quorum
        uint256 blockNumber = block.number + governor.votingDelay() + 1;
        uint256 quorum = governor.quorum(blockNumber);
        
        // 4% of total supply (3000 tokens)
        assertEq(quorum, 120 ether);
    }
}
