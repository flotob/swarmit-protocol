# Vote Stats Read Helper Patch

Date: 2026-04-10
Status: Draft patch proposal for the next protocol release

## Purpose

This document proposes a next-release contract-surface improvement for reading vote state more efficiently and more ergonomically.

The intent is:

- keep the existing canonical vote model
- keep separate upvote and downvote totals
- avoid forcing clients to assemble vote state from multiple tiny getters
- provide one canonical packed read for the most common vote-state query shape

## Summary of Changes

1. Keep `voteOf`, `upvoteCount`, and `downvoteCount` as the underlying canonical state
2. Add a packed view helper:
   - `voteStats(bytes32 submissionId, address voter) view returns (uint64 upvotes, uint64 downvotes, int8 direction)`
3. Keep current event and write semantics unchanged
4. Do not replace separate counts with net-only state
5. Do not rely on `msg.sender` for vote-direction reads

## Problem Statement

The current vote surface exposes state through separate public mapping getters:

- `voteOf(submissionId, voter)`
- `upvoteCount(submissionId)`
- `downvoteCount(submissionId)`

That works, but it means the common "render vote state for this submission" read path requires multiple calls per item.

For a client that wants:

- total upvotes
- total downvotes
- the current viewer's vote direction

the contract shape requires three separate reads per submission.

Multicall3 makes that operationally acceptable, but the surface is still awkward:

- the client has to build more sub-calls
- the ABI is more fragmented than the product need
- every reader has to reconstruct the same little bundle of state

This is not a protocol correctness problem. It is a contract ergonomics problem.

## What This Patch Is Not

This patch is not arguing that the protocol should store only net score.

That would be the wrong simplification.

Separate `upvoteCount` and `downvoteCount` remain useful because:

- curators may want ranking algorithms that depend on both values independently
- analytics and moderation tooling may want to inspect polarity, not only net
- future clients may want to display split counts directly

So the right improvement is not "collapse the model to net score." The right improvement is "keep the richer model, but expose a better read helper."

## Rationale

### Why separate counts still make sense

Even if one SPA currently renders only net score, the protocol surface should preserve richer vote information.

Examples of consumers that benefit from split counts:

- controversial-score ranking
- Wilson-score ranking
- ratio-based filtering
- analytics dashboards
- future clients that want to show `up/down` separately

So this patch assumes the current split-count model is correct.

### Why a packed getter still helps

Even with Multicall3, a packed getter still improves things:

- fewer sub-calls inside the multicall aggregate
- cleaner client code
- clearer intent at the ABI level
- easier reuse across SPA, curator, dashboard, and scripts

This is mostly an ergonomics and node-execution optimization, not a user-visible HTTP optimization.

### Why the getter should take `address voter`

The helper should not try to infer the caller's direction from `msg.sender`.

Recommended shape:

```solidity
function voteStats(bytes32 submissionId, address voter)
    external
    view
    returns (uint64 upvotes, uint64 downvotes, int8 direction);
```

This matters because many consumers will read through:

- Multicall3
- indexers
- backend services
- scripts

In those contexts, `msg.sender` is the calling contract or RPC execution context, not the end-user wallet whose vote direction we want to inspect.

So an explicit `voter` argument is the correct and general form.

## Design Principles

1. The contract should preserve the full raw vote model.
2. Common read paths should not require unnecessary ABI fragmentation.
3. Packed read helpers should be explicit about whose vote direction is being requested.
4. Read ergonomics may improve without changing write semantics.
5. Future clients and curators should have easy access to both totals and per-voter direction.

## Recommended Contract Surface

This patch recommends adding:

```solidity
function voteStats(bytes32 submissionId, address voter)
    external
    view
    returns (uint64 upvotes, uint64 downvotes, int8 direction);
```

Semantics:

- `upvotes` = current `upvoteCount[submissionId]`
- `downvotes` = current `downvoteCount[submissionId]`
- `direction` = current `voteOf[submissionId][voter]`

This helper is purely a read convenience wrapper over existing canonical state.

It does not introduce any new source of truth.

## Recommended Implementation Notes

The helper should:

1. read `upvoteCount[submissionId]`
2. read `downvoteCount[submissionId]`
3. read `voteOf[submissionId][voter]`
4. return those values in a single ABI response

The helper should not:

- mutate state
- perform any normalization of `voter`
- infer voter identity from `msg.sender`
- introduce a separate stored struct just for read packing

## Interaction with Existing Getters

This patch does not require removing the existing getters.

Depending on the contract design for the next release, we may still keep:

- `voteOf`
- `upvoteCount`
- `downvoteCount`

Reasons to keep them:

- they are simple and transparent
- they are useful for low-level tooling
- they match the underlying storage model directly

So the packed helper should be viewed as an additive ergonomic improvement, not a conceptual replacement of the base read surface.

## Why Not `netScore`

This patch intentionally does not propose:

```solidity
function netScore(bytes32 submissionId) external view returns (int64);
```

as the primary improvement.

A net-score helper could be added later if desired, but it should not replace access to split totals.

From a protocol perspective:

- `up = 100, down = 0`
- `up = 1000, down = 900`

both produce positive net values, but they are not the same social signal.

The protocol should continue to preserve that distinction.

## Normative Patch Relative to the Current Vote Model

If adopted, the next contract spec should add read guidance equivalent to:

```md
- the contract SHOULD expose a packed vote-state helper that returns upvotes, downvotes, and per-voter direction for a submission in one call
- the packed helper SHOULD accept the voter address explicitly rather than infer it from `msg.sender`
- the packed helper MUST reflect the same canonical state already exposed by `voteOf`, `upvoteCount`, and `downvoteCount`
```

## Backward Compatibility

This patch is additive in spirit but can be implemented however we prefer in the next-release contract.

Because the project is still pre-release:

- there is no need to preserve the exact experimental ABI
- there is no meaningful external data migration constraint
- we can add this helper whenever we cut the next registry version

So the decision here should be based on design cleanliness, not on compatibility anxiety.

## Explicit Non-Goals

This patch does not:

- change `VoteSet`
- change `setVote`
- change vote semantics
- replace separate up/down totals with net-only state
- define ranking algorithms
- add batch reads as a mandatory requirement

## Open Questions

1. Should the next release also add a batch helper?
   - Example: `voteStatsBatch(bytes32[] submissionIds, address voter)`
   - This could simplify some clients further, but it is not necessary to capture the main ergonomic win.
2. Should the next release also add a convenience `netScore` helper?
   - Possibly harmless as a secondary helper.
   - It should not become the canonical or only vote-total read surface.
3. Should indexers prefer the packed helper or continue reading raw getters directly?
   - Likely a tooling choice rather than a protocol requirement.

## Implementation Guidance

If adopted, implementation should include:

- Solidity tests for `voteStats(submissionId, voter)`
- tests proving the helper matches the underlying mapping getters exactly
- shared library ABI updates
- client read-path simplification where appropriate

Recommended product posture:

- keep rendering policy client-defined
- keep ranking policy curator-defined
- make reading the raw canonical vote state less annoying
