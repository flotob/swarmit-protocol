// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SwarmitRegistryV3} from "../src/SwarmitRegistryV3.sol";

contract SwarmitRegistryV3Test is Test {
    SwarmitRegistryV3 public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address curator1 = makeAddr("curator1");

    bytes32 techBoardId = keccak256(bytes("tech"));
    bytes32 sportsBoardId = keccak256(bytes("sports"));

    bytes32 sub1 = bytes32(uint256(1));
    bytes32 sub2 = bytes32(uint256(2));
    bytes32 sub3 = bytes32(uint256(3));

    // Feed test fixtures
    bytes32 topic1 = bytes32(uint256(0xaa));
    bytes32 topic2 = bytes32(uint256(0xbb));
    address signer1 = makeAddr("signer1");
    address signer2 = makeAddr("signer2");

    function setUp() public {
        registry = new SwarmitRegistryV3();

        // Register the tech board for most tests
        vm.prank(alice);
        registry.registerBoard("tech", "bzz://boardref");
    }

    // ============================================
    // Slug validation — isValidSlug
    // ============================================

    function test_isValidSlug_acceptsSimple() public view {
        assertTrue(registry.isValidSlug("tech"));
    }

    function test_isValidSlug_acceptsSingleChar() public view {
        assertTrue(registry.isValidSlug("a"));
    }

    function test_isValidSlug_acceptsMaxLength() public view {
        assertTrue(registry.isValidSlug("abcdefghijklmnopqrstuvwxyz012345")); // 32
    }

    function test_isValidSlug_acceptsHyphenated() public view {
        assertTrue(registry.isValidSlug("my-board"));
    }

    function test_isValidSlug_acceptsDigits() public view {
        assertTrue(registry.isValidSlug("board123"));
    }

    function test_isValidSlug_rejectsEmpty() public view {
        assertFalse(registry.isValidSlug(""));
    }

    function test_isValidSlug_rejectsTooLong() public view {
        assertFalse(registry.isValidSlug("abcdefghijklmnopqrstuvwxyz0123456")); // 33
    }

    function test_isValidSlug_rejectsUppercase() public view {
        assertFalse(registry.isValidSlug("Tech"));
    }

    function test_isValidSlug_rejectsUnderscore() public view {
        assertFalse(registry.isValidSlug("my_board"));
    }

    function test_isValidSlug_rejectsSpace() public view {
        assertFalse(registry.isValidSlug("my board"));
    }

    function test_isValidSlug_rejectsLeadingHyphen() public view {
        assertFalse(registry.isValidSlug("-tech"));
    }

    function test_isValidSlug_rejectsTrailingHyphen() public view {
        assertFalse(registry.isValidSlug("tech-"));
    }

    function test_isValidSlug_rejectsConsecutiveHyphens() public view {
        assertFalse(registry.isValidSlug("my--board"));
    }

    // ============================================
    // registerBoard — slug canonicalization
    // ============================================

    function test_registerBoard_emitsEvent() public {
        vm.prank(bob);
        vm.expectEmit(true, false, false, true);
        emit SwarmitRegistryV3.BoardRegistered(sportsBoardId, "sports", "bzz://sportsref", bob);
        registry.registerBoard("sports", "bzz://sportsref");
    }

    function test_registerBoard_derivesBoardIdFromSlug() public {
        vm.prank(bob);
        registry.registerBoard("sports", "bzz://sportsref");
        assertEq(registry.boardGovernance(sportsBoardId), bob);
    }

    function test_registerBoard_rejectsUppercase() public {
        vm.prank(bob);
        vm.expectRevert("invalid slug");
        registry.registerBoard("Tech", "bzz://ref");
    }

    function test_registerBoard_rejectsInvalidSlug() public {
        vm.prank(bob);
        vm.expectRevert("invalid slug");
        registry.registerBoard("-bad", "bzz://ref");
    }

    function test_registerBoard_rejectsEmptySlug() public {
        vm.prank(bob);
        vm.expectRevert("invalid slug");
        registry.registerBoard("", "bzz://ref");
    }

    function test_registerBoard_rejectsEmptyBoardRef() public {
        vm.prank(bob);
        vm.expectRevert("boardRef is required");
        registry.registerBoard("sports", "");
    }

    function test_registerBoard_rejectsDuplicate() public {
        vm.prank(bob);
        vm.expectRevert("board already registered");
        registry.registerBoard("tech", "bzz://otherref");
    }

    function test_registerBoard_storesGovernance() public view {
        assertEq(registry.boardGovernance(techBoardId), alice);
    }

    function test_registerBoard_multipleBoardsWork() public {
        vm.prank(bob);
        registry.registerBoard("sports", "bzz://sportsref");
        assertEq(registry.boardGovernance(sportsBoardId), bob);
        assertEq(registry.boardGovernance(techBoardId), alice);
    }


    // ============================================
    // updateBoardMetadata
    // ============================================

    function test_updateBoardMetadata_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit SwarmitRegistryV3.BoardMetadataUpdated(techBoardId, "bzz://newref");
        registry.updateBoardMetadata(techBoardId, "bzz://newref");
    }

    function test_updateBoardMetadata_revertsNonExistentBoard() public {
        vm.prank(alice);
        vm.expectRevert("board not registered");
        registry.updateBoardMetadata(sportsBoardId, "bzz://ref");
    }

    function test_updateBoardMetadata_revertsNonGovernance() public {
        vm.prank(bob);
        vm.expectRevert("only board governance");
        registry.updateBoardMetadata(techBoardId, "bzz://ref");
    }

    function test_updateBoardMetadata_revertsEmptyBoardRef() public {
        vm.prank(alice);
        vm.expectRevert("boardRef is required");
        registry.updateBoardMetadata(techBoardId, "");
    }

    // ============================================
    // announceSubmission
    // ============================================

    function test_announceSubmission_topLevelPost() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit SwarmitRegistryV3.SubmissionAnnounced(techBoardId, sub1, bytes32(0), sub1, alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);
    }

    function test_announceSubmission_reply() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(bob);
        vm.expectEmit(true, true, false, true);
        emit SwarmitRegistryV3.SubmissionAnnounced(techBoardId, sub2, sub1, sub1, bob);
        registry.announceSubmission(techBoardId, sub2, sub1, sub1);
    }

    function test_announceSubmission_revertsUnregisteredBoard() public {
        vm.prank(alice);
        vm.expectRevert("board not registered");
        registry.announceSubmission(sportsBoardId, sub1, bytes32(0), sub1);
    }

    function test_announceSubmission_revertsZeroSubmissionId() public {
        vm.prank(alice);
        vm.expectRevert("submissionId is required");
        registry.announceSubmission(techBoardId, bytes32(0), bytes32(0), bytes32(0));
    }

    function test_announceSubmission_revertsDuplicate() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);
        vm.prank(bob);
        vm.expectRevert("submission already announced");
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);
    }

    function test_announceSubmission_revertsTopLevelWithWrongRoot() public {
        vm.prank(alice);
        vm.expectRevert("top-level post: root must equal submissionId");
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub2);
    }

    function test_announceSubmission_storesBookkeeping() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);
        assertTrue(registry.submissionExists(sub1));
        assertEq(registry.submissionBoard(sub1), techBoardId);
        assertEq(registry.submissionRoot(sub1), sub1);
    }

    // ============================================
    // setVote
    // ============================================

    function test_setVote_upvote() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(1));
        assertEq(registry.upvoteCount(sub1), 1);
        assertEq(registry.downvoteCount(sub1), 0);
    }

    function test_setVote_downvote() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(-1));
        assertEq(registry.upvoteCount(sub1), 0);
        assertEq(registry.downvoteCount(sub1), 1);
    }

    function test_setVote_flipVote() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(1));
        vm.prank(alice);
        registry.setVote(sub1, int8(-1));
        assertEq(registry.upvoteCount(sub1), 0);
        assertEq(registry.downvoteCount(sub1), 1);
    }

    function test_setVote_clearVote() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(1));
        vm.prank(alice);
        registry.setVote(sub1, int8(0));
        assertEq(registry.upvoteCount(sub1), 0);
        assertEq(registry.downvoteCount(sub1), 0);
    }

    function test_setVote_revertsUnchanged() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(1));
        vm.prank(alice);
        vm.expectRevert("vote unchanged");
        registry.setVote(sub1, int8(1));
    }

    function test_setVote_revertsNonExistent() public {
        vm.prank(alice);
        vm.expectRevert("submission not found");
        registry.setVote(sub1, int8(1));
    }

    function test_setVote_emitsEvent() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit SwarmitRegistryV3.VoteSet(techBoardId, sub1, alice, sub1, int8(1), int8(0), 1, 0);
        registry.setVote(sub1, int8(1));
    }

    function test_setVote_multipleVoters() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(1));
        vm.prank(bob);
        registry.setVote(sub1, int8(1));
        vm.prank(carol);
        registry.setVote(sub1, int8(-1));

        assertEq(registry.upvoteCount(sub1), 2);
        assertEq(registry.downvoteCount(sub1), 1);
    }

    // ============================================
    // voteStats — packed read helper
    // ============================================

    function test_voteStats_returnsCorrectValues() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(1));
        vm.prank(bob);
        registry.setVote(sub1, int8(-1));

        (uint64 up, uint64 down, int8 dir) = registry.voteStats(sub1, alice);
        assertEq(up, 1);
        assertEq(down, 1);
        assertEq(dir, int8(1));

        (up, down, dir) = registry.voteStats(sub1, bob);
        assertEq(up, 1);
        assertEq(down, 1);
        assertEq(dir, int8(-1));
    }

    function test_voteStats_matchesIndividualGetters() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(1));
        vm.prank(bob);
        registry.setVote(sub1, int8(-1));

        (uint64 up, uint64 down, int8 dir) = registry.voteStats(sub1, alice);
        assertEq(up, registry.upvoteCount(sub1));
        assertEq(down, registry.downvoteCount(sub1));
        assertEq(dir, registry.voteOf(sub1, alice));
    }

    function test_voteStats_zeroAddressVoter() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(1));

        (uint64 up, uint64 down, int8 dir) = registry.voteStats(sub1, address(0));
        assertEq(up, 1);
        assertEq(down, 0);
        assertEq(dir, int8(0));
    }

    function test_voteStats_noVotes() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        (uint64 up, uint64 down, int8 dir) = registry.voteStats(sub1, alice);
        assertEq(up, 0);
        assertEq(down, 0);
        assertEq(dir, int8(0));
    }

    // ============================================
    // declareCurator
    // ============================================

    function test_declareCurator_emitsEvent() public {
        vm.prank(curator1);
        vm.expectEmit(true, false, false, true);
        emit SwarmitRegistryV3.CuratorDeclared(curator1, "bzz://profile");
        registry.declareCurator("bzz://profile");
    }

    function test_declareCurator_revertsEmptyRef() public {
        vm.prank(curator1);
        vm.expectRevert("curatorProfileRef is required");
        registry.declareCurator("");
    }

    function test_declareCurator_isPermissionless() public {
        vm.prank(alice);
        registry.declareCurator("bzz://alice-profile");
        vm.prank(bob);
        registry.declareCurator("bzz://bob-profile");
    }

    // ============================================
    // declareUserFeed
    // ============================================

    function test_declareUserFeed_succeeds() public {
        bytes32 expectedId = keccak256(abi.encode(topic1, signer1));

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit SwarmitRegistryV3.UserFeedDeclared(alice, expectedId, topic1, signer1);
        registry.declareUserFeed(topic1, signer1);

        assertTrue(registry.hasUserFeed(alice, expectedId));
    }

    function test_declareUserFeed_duplicateIsNoOp() public {
        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);

        // Second call should succeed silently without emitting
        vm.prank(alice);
        vm.recordLogs();
        registry.declareUserFeed(topic1, signer1);
        assertEq(vm.getRecordedLogs().length, 0);
    }

    function test_declareUserFeed_multipleFeeds() public {
        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);
        vm.prank(alice);
        registry.declareUserFeed(topic2, signer2);

        assertEq(registry.userFeedCount(alice), 2);
    }

    function test_declareUserFeed_rejectsZeroTopic() public {
        vm.prank(alice);
        vm.expectRevert("feedTopic is required");
        registry.declareUserFeed(bytes32(0), signer1);
    }

    function test_declareUserFeed_rejectsZeroOwner() public {
        vm.prank(alice);
        vm.expectRevert("feedOwner is required");
        registry.declareUserFeed(topic1, address(0));
    }

    function test_declareUserFeed_feedIdDerivation() public {
        bytes32 expectedId = keccak256(abi.encode(topic1, signer1));
        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);

        assertTrue(registry.hasUserFeed(alice, expectedId));

        SwarmitRegistryV3.DeclaredUserFeed[] memory feeds = registry.userFeedsOf(alice);
        assertEq(feeds.length, 1);
        assertEq(feeds[0].feedId, expectedId);
        assertEq(feeds[0].feedTopic, topic1);
        assertEq(feeds[0].feedOwner, signer1);
    }

    // ============================================
    // revokeUserFeed
    // ============================================

    function test_revokeUserFeed_succeeds() public {
        bytes32 feedId = keccak256(abi.encode(topic1, signer1));
        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit SwarmitRegistryV3.UserFeedRevoked(alice, feedId, topic1, signer1);
        registry.revokeUserFeed(feedId);

        assertFalse(registry.hasUserFeed(alice, feedId));
        assertEq(registry.userFeedCount(alice), 0);
    }

    function test_revokeUserFeed_revertsIfNotActive() public {
        bytes32 feedId = keccak256(abi.encode(topic1, signer1));
        vm.prank(alice);
        vm.expectRevert("feed not active");
        registry.revokeUserFeed(feedId);
    }

    function test_revokeUserFeed_canRedeclareAfterRevoke() public {
        bytes32 feedId = keccak256(abi.encode(topic1, signer1));
        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);
        vm.prank(alice);
        registry.revokeUserFeed(feedId);

        assertFalse(registry.hasUserFeed(alice, feedId));

        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);
        assertTrue(registry.hasUserFeed(alice, feedId));
    }

    function test_revokeUserFeed_excludesFromUserFeedsOf() public {
        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);
        vm.prank(alice);
        registry.declareUserFeed(topic2, signer2);

        bytes32 feedId1 = keccak256(abi.encode(topic1, signer1));
        vm.prank(alice);
        registry.revokeUserFeed(feedId1);

        SwarmitRegistryV3.DeclaredUserFeed[] memory feeds = registry.userFeedsOf(alice);
        assertEq(feeds.length, 1);
        assertEq(feeds[0].feedTopic, topic2);
        assertEq(feeds[0].feedOwner, signer2);
    }

    // ============================================
    // User feed granular views
    // ============================================

    function test_userFeedIdAt_returnsCorrectId() public {
        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);

        bytes32 expectedId = keccak256(abi.encode(topic1, signer1));
        assertEq(registry.userFeedIdAt(alice, 0), expectedId);
    }

    function test_userFeedIdAt_revertsOutOfBounds() public {
        vm.expectRevert();
        registry.userFeedIdAt(alice, 0);
    }

    function test_userFeedCoordinates_resolvesFeedId() public {
        bytes32 feedId = keccak256(abi.encode(topic1, signer1));
        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);

        (bytes32 t, address o) = registry.userFeedCoordinates(feedId);
        assertEq(t, topic1);
        assertEq(o, signer1);
    }

    function test_userFeedCount_incrementsAndDecrements() public {
        assertEq(registry.userFeedCount(alice), 0);

        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);
        assertEq(registry.userFeedCount(alice), 1);

        vm.prank(alice);
        registry.declareUserFeed(topic2, signer2);
        assertEq(registry.userFeedCount(alice), 2);

        bytes32 feedId1 = keccak256(abi.encode(topic1, signer1));
        vm.prank(alice);
        registry.revokeUserFeed(feedId1);
        assertEq(registry.userFeedCount(alice), 1);
    }

    // ============================================
    // Cross-user isolation
    // ============================================

    function test_feedDeclaration_isolatedPerUser() public {
        vm.prank(alice);
        registry.declareUserFeed(topic1, signer1);
        vm.prank(bob);
        registry.declareUserFeed(topic1, signer1);

        bytes32 feedId = keccak256(abi.encode(topic1, signer1));
        assertTrue(registry.hasUserFeed(alice, feedId));
        assertTrue(registry.hasUserFeed(bob, feedId));

        // Revoking for alice doesn't affect bob
        vm.prank(alice);
        registry.revokeUserFeed(feedId);
        assertFalse(registry.hasUserFeed(alice, feedId));
        assertTrue(registry.hasUserFeed(bob, feedId));
    }
}
