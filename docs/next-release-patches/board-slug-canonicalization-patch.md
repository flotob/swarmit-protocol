# Board Slug Canonicalization Patch

Date: 2026-04-10
Status: Draft patch proposal for the next protocol release

## Purpose

This document proposes a next-release protocol change that makes board slugs canonical at the contract layer instead of leaving normalization to client convention.

The intent is:

- make the board namespace deterministic and case-stable
- prevent duplicate registrations such as `tech` and `Tech`
- move slug canonicalization from "best practice" to contract-enforced invariant
- simplify board registration by deriving `boardId` on-chain from the canonical slug

## Summary of Changes

1. Define board slugs as canonical lowercase ASCII identifiers
2. Require `registerBoard` to reject non-canonical slugs on-chain
3. Compute `boardId` inside the contract as `keccak256(bytes(slug))`
4. Remove caller-supplied `boardId` from the board-registration write interface
5. Keep `BoardRegistered` emitting `boardId`, `slug`, `boardRef`, and `governance`
6. Keep board metadata updates keyed by stable `boardId`
7. Recommend UI-level lowercasing for convenience, while keeping the contract strict

## Problem Statement

In the current v1 contract shape:

- `boardId` is derived from the exact bytes of `slug`
- uniqueness is enforced on `boardId`
- the contract does not validate slug canonical form

That means visually similar slugs can become different board namespaces:

- `tech`
- `Tech`
- `TECH`

Those variants hash to different `boardId` values and can therefore be registered independently.

That behavior is technically consistent but socially wrong for a human-readable namespace.

For boards, the slug is not just an opaque payload. It is:

- the route key users type and share
- the string curators and clients use in board-scoped maps
- the human-readable face of the board identity

So canonicalization belongs at the protocol boundary, not only in app code.

## Rationale

### Why contract enforcement matters

Client-only normalization is not enough.

If one client lowercases before submit but another does not, the contract still permits divergent registrations. That creates avoidable namespace splits and confusing discovery behavior.

Putting the rule on-chain makes all compliant clients converge on the same namespace behavior.

### Why strict rejection is preferable to silent on-chain normalization

This patch recommends that the contract reject non-canonical input rather than silently rewrite it.

Reasons:

- it keeps the transaction surface explicit and predictable
- it prevents callers from believing they registered one slug while the contract actually stored another
- it matches the stricter direction already used in the username work: UI may normalize for convenience, but the contract remains authoritative and explicit

### Why `boardId` should still exist

This patch does not remove `boardId` as a protocol concept.

`boardId` still serves as:

- the compact on-chain board identifier
- the stable key used by submissions and governance mappings
- the efficient indexed value emitted in board-related events

What changes is only the write API: `boardId` should be derived inside the contract instead of being redundantly supplied by the caller.

## Design Principles

1. Human-readable board namespaces MUST be canonical.
2. Board slug interpretation MUST NOT depend on which client submitted the transaction.
3. The contract SHOULD reject non-canonical slug input rather than normalize it silently.
4. `boardId` SHOULD be derived from the canonical slug inside the contract.
5. Board identity MUST remain stable after registration.
6. UI convenience normalization MAY exist, but contract validation is authoritative.

## Canonical Slug Rules

This patch proposes the following canonical board-slug rules for the next release.

A valid slug MUST:

- be non-empty
- contain only lowercase ASCII letters `a-z`, digits `0-9`, or hyphen `-`
- not begin with `-`
- not end with `-`
- not contain consecutive hyphens `--`

Interpretation notes:

- uppercase ASCII is invalid
- non-ASCII characters are invalid
- whitespace is invalid
- clients may lowercase and trim user input before submission for convenience, but the contract MUST validate the canonical form that it receives

## Canonical Identity Rule

For the next release, the canonical on-chain board identity is:

```text
boardId = keccak256(bytes(slug))
```

where `slug` is already guaranteed to be canonical by contract validation.

Consequences:

- the namespace becomes case-stable
- the same canonical slug always maps to the same `boardId`
- `boardId` remains deterministic and easy to derive off-chain

## Recommended Contract Surface

### Event

Keep the board-registration event shape:

```solidity
event BoardRegistered(
  bytes32 indexed boardId,
  string slug,
  string boardRef,
  address governance
);
```

This still provides:

- a compact indexed identifier
- a human-readable route string
- a direct pointer to the immutable board metadata object

### Write Methods

Recommended next-release write surface:

```solidity
function registerBoard(
  string calldata slug,
  string calldata boardRef
) external;

function updateBoardMetadata(
  bytes32 boardId,
  string calldata boardRef
) external;
```

`registerBoard` should:

1. validate that `slug` is canonical
2. validate that `boardRef` is non-empty
3. compute `boardId = keccak256(bytes(slug))`
4. fail if that `boardId` is already registered
5. assign governance to `msg.sender`
6. emit `BoardRegistered(boardId, slug, boardRef, msg.sender)`

`updateBoardMetadata` can remain keyed by `boardId` because:

- `boardId` is the stable machine identifier
- the method is governance-only anyway
- metadata updates do not need to re-resolve slug text

## Normative Patch Relative to Current v1 Spec

If this proposal is adopted for the next release, the next canonical protocol spec should replace the current soft guidance around board slugs with strict canonical rules.

### Board Rules

Replace the current board-slug guidance with normative text equivalent to:

```md
- `board.slug` MUST be canonical lowercase ASCII.
- Valid slug characters are `a-z`, `0-9`, and `-`.
- `board.slug` MUST NOT begin or end with `-`.
- `board.slug` MUST NOT contain consecutive `--`.
- `board.boardId` MUST be derived from the canonical slug as `keccak256(bytes(slug))`.
```

### Board Registration

The next contract spec should define board registration semantics equivalent to:

```md
- `registerBoard` MUST reject non-canonical slugs.
- `registerBoard` MUST derive `boardId` internally from the validated slug.
- `registerBoard` MUST fail if that derived `boardId` is already registered.
- `BoardRegistered.slug` MUST be emitted in canonical form.
```

## Client and Library Guidance

Shared library support should make the canonical rule easy to reuse.

Recommended helpers:

- `normalizeBoardSlugInput(slug)`:
  - trims surrounding whitespace
  - lowercases ASCII for UI convenience
- `validateBoardSlug(slug)`:
  - returns validation errors for canonical contract form
- `isValidBoardSlug(slug)`:
  - boolean convenience wrapper
- `slugToBoardId(slug)`:
  - hashes only canonical slug input

Important:

- UI normalization is a convenience layer
- contract validation is the source of truth
- callers should not rely on the contract to silently repair invalid slug input

## Backward Compatibility

This patch is not backward-compatible with the current experimental registry shape that permits arbitrary non-empty slugs.

That is acceptable in the current project phase.

At the time of writing:

- the protocol is still pre-release
- there is no meaningful external user-generated data to preserve
- existing boards and test data can be discarded
- a fresh contract deployment is the expected rollout model for this change

So this patch does not try to preserve compatibility with earlier experimental registrations. It defines the desired invariant for the next release and assumes a clean reset is acceptable.

## Explicit Non-Goals

This patch does not:

- define board renaming after registration
- define aliasing from old slugs to new slugs
- define Unicode case-folding or locale-aware normalization
- auto-migrate legacy boards
- change how `boardRef` works
- remove `boardId` from events or downstream indexing

## Open Questions

1. Should the next release also impose a maximum slug length?
   - A bounded length would help keep event payloads and validation costs more predictable.
   - This draft leaves the exact bound open for now.
2. Should the next release expose an on-chain pure/view slug validator helper?
   - Not required for correctness, but it could help external tooling mirror the rule.

## Implementation Guidance

If adopted, implementation should include:

- contract-side slug validation tests
- tests proving `tech` and `Tech` cannot coexist in the new registry
- shared library slug-validation helpers
- client-side preflight validation so users get immediate feedback before signing

The recommended product posture is:

- normalize in the UI for convenience
- validate strictly in the contract
- display the canonical slug everywhere
