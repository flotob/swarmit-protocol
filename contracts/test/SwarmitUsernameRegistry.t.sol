// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SwarmitUsernameRegistry} from "../src/SwarmitUsernameRegistry.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

contract SwarmitUsernameRegistryTest is Test {
    SwarmitUsernameRegistry public registry;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant BASE_PRICE = 0.001 ether;
    uint256 constant PRICE_STEP = 0.0001 ether;

    function setUp() public {
        registry = new SwarmitUsernameRegistry(BASE_PRICE, PRICE_STEP, owner);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
    }

    // ============================================
    // Helpers
    // ============================================

    function _claim(address user, string memory name) internal returns (uint256) {
        uint256 price = registry.currentMintPrice();
        vm.prank(user);
        return registry.claim{value: price}(name, price);
    }

    // ============================================
    // Name validation
    // ============================================

    function test_rejects_tooShort() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectRevert("name too short");
        registry.claim{value: price}("ab", price);
    }

    function test_rejects_tooLong() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectRevert("name too long");
        registry.claim{value: price}("abcdefghijklmnopqrstuvwxy", price); // 25 chars
    }

    function test_accepts_minLength() public {
        uint256 tokenId = _claim(alice, "abc"); // 3 chars
        assertEq(tokenId, 1);
    }

    function test_accepts_maxLength() public {
        uint256 tokenId = _claim(alice, "abcdefghijklmnopqrstuvwx"); // 24 chars
        assertEq(tokenId, 1);
    }

    function test_rejects_uppercase() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectRevert("invalid character");
        registry.claim{value: price}("Alice", price);
    }

    function test_rejects_invalidChars() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectRevert("invalid character");
        registry.claim{value: price}("al_ice", price);
    }

    function test_rejects_space() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectRevert("invalid character");
        registry.claim{value: price}("al ice", price);
    }

    function test_rejects_leadingHyphen() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectRevert("leading hyphen");
        registry.claim{value: price}("-alice", price);
    }

    function test_rejects_trailingHyphen() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectRevert("trailing hyphen");
        registry.claim{value: price}("alice-", price);
    }

    function test_rejects_consecutiveHyphens() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectRevert("consecutive hyphens");
        registry.claim{value: price}("al--ice", price);
    }

    function test_accepts_validHyphenated() public {
        uint256 tokenId = _claim(alice, "cool-name");
        assertEq(tokenId, 1);
    }

    function test_accepts_digits() public {
        uint256 tokenId = _claim(alice, "user123");
        assertEq(tokenId, 1);
    }

    function test_accepts_hyphenAndDigits() public {
        uint256 tokenId = _claim(alice, "a1-b2-c3");
        assertEq(tokenId, 1);
    }

    // ============================================
    // Claiming
    // ============================================

    function test_firstClaim_succeeds() public {
        uint256 tokenId = _claim(alice, "alice");
        assertEq(tokenId, 1);
        assertEq(registry.ownerOf(1), alice);
    }

    function test_duplicateName_reverts() public {
        _claim(alice, "alice");
        uint256 price = registry.currentMintPrice();
        vm.prank(bob);
        vm.expectRevert("name already claimed");
        registry.claim{value: price}("alice", price);
    }

    function test_underpay_reverts() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectRevert("insufficient payment");
        registry.claim{value: price - 1}("alice", price);
    }

    function test_maxPriceBelowCurrent_reverts() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectRevert("price exceeds maxPrice");
        registry.claim{value: price}("alice", price - 1);
    }

    function test_chargedPrice_equalsCurrentMintPrice() public {
        uint256 priceBefore = registry.currentMintPrice();
        uint256 balanceBefore = alice.balance;
        uint256 overpay = 1 ether;

        vm.prank(alice);
        registry.claim{value: priceBefore + overpay}("alice", priceBefore + overpay);

        // Alice should only have been charged the actual price (rest refunded)
        assertEq(balanceBefore - alice.balance, priceBefore);
    }

    function test_overpay_refundsDifference() public {
        uint256 price = registry.currentMintPrice();
        uint256 overpay = 0.5 ether;
        uint256 balanceBefore = alice.balance;

        vm.prank(alice);
        registry.claim{value: price + overpay}("alice", price + overpay);

        assertEq(balanceBefore - alice.balance, price);
    }

    function test_tokenId_incrementsSequentially() public {
        uint256 id1 = _claim(alice, "alice");
        uint256 id2 = _claim(bob, "bob");
        uint256 id3 = _claim(carol, "carol");
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    function test_claim_emitsUsernameClaimed() public {
        uint256 price = registry.currentMintPrice();
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit SwarmitUsernameRegistry.UsernameClaimed(alice, 1, "alice", price);
        registry.claim{value: price}("alice", price);
    }

    function test_isAvailable_trueBeforeClaim() public view {
        assertTrue(registry.isAvailable("alice"));
    }

    function test_isAvailable_falseAfterClaim() public {
        _claim(alice, "alice");
        assertFalse(registry.isAvailable("alice"));
    }

    function test_nameOfToken_returnsName() public {
        _claim(alice, "alice");
        assertEq(registry.nameOfToken(1), "alice");
    }

    function test_nameOfToken_revertsForNonexistent() public {
        vm.expectRevert();
        registry.nameOfToken(999);
    }

    // ============================================
    // Pricing
    // ============================================

    function test_currentMintPrice_equalsBaseBeforeFirstMint() public view {
        assertEq(registry.currentMintPrice(), BASE_PRICE);
    }

    function test_price_followsLinearFormula() public {
        assertEq(registry.currentMintPrice(), BASE_PRICE + 0 * PRICE_STEP);
        _claim(alice, "alice");
        assertEq(registry.currentMintPrice(), BASE_PRICE + 1 * PRICE_STEP);
        _claim(bob, "bob");
        assertEq(registry.currentMintPrice(), BASE_PRICE + 2 * PRICE_STEP);
        _claim(carol, "carol");
        assertEq(registry.currentMintPrice(), BASE_PRICE + 3 * PRICE_STEP);
    }

    // ============================================
    // Primary-name behavior
    // ============================================

    function test_firstMint_autoSetsPrimary() public {
        _claim(alice, "alice");
        assertEq(registry.primaryTokenOf(alice), 1);
        assertEq(registry.primaryNameOf(alice), "alice");
    }

    function test_laterMint_doesNotOverwritePrimary() public {
        _claim(alice, "alice");
        _claim(alice, "alice2");
        assertEq(registry.primaryTokenOf(alice), 1);
        assertEq(registry.primaryNameOf(alice), "alice");
    }

    function test_setPrimaryName_worksForOwner() public {
        _claim(alice, "alice");
        _claim(alice, "alice2");

        vm.prank(alice);
        registry.setPrimaryName(2);

        assertEq(registry.primaryTokenOf(alice), 2);
        assertEq(registry.primaryNameOf(alice), "alice2");
    }

    function test_setPrimaryName_nonOwner_reverts() public {
        _claim(alice, "alice");
        vm.prank(bob);
        vm.expectRevert("not token owner");
        registry.setPrimaryName(1);
    }

    function test_primaryNameOf_returnsEmpty_whenNoneSet() public view {
        assertEq(registry.primaryNameOf(alice), "");
    }

    function test_setPrimaryName_emitsPrimaryNameSet() public {
        _claim(alice, "alice");
        _claim(alice, "alice2");

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit SwarmitUsernameRegistry.PrimaryNameSet(alice, 2, "alice2");
        registry.setPrimaryName(2);
    }

    function test_mintPath_doesNotTriggerTransferClearingLogic() public {
        // First mint sets primary via claim()
        _claim(alice, "alice");
        assertEq(registry.primaryTokenOf(alice), 1);

        // Second mint should NOT clear the primary (mint from == address(0), not a transfer)
        _claim(alice, "alice2");
        assertEq(registry.primaryTokenOf(alice), 1);
        assertEq(registry.primaryNameOf(alice), "alice");
    }

    // ============================================
    // Transfer behavior
    // ============================================

    function test_transfer_clearsSenderPrimary_ifPrimaryTransferred() public {
        _claim(alice, "alice");
        assertEq(registry.primaryTokenOf(alice), 1);

        vm.prank(alice);
        registry.transferFrom(alice, bob, 1);

        assertEq(registry.primaryTokenOf(alice), 0);
        assertEq(registry.primaryNameOf(alice), "");
    }

    function test_transfer_autoSetsRecipientPrimary_ifNone() public {
        _claim(alice, "alice");

        vm.prank(alice);
        registry.transferFrom(alice, bob, 1);

        assertEq(registry.primaryTokenOf(bob), 1);
        assertEq(registry.primaryNameOf(bob), "alice");
    }

    function test_transfer_doesNotOverwriteRecipientPrimary() public {
        _claim(alice, "alice");
        _claim(bob, "bob");

        vm.prank(alice);
        registry.transferFrom(alice, bob, 1);

        // Bob's primary should still be his own original token
        assertEq(registry.primaryTokenOf(bob), 2);
        assertEq(registry.primaryNameOf(bob), "bob");
    }

    function test_transfer_senderKeepsPrimary_ifNonPrimaryTransferred() public {
        _claim(alice, "alice");
        _claim(alice, "alice2");
        assertEq(registry.primaryTokenOf(alice), 1);

        // Transfer token 2 (not alice's primary)
        vm.prank(alice);
        registry.transferFrom(alice, bob, 2);

        // Alice's primary should remain unchanged
        assertEq(registry.primaryTokenOf(alice), 1);
        assertEq(registry.primaryNameOf(alice), "alice");
    }

    function test_primaryNameOf_followsOwnership() public {
        _claim(alice, "alice");
        assertEq(registry.primaryNameOf(alice), "alice");
        assertEq(registry.primaryNameOf(bob), "");

        vm.prank(alice);
        registry.transferFrom(alice, bob, 1);

        assertEq(registry.primaryNameOf(alice), "");
        assertEq(registry.primaryNameOf(bob), "alice");
    }

    // ============================================
    // Withdraw
    // ============================================

    function test_withdraw_ownerCanWithdraw() public {
        _claim(alice, "alice");
        uint256 contractBalance = address(registry).balance;
        assertGt(contractBalance, 0);

        uint256 ownerBalanceBefore = owner.balance;
        vm.prank(owner);
        registry.withdraw(payable(owner));

        assertEq(address(registry).balance, 0);
        assertEq(owner.balance, ownerBalanceBefore + contractBalance);
    }

    function test_withdraw_nonOwner_reverts() public {
        _claim(alice, "alice");
        vm.prank(alice);
        vm.expectRevert();
        registry.withdraw(payable(alice));
    }

    function test_withdraw_nothingToWithdraw_reverts() public {
        vm.prank(owner);
        vm.expectRevert("nothing to withdraw");
        registry.withdraw(payable(owner));
    }

    function test_withdraw_toArbitraryAddress() public {
        _claim(alice, "alice");
        address payable recipient = payable(makeAddr("recipient"));
        uint256 contractBalance = address(registry).balance;

        vm.prank(owner);
        registry.withdraw(recipient);

        assertEq(recipient.balance, contractBalance);
    }

    // ============================================
    // tokenURI
    // ============================================

    function test_tokenURI_returnsExpectedBase64Payload() public {
        _claim(alice, "alice");
        string memory uri = registry.tokenURI(1);

        string memory expectedJson = '{"name":"@alice","description":"Swarmit username: alice"}';
        string memory expected = string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(expectedJson))
        ));
        assertEq(uri, expected);
    }

    function test_tokenURI_revertsForNonexistent() public {
        vm.expectRevert();
        registry.tokenURI(999);
    }

    // ============================================
    // ERC721 basics
    // ============================================

    function test_name() public view {
        assertEq(registry.name(), "Swarmit Username");
    }

    function test_symbol() public view {
        assertEq(registry.symbol(), "SWARMU");
    }

}
