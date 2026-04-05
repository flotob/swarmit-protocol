// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SwarmitRegistryV2} from "../src/SwarmitRegistryV2.sol";

contract SwarmitRegistryV2Test is Test {
    SwarmitRegistryV2 public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address curator1 = makeAddr("curator1");

    bytes32 techBoardId = keccak256(bytes("tech"));
    bytes32 sportsBoardId = keccak256(bytes("sports"));

    bytes32 sub1 = bytes32(uint256(1));
    bytes32 sub2 = bytes32(uint256(2));
    bytes32 sub3 = bytes32(uint256(3));

    function setUp() public {
        registry = new SwarmitRegistryV2();

        // Register the tech board for most tests
        vm.prank(alice);
        registry.registerBoard(techBoardId, "tech", "bzz://boardref");
    }

    // ============================================
    // registerBoard
    // ============================================

    function test_registerBoard_emitsEvent() public {
        vm.prank(bob);
        vm.expectEmit(true, false, false, true);
        emit SwarmitRegistryV2.BoardRegistered(sportsBoardId, "sports", "bzz://sportsref", bob);
        registry.registerBoard(sportsBoardId, "sports", "bzz://sportsref");
    }

    function test_registerBoard_storesGovernance() public {
        assertEq(registry.boardGovernance(techBoardId), alice);
    }

    function test_registerBoard_revertsDuplicate() public {
        vm.prank(bob);
        vm.expectRevert("board already registered");
        registry.registerBoard(techBoardId, "tech", "bzz://boardref2");
    }

    function test_registerBoard_revertsEmptySlug() public {
        vm.expectRevert("slug is required");
        registry.registerBoard(techBoardId, "", "bzz://boardref");
    }

    function test_registerBoard_revertsEmptyBoardRef() public {
        vm.expectRevert("boardRef is required");
        registry.registerBoard(techBoardId, "tech", "");
    }

    function test_registerBoard_revertsMismatchedBoardId() public {
        vm.expectRevert("boardId must equal keccak256(slug)");
        registry.registerBoard(bytes32(uint256(999)), "tech", "bzz://boardref");
    }

    // ============================================
    // updateBoardMetadata
    // ============================================

    function test_updateBoardMetadata_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit SwarmitRegistryV2.BoardMetadataUpdated(techBoardId, "bzz://boardref2");
        registry.updateBoardMetadata(techBoardId, "bzz://boardref2");
    }

    function test_updateBoardMetadata_revertsNonGovernance() public {
        vm.prank(bob);
        vm.expectRevert("only board governance");
        registry.updateBoardMetadata(techBoardId, "bzz://boardref2");
    }

    function test_updateBoardMetadata_revertsUnregisteredBoard() public {
        vm.expectRevert("board not registered");
        registry.updateBoardMetadata(sportsBoardId, "bzz://ref");
    }

    function test_updateBoardMetadata_revertsEmptyRef() public {
        vm.prank(alice);
        vm.expectRevert("boardRef is required");
        registry.updateBoardMetadata(techBoardId, "");
    }

    // ============================================
    // announceSubmission — basics
    // ============================================

    function test_announceSubmission_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit SwarmitRegistryV2.SubmissionAnnounced(
            techBoardId, sub1, bytes32(0), sub1, alice
        );
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);
    }

    function test_announceSubmission_persistsBookkeeping() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        assertTrue(registry.submissionExists(sub1));
        assertEq(registry.submissionBoard(sub1), techBoardId);
        assertEq(registry.submissionRoot(sub1), sub1);
    }

    function test_announceSubmission_revertsDuplicate() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(bob);
        vm.expectRevert("submission already announced");
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);
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

    // ============================================
    // announceSubmission — sentinel rules
    // ============================================

    function test_announceSubmission_revertsTopLevelWithWrongRoot() public {
        vm.prank(alice);
        vm.expectRevert("top-level post: root must equal submissionId");
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub2);
    }

    function test_announceSubmission_revertsReplyWithZeroRoot() public {
        vm.prank(alice);
        vm.expectRevert("reply: root must be non-zero");
        registry.announceSubmission(techBoardId, sub2, sub1, bytes32(0));
    }

    // ============================================
    // announceSubmission — reply bookkeeping
    // ============================================

    function test_announceSubmission_replyStoresBoardAndRoot() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);

        vm.prank(bob);
        registry.announceSubmission(techBoardId, sub2, sub1, sub1);

        assertTrue(registry.submissionExists(sub2));
        assertEq(registry.submissionBoard(sub2), techBoardId);
        assertEq(registry.submissionRoot(sub2), sub1);
    }

    function test_announceSubmission_nestedReplyStoresCorrectRoot() public {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);
        vm.prank(bob);
        registry.announceSubmission(techBoardId, sub2, sub1, sub1);
        vm.prank(carol);
        registry.announceSubmission(techBoardId, sub3, sub2, sub1);

        assertEq(registry.submissionRoot(sub3), sub1);
        assertEq(registry.submissionBoard(sub3), techBoardId);
    }

    function test_announceSubmission_isPermissionless() public {
        vm.prank(bob);
        registry.announceSubmission(techBoardId, sub1, bytes32(0), sub1);
        assertTrue(registry.submissionExists(sub1));
    }

    // ============================================
    // declareCurator
    // ============================================

    function test_declareCurator_emitsEvent() public {
        vm.prank(curator1);
        vm.expectEmit(true, false, false, true);
        emit SwarmitRegistryV2.CuratorDeclared(curator1, "bzz://curatorprofile");
        registry.declareCurator("bzz://curatorprofile");
    }

    function test_declareCurator_isPermissionless() public {
        vm.prank(alice);
        registry.declareCurator("bzz://profile-alice");
        vm.prank(bob);
        registry.declareCurator("bzz://profile-bob");
    }

    function test_declareCurator_revertsEmptyRef() public {
        vm.expectRevert("curatorProfileRef is required");
        registry.declareCurator("");
    }

    // ============================================
    // setVote — upvote from zero
    // ============================================

    function test_setVote_upvoteFromZero() public {
        _announcePost(sub1);

        vm.prank(bob);
        registry.setVote(sub1, int8(1));

        assertEq(registry.voteOf(sub1, bob), int8(1));
        assertEq(registry.upvoteCount(sub1), 1);
        assertEq(registry.downvoteCount(sub1), 0);
    }

    // ============================================
    // setVote — downvote from zero
    // ============================================

    function test_setVote_downvoteFromZero() public {
        _announcePost(sub1);

        vm.prank(bob);
        registry.setVote(sub1, int8(-1));

        assertEq(registry.voteOf(sub1, bob), int8(-1));
        assertEq(registry.upvoteCount(sub1), 0);
        assertEq(registry.downvoteCount(sub1), 1);
    }

    // ============================================
    // setVote — flips
    // ============================================

    function test_setVote_flipUpToDown() public {
        _announcePost(sub1);

        vm.prank(bob);
        registry.setVote(sub1, int8(1));
        vm.prank(bob);
        registry.setVote(sub1, int8(-1));

        assertEq(registry.voteOf(sub1, bob), int8(-1));
        assertEq(registry.upvoteCount(sub1), 0);
        assertEq(registry.downvoteCount(sub1), 1);
    }

    function test_setVote_flipDownToUp() public {
        _announcePost(sub1);

        vm.prank(bob);
        registry.setVote(sub1, int8(-1));
        vm.prank(bob);
        registry.setVote(sub1, int8(1));

        assertEq(registry.voteOf(sub1, bob), int8(1));
        assertEq(registry.upvoteCount(sub1), 1);
        assertEq(registry.downvoteCount(sub1), 0);
    }

    // ============================================
    // setVote — clear
    // ============================================

    function test_setVote_clearUpvote() public {
        _announcePost(sub1);

        vm.prank(bob);
        registry.setVote(sub1, int8(1));
        vm.prank(bob);
        registry.setVote(sub1, int8(0));

        assertEq(registry.voteOf(sub1, bob), int8(0));
        assertEq(registry.upvoteCount(sub1), 0);
        assertEq(registry.downvoteCount(sub1), 0);
    }

    function test_setVote_clearDownvote() public {
        _announcePost(sub1);

        vm.prank(bob);
        registry.setVote(sub1, int8(-1));
        vm.prank(bob);
        registry.setVote(sub1, int8(0));

        assertEq(registry.voteOf(sub1, bob), int8(0));
        assertEq(registry.upvoteCount(sub1), 0);
        assertEq(registry.downvoteCount(sub1), 0);
    }

    // ============================================
    // setVote — rejections
    // ============================================

    function test_setVote_revertsUnknownSubmission() public {
        vm.prank(bob);
        vm.expectRevert("submission not found");
        registry.setVote(sub1, int8(1));
    }

    function test_setVote_revertsNoOpUpvote() public {
        _announcePost(sub1);

        vm.prank(bob);
        registry.setVote(sub1, int8(1));

        vm.prank(bob);
        vm.expectRevert("vote unchanged");
        registry.setVote(sub1, int8(1));
    }

    function test_setVote_revertsNoOpDownvote() public {
        _announcePost(sub1);

        vm.prank(bob);
        registry.setVote(sub1, int8(-1));

        vm.prank(bob);
        vm.expectRevert("vote unchanged");
        registry.setVote(sub1, int8(-1));
    }

    function test_setVote_revertsClearWithNoVote() public {
        _announcePost(sub1);

        vm.prank(bob);
        vm.expectRevert("vote unchanged");
        registry.setVote(sub1, int8(0));
    }

    function test_setVote_revertsInvalidDirection() public {
        _announcePost(sub1);

        vm.prank(bob);
        vm.expectRevert("invalid direction");
        registry.setVote(sub1, int8(2));
    }

    function test_setVote_revertsInvalidNegativeDirection() public {
        _announcePost(sub1);

        vm.prank(bob);
        vm.expectRevert("invalid direction");
        registry.setVote(sub1, int8(-2));
    }

    // ============================================
    // setVote — VoteSet event
    // ============================================

    function test_setVote_emitsEventOnUpvote() public {
        _announcePost(sub1);

        vm.prank(bob);
        vm.expectEmit(true, true, true, true);
        emit SwarmitRegistryV2.VoteSet(
            techBoardId, sub1, bob, sub1,
            int8(1), int8(0), uint64(1), uint64(0)
        );
        registry.setVote(sub1, int8(1));
    }

    function test_setVote_emitsEventOnFlip() public {
        _announcePost(sub1);

        vm.prank(bob);
        registry.setVote(sub1, int8(1));

        vm.prank(bob);
        vm.expectEmit(true, true, true, true);
        emit SwarmitRegistryV2.VoteSet(
            techBoardId, sub1, bob, sub1,
            int8(-1), int8(1), uint64(0), uint64(1)
        );
        registry.setVote(sub1, int8(-1));
    }

    function test_setVote_emitsEventOnClear() public {
        _announcePost(sub1);

        vm.prank(bob);
        registry.setVote(sub1, int8(1));

        vm.prank(bob);
        vm.expectEmit(true, true, true, true);
        emit SwarmitRegistryV2.VoteSet(
            techBoardId, sub1, bob, sub1,
            int8(0), int8(1), uint64(0), uint64(0)
        );
        registry.setVote(sub1, int8(0));
    }

    // ============================================
    // setVote — reply vote event
    // ============================================

    function test_setVote_replyEmitsCorrectRootAndBoard() public {
        _announcePost(sub1);
        vm.prank(bob);
        registry.announceSubmission(techBoardId, sub2, sub1, sub1);

        vm.prank(carol);
        vm.expectEmit(true, true, true, true);
        emit SwarmitRegistryV2.VoteSet(
            techBoardId, sub2, carol, sub1,
            int8(1), int8(0), uint64(1), uint64(0)
        );
        registry.setVote(sub2, int8(1));
    }

    // ============================================
    // setVote — multi-voter
    // ============================================

    function test_setVote_multipleVotersAggregate() public {
        _announcePost(sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(1));
        vm.prank(bob);
        registry.setVote(sub1, int8(1));
        vm.prank(carol);
        registry.setVote(sub1, int8(-1));

        assertEq(registry.upvoteCount(sub1), 2);
        assertEq(registry.downvoteCount(sub1), 1);
        assertEq(registry.voteOf(sub1, alice), int8(1));
        assertEq(registry.voteOf(sub1, bob), int8(1));
        assertEq(registry.voteOf(sub1, carol), int8(-1));
    }

    function test_setVote_voterStatesAreIndependent() public {
        _announcePost(sub1);

        vm.prank(alice);
        registry.setVote(sub1, int8(1));
        vm.prank(bob);
        registry.setVote(sub1, int8(-1));

        vm.prank(alice);
        registry.setVote(sub1, int8(0));

        assertEq(registry.voteOf(sub1, alice), int8(0));
        assertEq(registry.voteOf(sub1, bob), int8(-1));
        assertEq(registry.upvoteCount(sub1), 0);
        assertEq(registry.downvoteCount(sub1), 1);
    }

    // ============================================
    // Helpers
    // ============================================

    function _announcePost(bytes32 submissionId) internal {
        vm.prank(alice);
        registry.announceSubmission(techBoardId, submissionId, bytes32(0), submissionId);
    }
}
