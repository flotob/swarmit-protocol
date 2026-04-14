# Global Index Board Slug Patch

Date: 2026-04-14
Status: Draft patch proposal for the next protocol release

## Purpose

This document proposes a next-release schema patch for `globalIndex` entries so cross-board feeds remain self-describing for human-facing clients.

The intent is:

- keep `boardId` as the canonical machine identifier
- restore direct access to the human-readable board route key in cross-board feeds
- avoid forcing SPAs to reconstruct `boardId -> slug` mappings just to render or route global feed entries
- make `globalIndex` entries internally self-consistent by carrying both board identity forms explicitly

## Summary of Changes

1. Keep `globalIndex.entries[].boardId` as the canonical `bytes32` board identifier
2. Add required `globalIndex.entries[].boardSlug` as the canonical human-readable board slug
3. Require `boardSlug` to satisfy the canonical slug rules
4. Require `boardId === keccak256(bytes(boardSlug))`
5. Treat this as an off-chain protocol-object/schema patch, not a smart-contract patch

## Problem Statement

Under the adopted V3 registry/schema patch, `boardId` now means the same thing everywhere:

- on-chain: `bytes32 boardId`
- off-chain protocol objects: `0x`-prefixed 32-byte hash

That cleanup removed an ambiguity in the data model, but it also removed an accidental convenience that some clients were relying on.

In the old experimental shape, a `globalIndex` entry often used:

```json
{
  "boardId": "tech",
  "submissionId": "bzz://SUBMISSION_REF",
  "submissionRef": "bzz://SUBMISSION_REF"
}
```

That was semantically loose, but convenient for UI code because the field could be used directly as:

- a route slug
- a display label like `r/tech`
- a lookup key for board-specific UI state

In the new V3 shape, the same entry now looks conceptually like:

```json
{
  "boardId": "0x72c3936f97a420f89c999b2f7642e9203ca44f2e72e4506f69a989a5250c8266",
  "submissionId": "bzz://SUBMISSION_REF",
  "submissionRef": "bzz://SUBMISSION_REF"
}
```

That is semantically correct, but it is not self-describing enough for a cross-board client.

A board-scoped feed does not need the slug embedded in every entry because the board context is already known.

A global feed is different:

- it spans many boards
- it is a human-facing feed, not only a machine-facing index
- clients need the board slug immediately for routing and display

Without that slug, a client must reconstruct a reverse mapping from some external source such as:

- chain event history
- cached board metadata
- curator profile board maps

That extra resolution step is avoidable if the `globalIndex` entry simply carries the slug explicitly.

## Why This Patch Belongs in the Object Schema

This patch does not concern the registry contract.

The contract already does the right thing:

- `boardId` is the stable compact on-chain identifier
- `BoardRegistered` emits both `boardId` and `slug`

The problem is in the shape of curator-published Swarm objects.

`globalIndex` is an off-chain protocol object, so this patch belongs to:

- protocol spec text
- JS builders and validators
- curator output
- SPA consumption

It does not require:

- a new contract method
- new on-chain storage
- contract redeployment

## Rationale

### Why `boardId` should stay

This patch does not propose reverting the V3 board-identity cleanup.

Keeping hashed `boardId` is still useful because it preserves one consistent machine identifier across:

- contract writes and events
- board metadata objects
- submission objects
- curator indexes

That consistency is valuable and should remain.

### Why `boardSlug` should also be present in global entries

`globalIndex` is a cross-board UX object.

For that specific object type, clients usually need both:

- the machine identifier
- the human route/display key

This is not unusual in the protocol.

The board metadata object already carries both:

- `boardId`
- `slug`

The same principle applies here.

For global feed entries:

- `boardId` is useful for identity consistency and cross-checking
- `boardSlug` is useful for display, routing, and board-aware UI state

### Why clients should not be forced to reverse-map at render time

It is possible for a client to reconstruct `boardId -> slug` from outside sources.

But that should not be mandatory for the common case of rendering a curated global feed.

Reasons:

- it adds avoidable complexity to SPA code
- it creates one more async dependency in a hot UI path
- it makes feed objects less self-contained
- it increases the chance of partial rendering failures or stale mappings

This project is pre-release, so we can fix the schema at the source instead of normalizing around a workaround.

## Design Principles

1. `boardId` remains the canonical machine identifier.
2. Human-facing cross-board feed entries should be self-describing.
3. `globalIndex` entries should carry the canonical board slug when that slug is necessary for routing and display.
4. If both `boardId` and `boardSlug` are present, validators should require them to match deterministically.
5. This patch should minimize churn by changing only the object type that actually needs the extra field.

## Recommended Schema Change

This patch recommends changing each `globalIndex` entry from:

```json
{
  "boardId": "0xBOARD_ID",
  "submissionId": "bzz://SUBMISSION_REF",
  "submissionRef": "bzz://SUBMISSION_REF"
}
```

to:

```json
{
  "boardId": "0xBOARD_ID",
  "boardSlug": "tech",
  "submissionId": "bzz://SUBMISSION_REF",
  "submissionRef": "bzz://SUBMISSION_REF"
}
```

## Field Rules

For each `globalIndex.entries[]` item:

- `boardId` MUST be a valid `0x`-prefixed 32-byte hex hash
- `boardSlug` MUST be a canonical board slug
- `submissionId` MUST be a normalized `bzz://` reference
- `submissionRef` MUST be a normalized `bzz://` reference
- `boardId` MUST equal `keccak256(bytes(boardSlug))`

## Recommended Builder Semantics

`buildGlobalIndex()` should require each entry to provide both:

- `boardId`
- `boardSlug`

The builder may optionally derive `boardId` from `boardSlug` if we want an ergonomic helper surface, but the resulting object must always contain both.

For curator code, the recommended emission pattern is straightforward:

- internal state may remain slug-keyed
- when constructing global feed entries, emit:
  - `boardSlug: slug`
  - `boardId: slugToBoardId(slug)`

## Recommended Validator Semantics

The `globalIndex` validator should:

1. require `boardId`
2. require `boardSlug`
3. require `submissionId`
4. require `submissionRef`
5. validate `boardSlug` with the canonical slug rules
6. validate `boardId` as `bytes32`
7. reject entries where `boardId !== slugToBoardId(boardSlug)`

Normative shape equivalent:

```md
- `globalIndex.entries[].boardId` MUST be a valid `0x`-prefixed 32-byte board identifier
- `globalIndex.entries[].boardSlug` MUST be a canonical board slug
- `globalIndex.entries[].boardId` MUST equal `keccak256(bytes(globalIndex.entries[].boardSlug))`
```

## Why This Patch Is Narrowly Scoped to `globalIndex`

This patch does not propose adding `boardSlug` everywhere.

That would create unnecessary churn.

The specific object types do not all have the same needs:

- `board` already includes both `boardId` and `slug`
- `submission` does not need `boardSlug` because it is primarily an identity and placement object
- `boardIndex` does not need `boardSlug` on every entry because the feed itself is already board-scoped
- `userFeedEntry` already includes `boardSlug`
- `globalIndex` is the one cross-board UI object that immediately benefits from carrying both forms

So the recommended scope is intentional and minimal.

## Example

Recommended `globalIndex` example after this patch:

```json
{
  "protocol": "freedom-board/global-index/v1",
  "curator": "0xCurator",
  "updatedAt": 1773792180000,
  "entries": [
    {
      "boardId": "0x72c3936f97a420f89c999b2f7642e9203ca44f2e72e4506f69a989a5250c8266",
      "boardSlug": "tech",
      "submissionId": "bzz://SUBMISSION_REF",
      "submissionRef": "bzz://SUBMISSION_REF"
    }
  ]
}
```

## Implementation Guidance

If adopted, the implementation work should be grouped as:

1. `swarmit-protocol`
   - update spec text
   - update `buildGlobalIndex` expectations if needed
   - update `validateGlobalIndex`
   - update tests and fixtures
2. `swarmit-curator`
   - emit `boardSlug` on every global entry
   - keep emitting hashed `boardId`
   - update tests
3. `swarmit`
   - consume `entry.boardSlug` for routing and display in cross-board feeds
   - stop treating `entry.boardId` as a human-readable slug

## Backward Compatibility

This patch is breaking relative to the current V3 object schema because it makes `boardSlug` required in `globalIndex.entries[]`.

That is acceptable in the current project phase because:

- the project is pre-release
- there are no external users to preserve compatibility for
- curator output can be regenerated
- the SPA and curator can be updated together

No chain migration is required because this is not a contract-state change.

## Explicit Non-Goals

This patch does not:

- change `SwarmitRegistryV3`
- change `BoardRegistered`
- change board registration semantics
- revert the canonical `boardId` model
- add `boardSlug` to every protocol object indiscriminately
- require the SPA to query the chain for board names during global-feed render

## Open Questions

1. Should `buildGlobalIndex()` derive `boardId` from `boardSlug` automatically, or should it require callers to pass both and let validation enforce consistency?
   - Requiring both is stricter and makes mismatches more visible.
   - Deriving one from the other is more ergonomic for builders.
2. Should `submissionId` and `submissionRef` remain duplicated in `globalIndex` entries?
   - This patch intentionally leaves that question alone, but it may be worth revisiting separately if we want to simplify index objects further.
