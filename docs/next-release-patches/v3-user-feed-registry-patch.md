# V3 User Feed Registry Patch

Date: 2026-04-12
Status: Draft patch proposal for the next protocol release

## Purpose

This document proposes a `SwarmitRegistryV3` user-feed discovery surface for the journal-based feed model.

The intent is:

- make public user-feed discovery a direct current-state chain read
- support multiple active feeds per wallet
- allow feed revocation without making it a required day-one UI feature
- avoid embedding feed coordinates back into every post or reply object
- keep posting permissionless even when no feed is declared

## Summary of Changes

1. Add user-feed declaration to `SwarmitRegistryV3`
2. Model user feeds as a set of active feed coordinates per wallet, not a single slot
3. Make active feed discovery readable from contract state without historical event scanning
4. Add revocation/deactivation at the contract layer
5. Make duplicate declaration of the same feed a no-op
6. Do not require a declared user feed in order to announce a submission
7. Do not reintroduce a feed hint into `post`, `reply`, or `submission` authorship objects

## Problem Statement

Under the feed-journal model, reading another user's feed requires the raw feed coordinates:

- `feedTopic`
- `feedOwner`

A stable `bzz://` manifest reference is no longer enough for indexed journal reads.

The protocol therefore needs a discovery layer that answers:

```text
wallet address -> which user-feed journals are currently active for this wallet?
```

This should be easy for clients to read.

It should not require:

- scanning old submissions
- extracting feed hints from content objects
- replaying the full event history just to determine current active state

## Why This Belongs in `SwarmitRegistryV3`

User-feed declaration is the same class of coordination primitive as curator declaration.

It belongs in the main protocol registry because it is:

- public coordination metadata
- wallet-scoped
- globally discoverable
- useful across clients

This patch therefore assumes the next registry release should incorporate user-feed declaration directly rather than introducing a separate standalone contract.

## Rationale

### Why direct state beats events-only discovery

Events are still useful and should still exist.

But current active feed discovery should be directly readable from contract state.

Reasons:

- the SPA needs "what feeds are active now?" more often than "what happened historically?"
- historical log queries are more operationally awkward than direct state reads
- active feed membership is a state question, not only a history question

So the recommended model is:

- on-chain enumerable active set for current state
- events for auditability, sync, and history

### Why multiple feeds per wallet are the right model

If feeds are owned by a Swarm signer that is not necessarily the Ethereum wallet, then a wallet may legitimately operate more than one feed over time.

Examples:

- the same wallet used from multiple devices
- rotation to a new app-scoped identity
- future multi-client publishing under the same wallet

If the contract only stores one `wallet -> feed` slot, each new declaration overwrites the old one and turns legitimate multi-feed use into data loss at the discovery layer.

So the registry should treat user feeds as a set, not a singleton.

### Why content objects should not carry feed hints anymore

This patch recommends that public feed discovery be chain-based rather than content-embedded.

That keeps the content model cleaner and preserves an important user choice:

- a user may publish posts without publicly declaring a user feed

If a user never declares any feed, the canonical submission and content objects should still work normally.

## Design Principles

1. Current active user-feed discovery MUST be available from contract state.
2. A wallet MAY have multiple active user feeds.
3. Feed declaration SHOULD be idempotent.
4. Feed revocation SHOULD be possible.
5. Submission announcement MUST remain independent from feed declaration.
6. User-feed entries are discovery aids, not authoritative proof of authorship by themselves.
7. Clients SHOULD verify authorship from the referenced submission/content objects before rendering activity as belonging to a wallet.

## Recommended Contract Surface

This patch proposes adding user-feed declaration to `SwarmitRegistryV3`.

Recommended internal concepts:

- `feedId = keccak256(abi.encode(feedTopic, feedOwner))`
- `feedTopic` = raw bytes32 feed topic
- `feedOwner` = Swarm signer address controlling that feed

Recommended structs:

```solidity
struct UserFeedCoordinates {
    bytes32 feedTopic;
    address feedOwner;
}

struct DeclaredUserFeed {
    bytes32 feedId;
    bytes32 feedTopic;
    address feedOwner;
}
```

Recommended events:

```solidity
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
```

Recommended write methods:

```solidity
function declareUserFeed(bytes32 feedTopic, address feedOwner) external;

function revokeUserFeed(bytes32 feedId) external;
```

Recommended read methods:

```solidity
function hasUserFeed(address user, bytes32 feedId) external view returns (bool);

function userFeedsOf(address user)
    external
    view
    returns (DeclaredUserFeed[] memory);
```

## Recommended State Model

The contract should internally maintain:

- a mapping from `feedId` to feed coordinates
- an enumerable active set of `feedId`s for each wallet

Conceptually:

```solidity
mapping(bytes32 => UserFeedCoordinates) private _feedCoordinates;
mapping(address => EnumerableSet.Bytes32Set) private _userFeedIds;
```

This gives us:

- direct current-state reads
- support for multiple active feeds
- efficient duplicate checks
- a clear revocation target

## Write Semantics

### `declareUserFeed(feedTopic, feedOwner)`

Rules:

- `feedTopic` MUST be non-zero
- `feedOwner` MUST be non-zero
- derive `feedId = keccak256(abi.encode(feedTopic, feedOwner))`
- if `feedId` is already active for `msg.sender`, return successfully without changing state
- otherwise store the coordinates if needed, add `feedId` to `msg.sender`'s active set, and emit `UserFeedDeclared`

Important consequence:

- duplicate declaration is a no-op, not an error

That makes app behavior easier:

- the SPA can safely attempt declaration when needed
- retry behavior is simpler
- local cache mistakes are less painful

### `revokeUserFeed(feedId)`

Rules:

- `feedId` identifies one active feed in `msg.sender`'s set
- revocation removes that `feedId` from `msg.sender`'s active set
- the contract emits `UserFeedRevoked` including the resolved coordinates

This patch does not require the initial app UI to expose revocation.

It is still worth having at the contract layer so the protocol can support:

- feed rotation
- device retirement
- cleanup after identity reset

## Discovery Model

The intended read flow is:

```text
wallet address
  -> userFeedsOf(wallet)
  -> list of active { feedId, feedTopic, feedOwner }
  -> read each feed journal directly from Swarm
  -> merge entries client-side
```

This patch intentionally makes the registry answer the current-state question directly.

Clients should not need to reconstruct active feed membership by replaying every historical declaration and revocation event just to render a profile.

## Authorship Verification

Declared user feeds are public discovery surfaces.

They are not, by themselves, authoritative proof that every entry in those feeds belongs to the declaring wallet.

So clients rendering a wallet's activity SHOULD:

1. resolve entries from the declared feeds
2. fetch the referenced submission/content objects
3. verify the referenced author address matches the wallet whose profile is being rendered
4. exclude entries that fail that check

This protects clients against:

- malformed feed entries
- stale feed data
- deliberately misleading self-declarations

Canonical authorship still comes from the submission/content objects, not from the registry declaration alone.

## Relationship to Submission Posting

This patch explicitly does not make feed declaration a prerequisite for posting.

`announceSubmission` should remain permissionless and minimal.

Reasons:

- posting should not depend on extra feed permissions or registry state
- some clients may publish submissions without maintaining a public user feed
- feed declaration is a discovery convenience, not canonical publication

So the recommended split is:

- contract layer: posting does not require feed declaration
- app layer: the SPA may try to ensure the current feed is declared before or around publish for UX reasons

## Recommended App Flow

For the SPA publish flow:

1. ensure the current local feed exists and obtain `feedTopic` + `feedOwner`
2. compute `feedId`
3. check whether `hasUserFeed(currentWallet, feedId)` is already true
4. if not, prompt `declareUserFeed(feedTopic, feedOwner)`
5. publish normally

Important clarification:

- the app does not need to know whether this is the user's first post ever
- it only needs to know whether the current local feed is already declared for the current wallet

This check may be cached client-side per session if desired.

## Why This Patch Does Not Add Feed Hints Back Into Content

This patch recommends against reintroducing fields such as:

- `author.userFeed`
- `author.feedTopic`
- `author.feedOwner`

into canonical content objects.

Reasons:

- it duplicates registry discovery data
- it complicates author schema again
- it removes the clean option for users to publish without publicly declaring a feed

The chain registry should be the discovery source when a user chooses to declare feeds publicly.

## Normative Patch Relative to the Next Registry Version

If adopted, the next contract spec should define semantics equivalent to:

```md
- `SwarmitRegistryV3` MUST support public declaration of user-feed coordinates
- a wallet MAY have multiple active declared user feeds
- the contract MUST expose current active user feeds through direct view methods
- duplicate declaration of the same active feed for the same wallet SHOULD be a no-op
- the contract SHOULD support revocation of a previously declared feed
- submission announcement MUST NOT require a declared user feed
```

## Backward Compatibility

This patch assumes a fresh next-release registry deployment.

That is acceptable because:

- the project is still pre-release
- there is no external user data we need to preserve
- older experimental feed-discovery approaches can be discarded

So this patch optimizes for the cleanest V3 shape rather than compatibility with interim experiments.

## Explicit Non-Goals

This patch does not:

- define the journal entry object format itself
- require the app to expose feed revocation UI immediately
- require wallet-signed Swarm feeds instead of app-scoped signers
- define how profile pagination across multiple feeds should work
- define board/global/thread feed storage formats
- make declared feeds authoritative authorship proofs

## Open Questions

1. Should `revokeUserFeed(feedId)` be a no-op when the feed is not active, or should it revert?
   - This draft leaves the exact idempotency rule for revocation open.
2. Should the app merge all active feeds indiscriminately, or prefer some feeds first for UX/performance reasons?
   - The contract should support all active feeds either way.
3. How should profile pagination work once a wallet has multiple active feeds?
   - This patch deliberately defers that app-level merge/pagination policy.

## Implementation Guidance

If adopted, implementation should include:

- `SwarmitRegistryV3` storage and events for user-feed declaration
- Solidity tests for:
  - declare success
  - duplicate declare no-op
  - multiple feeds per wallet
  - revocation
  - direct view discovery
- shared library support for:
  - `declareUserFeed` calldata encoding
  - `UserFeedDeclared` / `UserFeedRevoked` event ABI
  - feedId derivation helper if helpful
- SPA read/write integration for:
  - checking whether the current feed is declared
  - declaring when missing
  - discovering all active feeds for a profile

Recommended product posture:

- keep posting permissionless
- make public feed declaration easy
- support multiple feeds without treating rotation as data loss
- verify authorship at render time rather than trusting declarations blindly
