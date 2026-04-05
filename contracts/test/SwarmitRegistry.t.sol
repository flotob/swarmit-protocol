// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SwarmitRegistry} from "../src/SwarmitRegistry.sol";

contract SwarmitRegistryTest is Test {
    SwarmitRegistry public registry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address curator1 = makeAddr("curator1");

    bytes32 techBoardId = keccak256(bytes("tech"));
    bytes32 sportsBoardId = keccak256(bytes("sports"));

    function setUp() public {
        registry = new SwarmitRegistry();
    }

    // ============================================
    // registerBoard
    // ============================================

    function test_registerBoard_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit SwarmitRegistry.BoardRegistered(techBoardId, "tech", "bzz://boardref", alice);
        registry.registerBoard(techBoardId, "tech", "bzz://boardref");
    }

    function test_registerBoard_storesGovernance() public {
        vm.prank(alice);
        registry.registerBoard(techBoardId, "tech", "bzz://boardref");
        assertEq(registry.boardGovernance(techBoardId), alice);
    }

    function test_registerBoard_revertsDuplicateBoardId() public {
        vm.prank(alice);
        registry.registerBoard(techBoardId, "tech", "bzz://boardref");

        vm.prank(bob);
        vm.expectRevert("board already registered");
        registry.registerBoard(techBoardId, "tech", "bzz://boardref2");
    }

    function test_registerBoard_revertsEmptySlug() public {
        vm.prank(alice);
        vm.expectRevert("slug is required");
        registry.registerBoard(techBoardId, "", "bzz://boardref");
    }

    function test_registerBoard_revertsEmptyBoardRef() public {
        vm.prank(alice);
        vm.expectRevert("boardRef is required");
        registry.registerBoard(techBoardId, "tech", "");
    }

    function test_registerBoard_revertsMismatchedBoardId() public {
        vm.prank(alice);
        vm.expectRevert("boardId must equal keccak256(slug)");
        registry.registerBoard(bytes32(uint256(999)), "tech", "bzz://boardref");
    }

    function test_registerBoard_multipleBoardsWork() public {
        vm.prank(alice);
        registry.registerBoard(techBoardId, "tech", "bzz://tech-ref");
        vm.prank(bob);
        registry.registerBoard(sportsBoardId, "sports", "bzz://sports-ref");

        assertEq(registry.boardGovernance(techBoardId), alice);
        assertEq(registry.boardGovernance(sportsBoardId), bob);
    }

    // ============================================
    // updateBoardMetadata
    // ============================================

    function test_updateBoardMetadata_emitsEvent() public {
        vm.prank(alice);
        registry.registerBoard(techBoardId, "tech", "bzz://boardref");

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit SwarmitRegistry.BoardMetadataUpdated(techBoardId, "bzz://boardref2");
        registry.updateBoardMetadata(techBoardId, "bzz://boardref2");
    }

    function test_updateBoardMetadata_revertsNonGovernance() public {
        vm.prank(alice);
        registry.registerBoard(techBoardId, "tech", "bzz://boardref");

        vm.prank(bob);
        vm.expectRevert("only board governance");
        registry.updateBoardMetadata(techBoardId, "bzz://boardref2");
    }

    function test_updateBoardMetadata_revertsNonExistentBoard() public {
        vm.prank(alice);
        vm.expectRevert("board not registered");
        registry.updateBoardMetadata(techBoardId, "bzz://boardref");
    }

    function test_updateBoardMetadata_revertsEmptyBoardRef() public {
        vm.prank(alice);
        registry.registerBoard(techBoardId, "tech", "bzz://boardref");

        vm.prank(alice);
        vm.expectRevert("boardRef is required");
        registry.updateBoardMetadata(techBoardId, "");
    }

    // ============================================
    // announceSubmission
    // ============================================

    function test_announceSubmission_emitsEvent() public {
        bytes32 subId = bytes32(uint256(1));
        bytes32 parentId = bytes32(0);
        bytes32 rootId = subId;

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit SwarmitRegistry.SubmissionAnnounced(
            techBoardId, subId, "bzz://subref", parentId, rootId, alice
        );
        registry.announceSubmission(techBoardId, subId, "bzz://subref", parentId, rootId);
    }

    function test_announceSubmission_isPermissionless() public {
        bytes32 subId = bytes32(uint256(1));

        vm.prank(alice);
        registry.announceSubmission(techBoardId, subId, "bzz://subref1", bytes32(0), subId);

        vm.prank(bob);
        registry.announceSubmission(techBoardId, bytes32(uint256(2)), "bzz://subref2", bytes32(0), bytes32(uint256(2)));
        // No revert — both calls succeed
    }

    function test_announceSubmission_revertsTopLevelWithWrongRoot() public {
        bytes32 subId = bytes32(uint256(1));
        bytes32 wrongRoot = bytes32(uint256(99));

        vm.prank(alice);
        vm.expectRevert("top-level post: root must equal submissionId");
        registry.announceSubmission(techBoardId, subId, "bzz://subref", bytes32(0), wrongRoot);
    }

    function test_announceSubmission_revertsTopLevelWithZeroRoot() public {
        bytes32 subId = bytes32(uint256(1));

        vm.prank(alice);
        vm.expectRevert("top-level post: root must equal submissionId");
        registry.announceSubmission(techBoardId, subId, "bzz://subref", bytes32(0), bytes32(0));
    }

    function test_announceSubmission_revertsReplyWithZeroRoot() public {
        bytes32 subId = bytes32(uint256(2));
        bytes32 parentId = bytes32(uint256(1));

        vm.prank(alice);
        vm.expectRevert("reply: root must be non-zero");
        registry.announceSubmission(techBoardId, subId, "bzz://subref", parentId, bytes32(0));
    }

    function test_announceSubmission_revertsEmptySubmissionRef() public {
        vm.prank(alice);
        vm.expectRevert("submissionRef is required");
        registry.announceSubmission(techBoardId, bytes32(uint256(1)), "", bytes32(0), bytes32(uint256(1)));
    }

    function test_announceSubmission_replyWithParentAndRoot() public {
        bytes32 rootSubId = bytes32(uint256(1));
        bytes32 replySubId = bytes32(uint256(2));

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit SwarmitRegistry.SubmissionAnnounced(
            techBoardId, replySubId, "bzz://replyref", rootSubId, rootSubId, alice
        );
        registry.announceSubmission(techBoardId, replySubId, "bzz://replyref", rootSubId, rootSubId);
    }

    // ============================================
    // declareCurator
    // ============================================

    function test_declareCurator_emitsEvent() public {
        vm.prank(curator1);
        vm.expectEmit(true, false, false, true);
        emit SwarmitRegistry.CuratorDeclared(curator1, "bzz://curatorprofile");
        registry.declareCurator("bzz://curatorprofile");
    }

    function test_declareCurator_isPermissionless() public {
        vm.prank(alice);
        registry.declareCurator("bzz://profile-alice");
        vm.prank(bob);
        registry.declareCurator("bzz://profile-bob");
        // No revert — both calls succeed
    }

    function test_declareCurator_revertsEmptyRef() public {
        vm.prank(curator1);
        vm.expectRevert("curatorProfileRef is required");
        registry.declareCurator("");
    }

    function test_declareCurator_canRefreshProfile() public {
        vm.prank(curator1);
        registry.declareCurator("bzz://profile-v1");
        vm.prank(curator1);
        registry.declareCurator("bzz://profile-v2");
        // No revert — curator can update their profile
    }
}
