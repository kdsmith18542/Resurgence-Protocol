// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../contracts/ResurgeToken.sol";
import "../../contracts/RewardDistributor.sol";
import "../../contracts/NonEvmStakingPool.sol";

/// @title DormancyOracleE2E — End-to-end test: wallet registration → dormancy proof → RESURGE mint
contract DormancyOracleE2ETest is Test {
    ResurgeToken public token;
    RewardDistributor public distributor;
    NonEvmStakingPool public stakingPool;

    address public timelock = address(0x1000);
    address public oracle = address(0x2000);
    address public staker = address(0x3000);
    address public otherStaker = address(0x4000);

    bytes32 constant BTC_CHAIN = bytes32(uint256(1));
    string constant BTC_WALLET = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
    uint256 constant DORMANT_SINCE = 500_000;
    uint256 constant CURRENT_BLOCK = 526_280;
    uint256 constant THRESHOLD = 26_280;
    uint256 constant REWARD_AMOUNT = 1000 ether;
    bytes32 constant CHRONO_PUBKEY = bytes32(uint256(0xdeadbeef));

    function setUp() public {
        // 1. Deploy ResurgeToken
        token = ResurgeToken(address(new ERC1967Proxy(
            address(new ResurgeToken()),
            abi.encodeWithSelector(ResurgeToken.initialize.selector, timelock, 1_000_000_000 ether)
        )));

        // 2. Deploy RewardDistributor
        distributor = RewardDistributor(address(new ERC1967Proxy(
            address(new RewardDistributor()),
            abi.encodeWithSelector(
                RewardDistributor.initialize.selector,
                address(token),
                500_000_000 ether,
                timelock
            )
        )));

        // 3. Deploy NonEvmStakingPool
        stakingPool = NonEvmStakingPool(address(new ERC1967Proxy(
            address(new NonEvmStakingPool()),
            abi.encodeWithSelector(NonEvmStakingPool.initialize.selector, timelock)
        )));

        // 4. Wire roles
        vm.startPrank(timelock);
        token.grantRole(token.MINTER_ROLE(), address(distributor));
        distributor.setNonEvmRewardAmount(REWARD_AMOUNT);
        distributor.grantRole(distributor.DORMANCY_ORACLE_ROLE(), oracle);
        vm.stopPrank();
    }

    /// @notice Verify legacy submitDormancyProof reverts with LegacyPathDeactivated
    function testLegacyDormancyFlowDeactivated() public {
        vm.prank(staker);
        stakingPool.registerWallet(BTC_CHAIN, BTC_WALLET);

        vm.prank(oracle);
        vm.expectRevert(RewardDistributor.RewardDistributor_LegacyPathDeactivated.selector);
        distributor.submitDormancyProof(
            BTC_CHAIN,
            staker,
            DORMANT_SINCE,
            CURRENT_BLOCK,
            THRESHOLD,
            CHRONO_PUBKEY,
            hex"deadbeef"
        );
    }

    /// @notice Unauthorized oracle cannot submit proofs
    function testUnauthorizedOracleCannotSubmit() public {
        vm.prank(address(0x9999));
        vm.expectRevert();
        distributor.submitDormancyProof(
            BTC_CHAIN, staker, DORMANT_SINCE,
            CURRENT_BLOCK, THRESHOLD, CHRONO_PUBKEY, ""
        );
    }
}
