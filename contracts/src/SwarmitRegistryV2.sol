// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title SwarmitRegistryV2
/// @notice Public coordination contract for the Swarm Message Board protocol v1 with vote signals.
/// @dev Stores board governance, submission bookkeeping, and raw vote state. All content lives on Swarm.
contract SwarmitRegistryV2 {

    // ============================================
    // Events
    // ============================================

    event BoardRegistered(
        bytes32 indexed boardId,
        string slug,
        string boardRef,
        address governance
    );

    event BoardMetadataUpdated(
        bytes32 indexed boardId,
        string boardRef
    );

    event SubmissionAnnounced(
        bytes32 indexed boardId,
        bytes32 indexed submissionId,
        bytes32 parentSubmissionId,
        bytes32 rootSubmissionId,
        address author
    );

    event CuratorDeclared(
        address indexed curator,
        string curatorProfileRef
    );

    event VoteSet(
        bytes32 indexed boardId,
        bytes32 indexed submissionId,
        address indexed voter,
        bytes32 rootSubmissionId,
        int8 direction,
        int8 previousDirection,
        uint64 upvotes,
        uint64 downvotes
    );

    // ============================================
    // State
    // ============================================

    /// @notice Maps boardId to the governance address that controls board metadata.
    mapping(bytes32 => address) public boardGovernance;

    /// @notice Submission bookkeeping for vote targeting.
    mapping(bytes32 => bool) public submissionExists;
    mapping(bytes32 => bytes32) public submissionBoard;
    mapping(bytes32 => bytes32) public submissionRoot;

    /// @notice Raw vote state.
    mapping(bytes32 => mapping(address => int8)) public voteOf;
    mapping(bytes32 => uint64) public upvoteCount;
    mapping(bytes32 => uint64) public downvoteCount;

    // ============================================
    // Board Registration
    // ============================================

    /// @notice Register a new board. Caller becomes governance.
    function registerBoard(
        bytes32 boardId,
        string calldata slug,
        string calldata boardRef
    ) external {
        require(bytes(slug).length > 0, "slug is required");
        require(bytes(boardRef).length > 0, "boardRef is required");
        require(boardId == keccak256(bytes(slug)), "boardId must equal keccak256(slug)");
        require(boardGovernance[boardId] == address(0), "board already registered");

        boardGovernance[boardId] = msg.sender;
        emit BoardRegistered(boardId, slug, boardRef, msg.sender);
    }

    // ============================================
    // Board Metadata Updates
    // ============================================

    /// @notice Update board metadata. Only callable by board governance.
    function updateBoardMetadata(
        bytes32 boardId,
        string calldata boardRef
    ) external {
        require(boardGovernance[boardId] != address(0), "board not registered");
        require(boardGovernance[boardId] == msg.sender, "only board governance");
        require(bytes(boardRef).length > 0, "boardRef is required");

        emit BoardMetadataUpdated(boardId, boardRef);
    }

    // ============================================
    // Submission Announcements
    // ============================================

    /// @notice Announce a submission. Permissionless, but board must be registered.
    function announceSubmission(
        bytes32 boardId,
        bytes32 submissionId,
        bytes32 parentSubmissionId,
        bytes32 rootSubmissionId
    ) external {
        require(boardGovernance[boardId] != address(0), "board not registered");
        require(submissionId != bytes32(0), "submissionId is required");
        require(!submissionExists[submissionId], "submission already announced");

        // Top-level post: parent is zero, root equals self
        // Reply: both parent and root are non-zero
        if (parentSubmissionId == bytes32(0)) {
            require(rootSubmissionId == submissionId, "top-level post: root must equal submissionId");
        } else {
            require(rootSubmissionId != bytes32(0), "reply: root must be non-zero");
        }

        submissionExists[submissionId] = true;
        submissionBoard[submissionId] = boardId;
        submissionRoot[submissionId] = rootSubmissionId;

        emit SubmissionAnnounced(
            boardId, submissionId,
            parentSubmissionId, rootSubmissionId, msg.sender
        );
    }

    // ============================================
    // Voting
    // ============================================

    /// @notice Set, flip, or clear a vote on a submission. Permissionless.
    function setVote(bytes32 submissionId, int8 direction) external {
        require(submissionExists[submissionId], "submission not found");
        require(direction >= -1 && direction <= 1, "invalid direction");

        int8 previousDirection = voteOf[submissionId][msg.sender];
        require(direction != previousDirection, "vote unchanged");

        // Decrement old totals
        if (previousDirection == int8(1)) {
            upvoteCount[submissionId]--;
        } else if (previousDirection == int8(-1)) {
            downvoteCount[submissionId]--;
        }

        // Increment new totals
        if (direction == int8(1)) {
            upvoteCount[submissionId]++;
        } else if (direction == int8(-1)) {
            downvoteCount[submissionId]++;
        }

        voteOf[submissionId][msg.sender] = direction;

        emit VoteSet(
            submissionBoard[submissionId],
            submissionId,
            msg.sender,
            submissionRoot[submissionId],
            direction,
            previousDirection,
            upvoteCount[submissionId],
            downvoteCount[submissionId]
        );
    }

    // ============================================
    // Curator Declaration
    // ============================================

    /// @notice Declare or refresh a curator profile. Permissionless.
    function declareCurator(string calldata curatorProfileRef) external {
        require(bytes(curatorProfileRef).length > 0, "curatorProfileRef is required");

        emit CuratorDeclared(msg.sender, curatorProfileRef);
    }
}
