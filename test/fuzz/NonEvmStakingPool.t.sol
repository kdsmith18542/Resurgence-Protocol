// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../contracts/NonEvmStakingPool.sol";

contract NonEvmStakingPoolTest is Test {
    NonEvmStakingPool public pool;

    address public admin = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);

    bytes32 constant BTC = bytes32(uint256(1));
    bytes32 constant DOGE = bytes32(uint256(2));
    string constant BTC_WALLET = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
    string constant BTC_WALLET_2 = "1CounterpartyXXXXXXXXXXXXXXXUWLpVr";
    string constant DOGE_WALLET = "D8dmoFzRbnFePQgTXgLfAzSjr7yuezkJGN";

    event WalletRegistered(
        bytes32 indexed chainId,
        bytes32 indexed walletHash,
        string wallet,
        address indexed staker,
        uint256 registeredAt
    );
    event WalletUnregistered(
        bytes32 indexed chainId,
        bytes32 indexed walletHash,
        string wallet,
        address indexed staker
    );

    function setUp() public {
        NonEvmStakingPool impl = new NonEvmStakingPool();
        bytes memory initData = abi.encodeWithSelector(
            NonEvmStakingPool.initialize.selector,
            admin
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        pool = NonEvmStakingPool(address(proxy));
    }

    function testInitialState() public {
        assertTrue(pool.hasRole(pool.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(pool.hasRole(pool.TIMELOCK_ROLE(), admin));
    }

    function testRegisterWallet() public {
        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        address staker = pool.getStaker(BTC, BTC_WALLET);
        assertEq(staker, user1);
        assertTrue(pool.isRegistered(BTC, BTC_WALLET));
    }

    function testRegisterWalletEvent() public {
        bytes32 expectedHash = keccak256(abi.encodePacked(BTC_WALLET));

        vm.expectEmit(true, true, true, true);
        emit WalletRegistered(BTC, expectedHash, BTC_WALLET, user1, block.timestamp);

        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);
    }

    function testRegisterMultipleChains() public {
        vm.startPrank(user1);
        pool.registerWallet(BTC, BTC_WALLET);
        pool.registerWallet(DOGE, DOGE_WALLET);
        vm.stopPrank();

        assertEq(pool.getStaker(BTC, BTC_WALLET), user1);
        assertEq(pool.getStaker(DOGE, DOGE_WALLET), user1);
    }

    function testRegisterDifferentUsers() public {
        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        vm.prank(user2);
        pool.registerWallet(DOGE, DOGE_WALLET);

        assertEq(pool.getStaker(BTC, BTC_WALLET), user1);
        assertEq(pool.getStaker(DOGE, DOGE_WALLET), user2);
    }

    function testCannotRegisterSameWallet() public {
        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        vm.prank(user2);
        vm.expectRevert(NonEvmStakingPool.NonEvmStakingPool_AlreadyRegistered.selector);
        pool.registerWallet(BTC, BTC_WALLET);
    }

    function testCannotRegisterEmptyWallet() public {
        vm.prank(user1);
        vm.expectRevert(NonEvmStakingPool.NonEvmStakingPool_InvalidInput.selector);
        pool.registerWallet(BTC, "");
    }

    function testUnregisterWallet() public {
        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        vm.prank(user1);
        pool.unregisterWallet(BTC, BTC_WALLET);

        assertFalse(pool.isRegistered(BTC, BTC_WALLET));
        assertEq(pool.getStaker(BTC, BTC_WALLET), address(0));
    }

    function testUnregisterEvent() public {
        bytes32 expectedHash = keccak256(abi.encodePacked(BTC_WALLET));

        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        vm.expectEmit(true, true, true, true);
        emit WalletUnregistered(BTC, expectedHash, BTC_WALLET, user1);

        vm.prank(user1);
        pool.unregisterWallet(BTC, BTC_WALLET);
    }

    function testCannotUnregisterOtherUsersWallet() public {
        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        vm.prank(user2);
        vm.expectRevert(NonEvmStakingPool.NonEvmStakingPool_NotOwner.selector);
        pool.unregisterWallet(BTC, BTC_WALLET);
    }

    function testCannotUnregisterNotRegistered() public {
        vm.prank(user1);
        vm.expectRevert(NonEvmStakingPool.NonEvmStakingPool_NotRegistered.selector);
        pool.unregisterWallet(BTC, BTC_WALLET);
    }

    function testGetStakerNotFound() public {
        assertEq(pool.getStaker(BTC, "unknown_wallet"), address(0));
    }

    function testGetRegistration() public {
        uint256 before = block.timestamp;

        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        (address staker, uint64 registeredAt, bool active) = pool.getRegistration(BTC, BTC_WALLET);

        assertEq(staker, user1);
        assertTrue(active);
        assertGe(registeredAt, before);
        assertLe(registeredAt, block.timestamp);
    }

    function testIsStakerOwner() public {
        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        assertTrue(pool.isStakerOwner(user1, BTC, BTC_WALLET));
        assertFalse(pool.isStakerOwner(user2, BTC, BTC_WALLET));
    }

    function testPausePreventsRegistration() public {
        vm.prank(admin);
        pool.pause();

        vm.prank(user1);
        vm.expectRevert();
        pool.registerWallet(BTC, BTC_WALLET);
    }

    function testPauseDoesNotBlockUnregister() public {
        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        vm.prank(admin);
        pool.pause();

        // unregisterWallet does NOT have whenNotPaused — always allowed
        vm.prank(user1);
        pool.unregisterWallet(BTC, BTC_WALLET);
        assertFalse(pool.isRegistered(BTC, BTC_WALLET));
    }

    function testMultipleUsersDifferentWallets() public {
        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        vm.prank(user2);
        pool.registerWallet(BTC, BTC_WALLET_2);

        assertEq(pool.getStaker(BTC, BTC_WALLET), user1);
        assertEq(pool.getStaker(BTC, BTC_WALLET_2), user2);
    }

    function testReRegisterAfterUnregister() public {
        vm.prank(user1);
        pool.registerWallet(BTC, BTC_WALLET);

        vm.prank(user1);
        pool.unregisterWallet(BTC, BTC_WALLET);

        // Same user or different user can register it again
        vm.prank(user2);
        pool.registerWallet(BTC, BTC_WALLET);

        assertEq(pool.getStaker(BTC, BTC_WALLET), user2);
    }
}
