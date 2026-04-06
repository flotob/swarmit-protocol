# Swarm Message Board v1 Votes Implementation Note

Date: 2026-03-28
Status: Builder implementation note

## Source Documents

Implement against these two docs first:

- `/Users/florian/Git/freedom-dev/swarmit/docs/swarm-message-board-v1-votes-patch.md`
- `/Users/florian/Git/freedom-dev/swarmit/docs/swarm-message-board-v1-contract-spec.md`

This implementation note is a practical handoff for building the feature across:

- `SwarmitRegistryV2`
- the Swarmit SPA
- the Swarmit curator service

Decision already made:

- no migration path
- no Swarm vote objects
- use a new `SwarmitRegistryV2`
- raw vote signals live on-chain
- ranking remains curator-defined
- `SwarmitRegistryV2` uses only `bytes32 submissionId` as the canonical on-chain submission identity
- `SwarmitRegistryV2` does not accept or emit a separate `submissionRef` string
- off-chain systems derive normalized `bzz://<hex>` refs from `submissionId`

## What This Feature Is

This feature adds canonical public vote signals on-chain.

Votes target `submissionId`, which means:

- top-level posts are votable
- replies are votable

Canonical vote operations:

- `1` = upvote
- `-1` = downvote
- `0` = clear / unvote

The contract becomes the canonical raw vote signal layer.

The contract does **not** become the canonical ranking engine.

Curators remain responsible for:

- score interpretation
- ranked feed generation
- future `best` / `hot` / `rising` / `controversial` views

## Scope of Work

Implement all of the following:

1. `SwarmitRegistryV2` Solidity contract
2. contract tests
3. SPA chain read/write support for votes
4. SPA vote UI wiring for posts and replies
5. curator ingestion of `VoteSet` events
6. curator internal vote state and ranking hooks

Do **not** implement yet:

- multi-view feeds patch
- vote-based board/global/thread ranked feeds
- sybil resistance
- self-vote restrictions
- batch vote transactions
- token economics

## Contract: `SwarmitRegistryV2`

### New Contract Target

Create a new contract instead of mutating the semantics of the existing one:

- `contracts/src/SwarmitRegistryV2.sol`

The old `SwarmitRegistry.sol` can remain as reference/history if useful.

### Required Behavioral Changes

#### 0. Use only `bytes32 submissionId` on-chain

Do not carry forward the old v1 convenience shape where both `submissionId` and `submissionRef` were supplied or emitted.

For `SwarmitRegistryV2`:

- `announceSubmission` should accept only:
  - `boardId`
  - `submissionId`
  - `parentSubmissionId`
  - `rootSubmissionId`
- `SubmissionAnnounced` should emit only:
  - `boardId`
  - `submissionId`
  - `parentSubmissionId`
  - `rootSubmissionId`
  - `author`

Recommended V2 surface:

```solidity
event SubmissionAnnounced(
  bytes32 indexed boardId,
  bytes32 indexed submissionId,
  bytes32 parentSubmissionId,
  bytes32 rootSubmissionId,
  address author
);

function announceSubmission(
  bytes32 boardId,
  bytes32 submissionId,
  bytes32 parentSubmissionId,
  bytes32 rootSubmissionId
) external;
```

Off-chain code should reconstruct `submissionRef = bytes32ToRef(submissionId)` when needed.

#### 1. Persist submission bookkeeping during `announceSubmission`

Unlike the current v1 registry, `announceSubmission` in V2 must store minimal submission metadata.

Add state equivalent to:

```solidity
mapping(bytes32 => bool) public submissionExists;
mapping(bytes32 => bytes32) public submissionBoard;
mapping(bytes32 => bytes32) public submissionRoot;
```

On successful `announceSubmission`:

- reject duplicate `submissionId`
- set `submissionExists[submissionId] = true`
- set `submissionBoard[submissionId] = boardId`
- set `submissionRoot[submissionId] = rootSubmissionId`

For top-level posts:

- `rootSubmissionId == submissionId`

So `submissionRoot[submissionId]` is always defined for votable items.

#### 2. Add vote state

Add state equivalent to:

```solidity
mapping(bytes32 => mapping(address => int8)) public voteOf;
mapping(bytes32 => uint64) public upvoteCount;
mapping(bytes32 => uint64) public downvoteCount;
```

These are contract-level raw vote totals only.

Do not add ranking state.

#### 3. Add `VoteSet` event

Implement the exact event from the patch:

```solidity
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
```

#### 4. Add `setVote`

Add:

```solidity
function setVote(bytes32 submissionId, int8 direction) external;
```

Rules:

- target submission must already exist
- `direction` must be one of `-1`, `0`, `1`
- effective no-op writes should fail:
  - setting `1` when already `1`
  - setting `-1` when already `-1`
  - setting `0` when already `0`
- clearing with `0` should require a previous non-zero vote

State transition logic:

1. read `previousDirection = voteOf[submissionId][msg.sender]`
2. reject no-op
3. decrement old totals if previous vote was non-zero
4. increment new totals if new direction is non-zero
5. store new direction
6. emit `VoteSet` with post-transition totals

#### 5. Recommended read helpers

Add either explicit functions or equivalent public getters for:

```solidity
function getVote(bytes32 submissionId, address voter) external view returns (int8);
function getVoteTotals(bytes32 submissionId) external view returns (uint64 upvotes, uint64 downvotes);
```

### Existing Functions To Preserve

Keep equivalent semantics for:

- `registerBoard`
- `updateBoardMetadata`
- `declareCurator`

### Contract File List

Likely files:

- `contracts/src/SwarmitRegistryV2.sol`
- `contracts/test/SwarmitRegistryV2.t.sol`

You may also want:

- deployment script/config updates if the repo already has a deployment flow

### Contract Tests To Add

Minimum coverage:

- successful board registration still works
- successful metadata update still works
- `SubmissionAnnounced` no longer includes `submissionRef`
- successful submission announcement stores existence / board / root
- duplicate `submissionId` announcement reverts
- top-level submission sentinel rules still enforced
- reply sentinel rules still enforced
- `setVote(1)` from zero state increments upvotes
- `setVote(-1)` from zero state increments downvotes
- `setVote(0)` without previous vote reverts
- `1 -> -1` flips correctly
- `-1 -> 1` flips correctly
- `1 -> 0` clears correctly
- `-1 -> 0` clears correctly
- no-op repeat vote reverts
- voting unknown submission reverts
- `VoteSet` emits correct:
  - `boardId`
  - `submissionId`
  - `voter`
  - `rootSubmissionId`
  - `direction`
  - `previousDirection`
  - post-transition totals

## SPA Implementation

Repo:

- `/Users/florian/Git/freedom-dev/swarmit`

### Overall SPA Goal

The SPA should support:

- reading vote totals for posts and replies
- reading the current connected wallet's vote for posts and replies
- writing upvote/downvote/clear actions through the wallet
- showing pending vote state honestly

Do not wait for curator ranked feeds to implement vote UI.

For the first pass, the SPA can render raw vote counts directly from chain state.

### Chain Layer Changes

Likely files:

- `src/chain/contract.js`
- `src/chain/events.js`
- `src/chain/transactions.js`
- `src/config.js`

#### `src/chain/contract.js`

Add ABI fragments for:

- `VoteSet` event
- `setVote(bytes32,int8)`
- `getVote(bytes32,address)` if implemented
- `getVoteTotals(bytes32)` if implemented

Update exported topic hashes accordingly.

#### `src/chain/transactions.js`

Add:

```js
setVote({ submissionRef, direction })
```

Behavior:

- accept normalized `bzz://` submission ref at the public API boundary
- convert to on-chain `bytes32` using the existing reference helpers
- call `ethereum.sendTransaction()` with encoded calldata

Public API guidance:

- `direction` should be one of `1`, `0`, `-1`
- reject invalid values before wallet prompt

Also update submission-announcement writes:

- when publishing a submission, derive `submissionId = refToBytes32(submissionRef)`
- call V2 `announceSubmission(boardId, submissionId, parentSubmissionId, rootSubmissionId)`
- do not pass `submissionRef` to the contract

#### `src/chain/events.js`

Add vote read helpers.

At minimum:

- `getVotesForSubmission(submissionRef)` or `getVoteTotalsForSubmission(submissionRef)`
- `getUserVoteForSubmission(submissionRef, voterAddress)` if using contract reads

Preferred first pass:

- use direct contract reads for current vote totals and current user vote
- do not derive current totals by replaying all `VoteSet` events in the SPA

The event stream is primarily for curator/indexer use.

Also update `SubmissionAnnounced` decoding for V2:

- derive `submissionRef = bytes32ToRef(submissionId)` off-chain
- do not expect `submissionRef` in the event payload

### New SPA Composable

Add a vote composable, likely:

- `src/composables/useVotes.js`

Responsibilities:

- take `submissionRef`
- derive current vote totals
- derive current connected user's vote
- expose actions:
  - `upvote()`
  - `downvote()`
  - `clearVote()`
- expose pending tx state and errors

Recommended semantics:

- clicking upvote when current vote is `1` should send `0`
- clicking downvote when current vote is `-1` should send `0`
- clicking opposite direction should flip directly

Return shape suggestion:

```js
{
  upvotes,
  downvotes,
  score,
  myVote,
  isVoting,
  error,
  upvote,
  downvote,
  clearVote,
}
```

### UI Surfaces To Update

Likely files:

- `src/components/PostCard.vue`
- `src/components/ReplyNode.vue`
- `src/views/SubmissionDetailView.vue`
- possibly `src/views/ThreadView.vue`

#### Replace current mocked arrows

The current vote arrows are placeholder UI. Replace them with live controls.

Requirements:

- support both posts and replies
- target the submission, not the content object
- show current count
- show current user vote state
- show pending wallet tx state
- avoid pretending a vote is final before confirmation unless explicitly shown as pending

Recommended first-pass display:

- net score (`upvotes - downvotes`)
- active styling when `myVote === 1` or `myVote === -1`
- subtle loading state while vote tx is pending

### Submission ID Boundary

Votes target `submissionId`, which in the SPA means:

- use the canonical normalized `bzz://...` form in UI-facing code when convenient
- convert to `bytes32` at the write/read chain boundary
- derive normalized `bzz://...` refs from `submissionId` when decoding V2 chain events

Do not invent a second client-side identity.

### SPA Tests To Add

Likely areas:

- `src/chain/transactions.js`
- `src/chain/events.js`
- new `useVotes.js`

Minimum coverage:

- `submissionRef -> bytes32` vote call encoding
- `submissionId -> submissionRef` derivation for V2 `SubmissionAnnounced` decoding
- invalid direction rejected
- toggling same vote maps to clear
- flip up -> down maps correctly
- flip down -> up maps correctly
- current score derived correctly from totals

If the SPA currently has limited UI test coverage, prioritize:

- chain helper tests
- composable tests

before adding component tests.

## Curator Implementation

Repo:

- `/Users/florian/Git/freedom-dev/swarmit-curator`

### Overall Curator Goal

The curator should:

- ingest canonical raw vote signals from chain
- maintain internal current vote state / totals
- expose those signals to ranking logic
- continue publishing the same chronological feeds by default for now

Do not block implementation on ranked views.

The first pass should make votes available to the curator, even if no new ranked feed is published yet.

### Chain Reader Changes

Likely file:

- `src/chain/reader.js`

Add:

- `VoteSet` event ABI
- topic handling
- decoding support

Extend the reader return shape to include:

- `votes`

Each decoded vote event should include:

- `boardId`
- `submissionId`
- `voter`
- `rootSubmissionId`
- `direction`
- `previousDirection`
- `upvotes`
- `downvotes`
- `blockNumber`
- `logIndex`

Also update V2 `SubmissionAnnounced` decoding:

- treat `submissionId` as the only contract-level submission identity
- derive canonical `submissionRef = bytes32ToRef(submissionId)` off-chain for Swarm fetches and state keys

### Curator State Changes

Likely file:

- `src/indexer/state.js`

Add persistent vote-related state.

Recommended shape:

```js
votesBySubmissionId: {
  [submissionIdHex]: {
    submissionRef,
    upvotes,
    downvotes,
    score,
    byVoter: {
      [addressLower]: 1 | -1 | 0
    },
    updatedAtBlock,
    updatedAtLogIndex
  }
}
```

If other curator modules prefer normalized `bzz://...` refs, derive them from `submissionId` rather than trusting any chain-supplied string.

If storing per-voter state feels too heavy for JSON persistence, this is an acceptable first-pass compromise:

- persist only aggregate counts
- trust the event stream plus contract semantics for correctness

But if you want rebuildable deterministic state from events, storing per-voter effective direction is cleaner.

### Orchestrator Changes

Likely file:

- `src/indexer/orchestrator.js`

Add vote handling to the poll loop:

1. fetch vote events alongside board/submission/curator events
2. apply them to curator state
3. mark affected submissions / boards / roots as dirty for future ranking logic

Important:

- vote events should not require fetching any Swarm content
- they are pure chain-derived state transitions

### Ranking Hooks

Likely files:

- `src/indexer/board-indexer.js`
- `src/indexer/thread-indexer.js`
- `src/indexer/global-indexer.js`

For this pass:

- keep chronological default output as-is
- do not change published ordering yet unless explicitly desired

But refactor indexers so they can later consume vote-derived ranking inputs cleanly.

Good first-pass hook:

- expose a helper that returns vote totals / score for a given `submissionId`
- keep actual sorting unchanged for now

### Curator Tests To Add

Likely files:

- `test/chain/reader.test.js`
- `test/orchestrator/process-events.test.js`
- `test/indexer/state.test.js`
- possibly new vote-focused test files

Minimum coverage:

- `VoteSet` decoding
- vote event application to current state
- upvote from zero
- downvote from zero
- clear from upvote
- clear from downvote
- flip up -> down
- flip down -> up
- out-of-order protection if relevant
- persistence round-trip for vote state

## Recommended Implementation Order

### Phase 1: Contract

1. write `SwarmitRegistryV2.sol`
2. write/update Foundry tests
3. deploy to Gnosis
4. update SPA and curator config with the new address

### Phase 2: SPA Raw Vote Support

1. add ABI fragments
2. add `setVote` transaction helper
3. add contract read helpers for current vote / totals
4. add `useVotes.js`
5. wire real vote controls into post/reply UI

### Phase 3: Curator Vote Ingestion

1. decode `VoteSet`
2. update `SubmissionAnnounced` handling for V2 `submissionId`-only events
3. persist vote state
4. expose vote state to indexers
5. keep current default feeds chronological

### Phase 4: Later Follow-Up

Only after the above is stable:

1. implement the multi-view feeds patch
2. publish ranked named views such as `best` / `hot` / `controversial`

## Acceptance Criteria

### Contract

- `SwarmitRegistryV2` compiles
- all new vote tests pass
- duplicate submission announcements are rejected
- vote totals and per-wallet vote state behave correctly

### SPA

- users can upvote/downvote/clear on posts
- users can upvote/downvote/clear on replies
- current vote counts render from chain
- current wallet vote renders from chain
- vote buttons reflect pending tx state honestly

### Curator

- curator ingests `VoteSet` events without breaking existing indexing
- vote state persists across restart
- default chronological feeds still publish successfully
- vote state is available for later ranking logic

## Explicit Non-Goals For This Implementation Pass

Do not implement yet:

- ranked multi-view feed publishing
- time-windowed score variants
- self-vote filtering
- anti-sybil mechanisms
- stake weighting
- reputation weighting
- batch voting methods

## Final Note

The most important design boundary to preserve is this:

- on-chain votes are canonical raw inputs
- curator ranking remains non-canonical output

If any implementation detail starts collapsing those two layers together, that is a design regression.
