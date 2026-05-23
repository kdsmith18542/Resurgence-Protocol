// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../contracts/ResurgeToken.sol";
import "../../contracts/RewardDistributor.sol";
import "../../contracts/MockOracle.sol";
import "../../contracts/ResurgenceTimelockController.sol";

contract RewardDistributorFuzzTest is Test {
    ResurgeToken public token;
    RewardDistributor public distributor;
    MockOracle public oracle;
    ResurgenceTimelockController public timelock;

    address public admin = address(0x1000);
    address public pool = address(0x2000);
    address public receiver = address(0x3000);

    uint256 constant INITIAL_CAP = 1_000_000_000 ether;
    uint256 constant MAX_MINT = 500_000_000 ether;

    function setUp() public {
        vm.startPrank(admin);
        
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = admin;
        executors[0] = admin;
        timelock = new ResurgenceTimelockController(3600, proposers, executors, admin);

        token = ResurgeToken(address(new ERC1967Proxy(
            address(new ResurgeToken()),
            abi.encodeWithSelector(ResurgeToken.initialize.selector, admin, INITIAL_CAP)
        )));

        distributor = RewardDistributor(address(new ERC1967Proxy(
            address(new RewardDistributor()),
            abi.encodeWithSelector(RewardDistributor.initialize.selector, address(token), MAX_MINT, address(timelock))
        )));
        
        oracle = new MockOracle(5000000, 8);
        
        distributor.grantRole(distributor.TIMELOCK_ROLE(), admin);
        distributor.setPriceOracle(address(oracle), 3600);
        distributor.authorizeStakingPool(pool);
        
        token.grantRole(token.MINTER_ROLE(), address(distributor));
        
        vm.stopPrank();
    }

    function testFuzz_MintAndDistributeSupplyCap(uint256 amount) public {
        amount = bound(amount, 1, MAX_MINT);
        
        vm.prank(pool);
        bool success = distributor.mintAndDistribute(receiver, amount);
        
        assertTrue(success);
        assertEq(token.balanceOf(receiver), amount);
        assertEq(distributor.totalResurgeMinted(), amount);
    }

    function testFuzz_MintAboveSupplyCap(uint256 amount) public {
        amount = bound(amount, MAX_MINT + 1, type(uint256).max / 2);
        
        vm.prank(pool);
        vm.expectRevert(); // RewardDistributor_SupplyCapReached
        distributor.mintAndDistribute(receiver, amount);
    }

    function testFuzz_OracleMultiplier(uint256 price) public {
        // Price in 8 decimals. Base is $0.05 (5,000,000)
        price = bound(price, 1, 1_000_000_000); // Up to $10.00
        
        oracle.setPrice(int256(price), 8);
        
        uint256 multiplier = distributor.getEmissionMultiplier();
        
        if (price <= 5000000) {
            assertEq(multiplier, 10000); // 1x
        } else if (price >= 15000000) {
            assertEq(multiplier, 20000); // 2x cap
        } else {
            // 10% per $0.01 above $0.05 (multiplies before dividing for precision)
            uint256 expected = 10000 + ((price - 5000000) * 1000) / 1000000;
            assertEq(multiplier, expected);
        }
    }

    function testFuzz_UnauthorizedPool(address attacker, uint256 amount) public {
        vm.assume(attacker != pool && attacker != admin);
        amount = bound(amount, 1, 1000 ether);
        
        vm.prank(attacker);
        vm.expectRevert(); // RewardDistributor_NotAuthorized
        distributor.mintAndDistribute(receiver, amount);
    }
}
