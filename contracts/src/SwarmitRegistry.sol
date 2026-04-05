// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title SwarmitRegistry
/// @notice Minimal public coordination contract for the Swarm Message Board protocol v1.
/// @dev Stores only board governance mappings. All content lives on Swarm.
contract SwarmitRegistry {

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
        string submissionRef,
        bytes32 parentSubmissionId,
        bytes32 rootSubmissionId,
        address author
    );

    event CuratorDeclared(
        address indexed curator,
        string curatorProfileRef
    );

    // ============================================
    // State
    // ============================================

    /// @notice Maps boardId to the governance address that controls board metadata.
    mapping(bytes32 => address) public boardGovernance;

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

    /// @notice Announce a submission. Permissionless.
    function announceSubmission(
        bytes32 boardId,
        bytes32 submissionId,
        string calldata submissionRef,
        bytes32 parentSubmissionId,
        bytes32 rootSubmissionId
    ) external {
        require(bytes(submissionRef).length > 0, "submissionRef is required");

        // Top-level post: parent is zero, root equals self
        // Reply: both parent and root are non-zero
        if (parentSubmissionId == bytes32(0)) {
            require(rootSubmissionId == submissionId, "top-level post: root must equal submissionId");
        } else {
            require(rootSubmissionId != bytes32(0), "reply: root must be non-zero");
        }

        emit SubmissionAnnounced(
            boardId, submissionId, submissionRef,
            parentSubmissionId, rootSubmissionId, msg.sender
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
