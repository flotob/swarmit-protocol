// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title SwarmitRegistryV3
/// @notice Public coordination contract for the Swarm Message Board protocol.
/// @dev Board registration with canonical slug validation, submission bookkeeping,
///      vote signals with a packed read helper, curator declaration, and an
///      enumerable user-feed registry for journal-based feed discovery.
contract SwarmitRegistryV3 {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    // ============================================
    // Structs
    // ============================================

    struct UserFeedCoordinates {
        bytes32 feedTopic;
        address feedOwner;
    }

    struct DeclaredUserFeed {
        bytes32 feedId;
        bytes32 feedTopic;
        address feedOwner;
    }

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

    event UserFeedDeclared(
        address indexed user,
        bytes32 indexed feedId,
        bytes32 feedTopic,
        address feedOwner
    );

    event UserFeedRevoked(
        address indexed user,
        bytes32 indexed feedId,
        bytes32 feedTopic,
        address feedOwner
    );

    // ============================================
    // State — boards
    // ============================================

    mapping(bytes32 => address) public boardGovernance;

    // ============================================
    // State — submissions
    // ============================================

    mapping(bytes32 => bool) public submissionExists;
    mapping(bytes32 => bytes32) public submissionBoard;
    mapping(bytes32 => bytes32) public submissionRoot;

    // ============================================
    // State — votes
    // ============================================

    mapping(bytes32 => mapping(address => int8)) public voteOf;
    mapping(bytes32 => uint64) public upvoteCount;
    mapping(bytes32 => uint64) public downvoteCount;

    // ============================================
    // State — user feeds
    // ============================================

    /// @dev Coordinates are intentionally not deleted on revoke because feedIds
    ///      are shared — multiple users may declare the same (topic, owner) pair.
    mapping(bytes32 => UserFeedCoordinates) private _feedCoordinates;
    mapping(address => EnumerableSet.Bytes32Set) private _userFeedIds;

    // ============================================
    // Slug validation
    // ============================================

    /// @notice Check whether a slug is valid canonical form.
    /// @dev Non-reverting boolean check. Rules: 1..32 chars, a-z 0-9 -, no
    ///      leading/trailing/consecutive hyphens.
    function _isValidSlug(string memory slug) internal pure returns (bool) {
        bytes memory b = bytes(slug);
        uint256 len = b.length;
        if (len == 0 || len > 32) return false;

        bool prevHyphen = false;
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            bool isLower = (c >= 0x61 && c <= 0x7A);
            bool isDigit = (c >= 0x30 && c <= 0x39);
            bool isHyphen = (c == 0x2D);

            if (!isLower && !isDigit && !isHyphen) return false;

            if (isHyphen) {
                if (i == 0 || i == len - 1) return false;
                if (prevHyphen) return false;
                prevHyphen = true;
            } else {
                prevHyphen = false;
            }
        }
        return true;
    }

    /// @notice Reverting slug validation used by registerBoard.
    function _requireValidSlug(string calldata slug) internal pure {
        require(_isValidSlug(slug), "invalid slug");
    }

    /// @notice Public slug validator for external tooling.
    function isValidSlug(string calldata slug) external pure returns (bool) {
        return _isValidSlug(slug);
    }

    // ============================================
    // Board Registration
    // ============================================

    /// @notice Register a new board. Caller becomes governance.
    ///         The contract validates the slug and derives boardId internally.
    function registerBoard(
        string calldata slug,
        string calldata boardRef
    ) external {
        _requireValidSlug(slug);
        require(bytes(boardRef).length > 0, "boardRef is required");

        bytes32 boardId = keccak256(bytes(slug));
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

        if (previousDirection == int8(1)) {
            upvoteCount[submissionId]--;
        } else if (previousDirection == int8(-1)) {
            downvoteCount[submissionId]--;
        }

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

    /// @notice Packed vote-state read helper. Returns upvotes, downvotes, and
    ///         the specified voter's current direction in one call.
    function voteStats(bytes32 submissionId, address voter)
        external
        view
        returns (uint64 upvotes, uint64 downvotes, int8 direction)
    {
        upvotes = upvoteCount[submissionId];
        downvotes = downvoteCount[submissionId];
        direction = voteOf[submissionId][voter];
    }

    // ============================================
    // Curator Declaration
    // ============================================

    /// @notice Declare or refresh a curator profile. Permissionless.
    function declareCurator(string calldata curatorProfileRef) external {
        require(bytes(curatorProfileRef).length > 0, "curatorProfileRef is required");
        emit CuratorDeclared(msg.sender, curatorProfileRef);
    }

    // ============================================
    // User Feed Declaration
    // ============================================

    /// @notice Declare a user feed. Permissionless, idempotent.
    ///         Duplicate declaration of an already-active feed is a no-op.
    function declareUserFeed(bytes32 feedTopic, address feedOwner) external {
        require(feedTopic != bytes32(0), "feedTopic is required");
        require(feedOwner != address(0), "feedOwner is required");

        bytes32 feedId = keccak256(abi.encode(feedTopic, feedOwner));

        // EnumerableSet.add returns false if already present — single SLOAD
        if (!_userFeedIds[msg.sender].add(feedId)) return;

        _feedCoordinates[feedId] = UserFeedCoordinates(feedTopic, feedOwner);

        emit UserFeedDeclared(msg.sender, feedId, feedTopic, feedOwner);
    }

    /// @notice Revoke a previously declared feed. Reverts if not active.
    function revokeUserFeed(bytes32 feedId) external {
        require(_userFeedIds[msg.sender].contains(feedId), "feed not active");

        UserFeedCoordinates memory coords = _feedCoordinates[feedId];
        _userFeedIds[msg.sender].remove(feedId);

        emit UserFeedRevoked(msg.sender, feedId, coords.feedTopic, coords.feedOwner);
    }

    // ============================================
    // User Feed Views
    // ============================================

    /// @notice Check whether a specific feed is active for a user.
    function hasUserFeed(address user, bytes32 feedId) external view returns (bool) {
        return _userFeedIds[user].contains(feedId);
    }

    /// @notice Return all active feeds for a user.
    ///         Order is unspecified — do not infer chronology from array position.
    function userFeedsOf(address user) external view returns (DeclaredUserFeed[] memory) {
        EnumerableSet.Bytes32Set storage ids = _userFeedIds[user];
        uint256 count = ids.length();
        DeclaredUserFeed[] memory feeds = new DeclaredUserFeed[](count);
        for (uint256 i = 0; i < count; i++) {
            bytes32 fid = ids.at(i);
            UserFeedCoordinates memory c = _feedCoordinates[fid];
            feeds[i] = DeclaredUserFeed(fid, c.feedTopic, c.feedOwner);
        }
        return feeds;
    }

    /// @notice Number of active feeds for a user.
    function userFeedCount(address user) external view returns (uint256) {
        return _userFeedIds[user].length();
    }

    /// @notice Get the feedId at a specific index in a user's active set.
    ///         Enables pagination and multicall-based partial reads.
    function userFeedIdAt(address user, uint256 index) external view returns (bytes32) {
        return _userFeedIds[user].at(index);
    }

    /// @notice Resolve a feedId to its coordinates.
    function userFeedCoordinates(bytes32 feedId)
        external
        view
        returns (bytes32 feedTopic, address feedOwner)
    {
        UserFeedCoordinates memory c = _feedCoordinates[feedId];
        return (c.feedTopic, c.feedOwner);
    }
}
