// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../contracts/RewardDistributor.sol";
import "../../contracts/ResurgeToken.sol";

contract DormancyOracleTest is Test {
    RewardDistributor distributor;
    ResurgeToken token;

    address admin = address(0x1);
    address oracle = address(0x2);
    address emergencyPauser = address(0x3);
    address dormantWallet = address(0x4);
    address unauthorized = address(0x5);

    bytes32 constant CHAIN_ID = bytes32(uint256(1)); // bitcoin
    uint256 constant DORMANT_SINCE = 500_000;
    uint256 constant CURRENT_BLOCK = 526_280;
    uint256 constant THRESHOLD = 26_280;
    bytes32 constant CHRONO_PUBKEY = bytes32(uint256(0xdead));
    uint256 constant REWARD_AMOUNT = 1000 ether;

    function setUp() public {
        // Deploy ResurgeToken via UUPS proxy
        ResurgeToken tokenImpl = new ResurgeToken();
        bytes memory tokenInitData = abi.encodeWithSelector(
            ResurgeToken.initialize.selector,
            admin,
            1_000_000_000 ether
        );
        ERC1967Proxy tokenProxy = new ERC1967Proxy(address(tokenImpl), tokenInitData);
        token = ResurgeToken(address(tokenProxy));

        // Deploy RewardDistributor via UUPS proxy
        RewardDistributor impl = new RewardDistributor();
        bytes memory initData = abi.encodeWithSelector(
            RewardDistributor.initialize.selector,
            address(token),
            500_000_000 ether,
            admin
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        distributor = RewardDistributor(address(proxy));

        vm.startPrank(admin);
        distributor.grantRole(distributor.TIMELOCK_ROLE(), admin);
        distributor.grantRole(distributor.EMERGENCY_PAUSER(), emergencyPauser);
        distributor.grantRole(distributor.DORMANCY_ORACLE_ROLE(), oracle);
        distributor.setNonEvmRewardAmount(REWARD_AMOUNT);
        vm.stopPrank();

        bytes32 minterRole = token.MINTER_ROLE();
        vm.prank(admin);
        token.grantRole(minterRole, address(distributor));
    }

    function testOracleRoleAssigned() public {
        assertTrue(distributor.hasRole(distributor.DORMANCY_ORACLE_ROLE(), oracle));
        assertFalse(distributor.hasRole(distributor.DORMANCY_ORACLE_ROLE(), unauthorized));
    }

    function testSetNonEvmRewardAmount() public {
        vm.prank(admin);
        distributor.setNonEvmRewardAmount(500 ether);
        assertEq(distributor.nonEvmRewardAmount(), 500 ether);
    }

    function testSetNonEvmRewardAmountUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        distributor.setNonEvmRewardAmount(500 ether);
    }

    function testSubmitDormancyProofUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        distributor.submitDormancyProof(
            CHAIN_ID, dormantWallet, DORMANT_SINCE,
            CURRENT_BLOCK, THRESHOLD, CHRONO_PUBKEY, ""
        );
    }

    function testSubmitDormancyProofDeactivated() public {
        vm.prank(oracle);
        vm.expectRevert(RewardDistributor.RewardDistributor_LegacyPathDeactivated.selector);
        distributor.submitDormancyProof(
            CHAIN_ID, dormantWallet, DORMANT_SINCE,
            CURRENT_BLOCK, THRESHOLD, CHRONO_PUBKEY, ""
        );
    }
}
