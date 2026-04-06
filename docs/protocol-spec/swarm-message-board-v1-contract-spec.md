# Swarm Message Board v1 Contract Spec

Date: 2026-03-23
Status: Draft

This document defines the minimal Gnosis Chain contract surface for [swarm-message-board-v1-spec.md](/Users/florian/Git/freedom-dev/freedom-browser/docs/swarm-message-board-v1-spec.md).

It is intentionally narrow. Contracts are responsible for public coordination and discovery, not content storage, ranking, or moderation logic.

## 1. Scope

This v1 contract spec defines:

- required events
- expected argument semantics
- minimal write methods
- validation expectations

This v1 contract spec does not define:

- moderation decisions
- votes or DAO internals
- token economics
- spam prevention
- ranking
- feed updates

## 2. Design Principles

1. Contracts MUST only carry coordination metadata.
2. Immutable content MUST remain on Swarm.
3. Every `submission` MUST be announced on-chain.
4. Curator discovery MUST be possible without trusting any single off-chain index.
5. Board metadata changes MUST be auditable through explicit events.

## 3. Canonical Types

### 3.1 `boardId`

- Type: `bytes32`
- Meaning: stable board identifier
- Recommendation: ASCII slug hashed with `keccak256(bytes(slug))`

The protocol-level board slug remains human-readable in metadata and events. `boardId` is the compact on-chain identifier.

### 3.2 `submissionId`

- Protocol meaning: the canonical identity of the immutable `submission` object
- Off-chain representation: normalized `bzz://<hex>` Swarm reference string
- On-chain representation: `bytes32`

Protocol rule:

- the canonical protocol identity is the immutable `submission` object's Swarm reference
- the immutable `submission` object does not embed a `submissionId` field inside itself
- off-chain references to submissions use the normalized string form
- the contract-layer `bytes32 submissionId` is the binary representation of that reference with the `bzz://` prefix removed and the remaining hex decoded

### 3.3 `submissionRef`

- Type: `string`
- Meaning: normalized `bzz://` reference string for the immutable `submission` object

Recommendation:

- emit the canonical normalized string form that clients can use directly

## 4. Required Events

## 4.1 `BoardRegistered`

```solidity
event BoardRegistered(
  bytes32 indexed boardId,
  string slug,
  string boardRef,
  address governance
);
```

Semantics:

- emitted exactly when a board identity is created
- `boardRef` points to the immutable `board` metadata object on Swarm
- `governance` is the board authority for metadata updates and board-level endorsement actions

## 4.2 `BoardMetadataUpdated`

```solidity
event BoardMetadataUpdated(
  bytes32 indexed boardId,
  string boardRef
);
```

Semantics:

- emitted when the board's immutable metadata object changes
- `boardRef` points to the new immutable `board` object

## 4.3 `SubmissionAnnounced`

```solidity
event SubmissionAnnounced(
  bytes32 indexed boardId,
  bytes32 indexed submissionId,
  string submissionRef,
  bytes32 parentSubmissionId,
  bytes32 rootSubmissionId,
  address author
);
```

Semantics:

- emitted for every top-level post and every reply
- `submissionId` is the encoded `bytes32` form of the immutable `submission` object's canonical identity
- `submissionRef` is the same immutable `submission` object's canonical identity in normalized string form
- `parentSubmissionId` is zero for top-level posts
- `rootSubmissionId` equals `submissionId` for top-level posts
- `rootSubmissionId` identifies the top-level thread root for replies

## 4.4 `CuratorDeclared`

```solidity
event CuratorDeclared(
  address indexed curator,
  string curatorProfileRef
);
```

Semantics:

- emitted when a curator publishes or refreshes their immutable `curatorProfile`
- global event, not board-scoped
- board-specific relevance is derived from `curatorProfile.boardFeeds` and board endorsements

## 5. Minimal Write Interface

The exact Solidity API can vary, but a compliant v1 contract deployment SHOULD expose equivalent write methods to:

```solidity
function registerBoard(
  bytes32 boardId,
  string calldata slug,
  string calldata boardRef
) external;

function updateBoardMetadata(
  bytes32 boardId,
  string calldata boardRef
) external;

function announceSubmission(
  bytes32 boardId,
  bytes32 submissionId,
  string calldata submissionRef,
  bytes32 parentSubmissionId,
  bytes32 rootSubmissionId
) external;

function declareCurator(
  string calldata curatorProfileRef
) external;
```

## 6. Access Control Expectations

### 6.1 Board Registration

`registerBoard` SHOULD fail if:

- `boardId` is already registered
- `slug` is empty
- `boardRef` is empty

The caller becomes the initial `governance` address unless the deployment chooses a different explicit governance argument.

### 6.2 Board Metadata Updates

`updateBoardMetadata` MUST only be callable by the current board governance authority.

### 6.3 Submission Announcements

`announceSubmission` SHOULD be permissionless.

Reason:

- censorship resistance depends on open submission announcement
- curation happens off-chain through competing curator views

### 6.4 Curator Declaration

`declareCurator` SHOULD be permissionless and tied to `msg.sender` as the declaring curator identity.

## 7. Event-Level Validation Rules

## 7.1 `BoardRegistered`

- `slug` MUST be non-empty
- `boardRef` MUST be non-empty
- `boardId` MUST be unique

## 7.2 `BoardMetadataUpdated`

- `boardId` MUST already exist
- `boardRef` MUST be non-empty

## 7.3 `SubmissionAnnounced`

- `submissionRef` MUST be non-empty
- for top-level posts:
  - `parentSubmissionId == bytes32(0)`
  - `rootSubmissionId == submissionId`
- for replies:
  - `parentSubmissionId != bytes32(0)`
  - `rootSubmissionId != bytes32(0)`

The contract MAY not be able to fully distinguish top-level posts from replies by itself without additional arguments. That is acceptable in v1 as long as emitted values follow the protocol rules.

This is intentional in v1:

- the contract is a public coordination and announcement layer
- full semantic validation of off-chain protocol objects belongs to curators and clients
- malformed or inconsistent submissions MAY still be announced on-chain and later rejected or ignored by curator/indexer logic

## 7.4 `CuratorDeclared`

- `curatorProfileRef` MUST be non-empty
- the effective curator identity is `msg.sender`

## 8. Read Expectations for Clients and Indexers

Indexers and clients SHOULD use:

- `BoardRegistered` plus `BoardMetadataUpdated` to resolve latest board metadata
- `SubmissionAnnounced` as the canonical raw submission log
- `CuratorDeclared` as the canonical curator discovery log

End-user clients SHOULD NOT default to rendering raw `SubmissionAnnounced` data as the primary reading surface. They SHOULD instead prefer curator-backed Swarm feed views.

## 9. Non-Goals for v1 Contracts

v1 contracts MUST NOT attempt to:

- store post or reply bodies
- store board indexes or thread indexes
- store votes or scores
- enforce moderation rules
- enforce curator quality
- provide canonical ranking

Those concerns belong to Swarm objects and curator infrastructure.

## 10. Recommended Encoding Notes

Recommended implementation choices:

- `boardId = keccak256(bytes(slug))`
- off-chain `submissionId` values use normalized `bzz://<hex>` form
- on-chain `submissionId = bytes32(hex_decode(submissionId without the bzz:// prefix))`
- `submissionRef` and `boardRef` emitted as normalized string references for easy client use

These recommendations improve interoperability, but the main protocol requirement is semantic consistency with the v1 spec.

## 11. Deferred Beyond v1

Explicitly deferred beyond v1:

- on-chain moderation signals
- board-level staking or anti-spam mechanisms
- voting or karma systems
- DAO-controlled curation updates
- richer board registries and search primitives

## 12. Summary

The v1 contract layer exists to make four things public and auditable:

- boards
- board metadata changes
- submissions
- curators

Everything else is intentionally left to Swarm content and curator-owned feed-backed views.
