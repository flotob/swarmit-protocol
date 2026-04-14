# Swarm Message Board v1 — V3 Registry and Schema Patch

Date: 2026-04-12
Status: Adopted patch (implemented)

## Purpose

This document describes the protocol changes introduced by `SwarmitRegistryV3` and the accompanying JS library updates. It covers six interconnected changes that were adopted together because they form a coherent new protocol shape:

1. Board slug canonicalization
2. Board ID semantics (`boardId` = hash everywhere)
3. Vote stats read helper
4. User feed journal model (replaces blob-based user feed index)
5. On-chain user feed discovery
6. Simplified author schema

These changes are breaking relative to the experimental V2 shape. They are adopted pre-release with no migration requirement.

## Supersedes

This patch overrides the following sections of earlier spec documents:

- `swarm-message-board-v1-schemas.md` sections on `author.userFeed`, `userFeedIndex`, and `boardId` matching `slug`
- `swarm-message-board-v1-spec.md` sections describing `author.userFeed` as a required field
- `swarm-message-board-v1-contract-spec.md` sections describing the `registerBoard(bytes32 boardId, string slug, string boardRef)` signature

Where this patch and earlier documents conflict, this patch is authoritative.

## Summary of Changes

### 1. Board slug canonicalization

The contract now enforces canonical board slugs at registration time.

**Rules:**
- Length: 1..32 characters
- Allowed characters: `a-z`, `0-9`, `-`
- No leading or trailing hyphen
- No consecutive hyphens (`--`)
- Uppercase is rejected, not silently normalized

`registerBoard(string slug, string boardRef)` validates the slug on-chain and derives `boardId` internally. Callers no longer pass `boardId`.

Clients SHOULD normalize user input (trim + lowercase) before submission. The contract is the authoritative validator.

### 2. Board ID semantics

`boardId` is now `keccak256(bytes(slug))` everywhere — both on-chain and in off-chain protocol objects.

Previously, `boardId` in off-chain objects (board metadata, submissions, board indexes, global indexes) was often the raw slug string. This created an ambiguity where the on-chain `boardId` (a hash) and the off-chain `boardId` (a slug) referred to the same concept with different values.

**New rule:** `boardId` MUST be the `0x`-prefixed 32-byte keccak256 hash of the canonical slug in all contexts:

- `board.boardId` in board metadata objects
- `submission.boardId` in submission objects
- `boardIndex.boardId` in curator-produced board indexes
- `globalIndex.entries[].boardId` in curator-produced global indexes

`board.slug` remains the human-readable field. `boardId` is the machine identifier derived from it.

Validators enforce this: `boardId` must be a valid `0x`-prefixed 32-byte hex string, and for board objects specifically, `boardId` must equal `keccak256(bytes(slug))`.

Example — a board object under the new rules:

```json
{
  "protocol": "freedom-board/board/v1",
  "boardId": "0x72c3936f97a420f89c999b2f7642e9203ca44f2e72e4506f69a989a5250c8266",
  "slug": "tech",
  "title": "Technology",
  "description": "Technology discussion",
  "createdAt": 1712937600000,
  "governance": { "type": "open" }
}
```

Here `boardId` is `keccak256(bytes("tech"))`, not the string `"tech"`.

### 3. Vote stats read helper

A new packed view method returns upvotes, downvotes, and per-voter direction in a single call:

```solidity
function voteStats(bytes32 submissionId, address voter)
    external view
    returns (uint64 upvotes, uint64 downvotes, int8 direction);
```

The `voter` parameter is explicit — the method does not infer the voter from `msg.sender`. This makes it safe for use through Multicall3, indexers, and backend services where `msg.sender` is not the end-user wallet.

This is a pure read convenience over existing state. It does not change vote semantics, `setVote`, or the `VoteSet` event.

### 4. User feed journal model

The blob-based `userFeedIndex` object type is removed. It is replaced by `userFeedEntry`, a flat per-entry protocol object written individually to Swarm feed indices.

**Removed:**
- `freedom-board/user-feed/v1` protocol type
- `buildUserFeedIndex` / `validateUserFeedIndex`

**Added:**
- `freedom-board/user-feed-entry/v1` protocol type

A `userFeedEntry` has the shape:

```json
{
  "protocol": "freedom-board/user-feed-entry/v1",
  "submissionRef": "bzz://SUBMISSION_REF",
  "boardSlug": "tech",
  "kind": "post",
  "createdAt": 1712937600000
}
```

Field rules:
- `submissionRef` MUST be a normalized `bzz://` reference
- `boardSlug` MUST be a canonical board slug (same rules as the contract)
- `kind` MUST be `"post"` or `"reply"`
- `createdAt` MUST be a finite number (millisecond timestamp)

Each entry is written as a Single Owner Chunk (SOC) at an incrementing feed index via Freedom Browser's `writeFeedEntry` API. This replaces the old read-then-append-blob pattern with O(1) writes.

### 5. On-chain user feed discovery

User feeds are now discoverable via on-chain registration rather than embedded references in content objects.

`SwarmitRegistryV3` adds:

**Writes:**
- `declareUserFeed(bytes32 feedTopic, address feedOwner)` — permissionless, idempotent (duplicate declaration of an already-active feed is a no-op)
- `revokeUserFeed(bytes32 feedId)` — removes a feed from the caller's active set (reverts if not active)

**Views:**
- `hasUserFeed(address user, bytes32 feedId) view returns (bool)`
- `userFeedsOf(address user) view returns (DeclaredUserFeed[] memory)` — returns all active feeds. Order is unspecified.
- `userFeedCount(address user) view returns (uint256)`
- `userFeedIdAt(address user, uint256 index) view returns (bytes32)` — indexed access for pagination
- `userFeedCoordinates(bytes32 feedId) view returns (bytes32 feedTopic, address feedOwner)` — resolves a feedId to its coordinates. Note: this is only a coordinate resolver, not proof that the feed is currently active for any wallet. Coordinates are intentionally retained after revocation because feedIds are shared across users. Use `hasUserFeed` or `userFeedsOf` for active-state checks.

**Events:**
- `UserFeedDeclared(address indexed user, bytes32 indexed feedId, bytes32 feedTopic, address feedOwner)`
- `UserFeedRevoked(address indexed user, bytes32 indexed feedId, bytes32 feedTopic, address feedOwner)`

**Feed ID derivation:**
- `feedId = keccak256(abi.encode(feedTopic, feedOwner))` (standard ABI encoding, not packed)

**Key design properties:**
- A wallet MAY have multiple active feeds (supports device rotation, identity changes)
- Feed declaration does not require posting — they are independent
- Submission announcement (`announceSubmission`) does not require a declared feed
- Declared feeds are discovery aids, not authoritative proof of authorship. Clients SHOULD verify that entries referenced in a declared feed actually belong to the declaring wallet by checking the submission/content author address.

**Feed coordinate format:**
- `feedTopic` is a `bytes32` on-chain. Freedom Browser returns topics as raw 64-character hex strings. The JS library normalizes between formats via `topicToContractFormat` and `topicToSwarmFormat`.
- `feedOwner` is the Swarm signer address (from Freedom Browser's `createFeed` response). This is NOT the Ethereum wallet address in app-scoped identity mode.

**Discovery flow:**
```
walletAddress
  -> SwarmitRegistryV3.userFeedsOf(walletAddress)
  -> [{ feedId, feedTopic, feedOwner }, ...]
  -> readFeedEntry({ topic, owner }) for each declared feed
  -> merge entries client-side
  -> verify author matches walletAddress
```

### 6. Simplified author schema

The `author` object in content objects (posts, replies, submissions) is simplified.

**Before:**
```json
{
  "address": "0xWALLET_ADDRESS",
  "userFeed": "bzz://FEED_MANIFEST_REF"
}
```

**After:**
```json
{
  "address": "0xWALLET_ADDRESS"
}
```

`author.userFeed` is removed. Feed discovery is now handled by the on-chain registry (see section 5). The wallet address alone is sufficient to look up a user's declared feeds.

This simplification removes a protocol-level coupling between content authorship and feed infrastructure. Users can publish content without having declared a feed, and feed coordinates can change without invalidating published content.

## Affected Protocol Objects

| Object type | Changes |
|---|---|
| `board` | `boardId` is now a hash; `slug` must be canonical |
| `post` | `author.userFeed` removed |
| `reply` | `author.userFeed` removed |
| `submission` | `author.userFeed` removed; `boardId` must be a hash |
| `userFeedIndex` | **Removed entirely** |
| `userFeedEntry` | **New type** |
| `boardIndex` | `boardId` must be a hash |
| `threadIndex` | No changes |
| `globalIndex` | `entries[].boardId` must be a hash; `entries[].boardSlug` added (required, must match boardId) |
| `curatorProfile` | No changes |

## Contract Surface Summary (V3 vs V2)

**Changed:**
- `registerBoard` — signature changed from `(bytes32 boardId, string slug, string boardRef)` to `(string slug, string boardRef)`. Contract validates slug and derives boardId.

**Added:**
- `voteStats(bytes32 submissionId, address voter)` — packed vote read
- `isValidSlug(string slug)` — public pure slug validator
- `declareUserFeed(bytes32 feedTopic, address feedOwner)` — feed registration
- `revokeUserFeed(bytes32 feedId)` — feed deregistration
- `hasUserFeed(address, bytes32)` / `userFeedsOf(address)` / `userFeedCount(address)` / `userFeedIdAt(address, uint256)` / `userFeedCoordinates(bytes32)` — feed discovery views

**Unchanged:**
- `updateBoardMetadata` — still keyed by boardId, governance-only
- `announceSubmission` — same semantics, same signature
- `setVote` — same semantics
- `declareCurator` — same semantics
- All events except the two new feed events

## JS Library Surface Changes

**New subpath exports:**
- `swarmit-protocol/slugs` — `normalizeBoardSlugInput`, `validateBoardSlug`, `isValidBoardSlug`
- `swarmit-protocol/feeds` — `topicToContractFormat`, `topicToSwarmFormat`, `feedIdFromCoordinates`, `decodeFeedPayload`, `decodeFeedJSON`

**Updated `swarmit-protocol/chain`:**
- ABI updated to V3 (28 fragments: 7 events + 7 writes + 7 mapping getters + 7 view helpers)
- `encode.registerBoard` no longer passes boardId
- `encode.declareUserFeed` and `encode.revokeUserFeed` added
- Feed-topic normalization at the library boundary (accepts both Freedom Browser raw hex and 0x-prefixed)

**Updated root exports:**
- Slug and feed helpers re-exported from root
- `buildUserFeedEntry` / `validateUserFeedEntry` replace `buildUserFeedIndex` / `validateUserFeedIndex`

**Shared validation:**
- `src/_validation.js` provides common ASCII identifier rules used by both username and slug validation
- `slugToBoardId` in `references.js` rejects non-canonical slugs

## Backward Compatibility

None required. The project is pre-release with no external users or published content. All changes assume a clean deployment.
