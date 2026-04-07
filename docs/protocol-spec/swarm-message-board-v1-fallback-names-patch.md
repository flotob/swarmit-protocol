# Swarm Message Board v1 Deterministic Fallback Names Patch

Date: 2026-04-07
Status: Draft patch proposal

## Purpose

This document proposes a v1 protocol extension that standardizes deterministic fallback display names for wallet addresses.

The intent is:

- keep the wallet address as the canonical identity
- give clients a shared, human-friendly default label for addresses
- avoid adding any write requirement just to get a readable name
- leave a clean precedence slot for a future explicit username system such as an on-chain registry

This patch does not define that future registry. It defines only the fallback layer and the resolution rules around it.

## Summary of Changes

1. Add a standardized client-side display-name resolution rule for protocol-visible addresses
2. Define a deterministic `fallbackNameV1(address)` algorithm
3. Define fallback names as display labels only, not canonical identifiers
4. Reserve higher-precedence slots for explicit names already present in protocol context or added by a future standardized username registry
5. Do not change:
   - contract surface
   - Swarm object schemas
   - canonical authorship identity

## Rationale

Right now, user identity is technically solid but socially cold:

- authors are their wallet addresses
- curators can have `curatorProfile.name`, but ordinary authors cannot
- clients therefore fall back to truncated addresses such as `0x1234...abcd`

That is workable, but not fun.

A deterministic fallback-name layer improves UX immediately:

- every address gets a stable human-readable label
- no extra transaction is needed
- no extra Swarm object is needed
- every compliant client can show the same name for the same address

This also composes cleanly with a future monetized name system:

- explicit chosen names can later override the fallback
- old content remains valid because identity is still the address
- clients that do not support the later registry still have a standard fallback

## Design Principles

1. Canonical identity remains the wallet address.
2. The same address MUST map to the same fallback name in every compliant client.
3. The fallback algorithm MUST be pure, local, and require no network lookup.
4. The fallback algorithm MUST be versioned so future naming styles can coexist cleanly.
5. Fallback names SHOULD be more human-friendly than truncated addresses.
6. Fallback names MUST NOT become routing keys, signing targets, or access-control inputs.
7. Explicit names SHOULD override fallback names when available.

## Name Resolution Model

When a client needs to render a human-readable label for a protocol-visible address, it SHOULD apply the following precedence:

1. If the current protocol context already provides an explicit human-readable label bound to that identity, use it.
   - Example: `curatorProfile.name` for the address in `curatorProfile.curator`
2. Else, if a future standardized username registry is supported by the client and returns a name for that address, use it.
3. Else, derive the standardized deterministic fallback name via `fallbackNameV1(address)`.
4. Else, fall back to truncated-address presentation.

Important consequences:

- the canonical identity is still the address
- routes such as `/u/<address>` SHOULD remain address-based
- clients SHOULD make the underlying address easy to inspect wherever identity precision matters

## Normative Patch for `swarm-message-board-v1-spec.md`

### Patch Section 5.1 `Author`

Append the following normative text:

```md
In v1, an author's canonical identity is their wallet address.

Human-readable author labels are a client-resolution concern layered on top of that address identity. A client MAY render an explicit name if one is available from the active protocol context or a future standardized username system, but such labels do not replace the canonical address identity.
```

### Patch Section 5.2 `Curator`

Append the following normative text:

```md
`curatorProfile.name` is an explicit curator-provided display label, not a replacement for the curator's canonical address identity.
```

### Add New Section 7.11 `Human-readable Address Labels`

Insert after current Section 7.10:

```md
### 7.11 `Human-readable Address Labels`

Purpose:

- standardize a deterministic default display label for wallet addresses when no stronger explicit name is available

Rules:

- the canonical identity of an author, curator, or other protocol-visible wallet remains the address itself
- clients MUST NOT treat fallback names as canonical identifiers
- clients MUST NOT use fallback names for routing, authorization, access control, or signature targets
- if the current protocol context already supplies an explicit human-readable label for the same identity, clients SHOULD prefer that explicit label
- otherwise, clients SHOULD derive a fallback label using the `fallbackNameV1(address)` algorithm defined below
- clients SHOULD continue to expose the underlying address where identity precision matters

`fallbackNameV1(address)` algorithm:

1. Validate that `address` is a valid 20-byte EVM address.
2. Normalize it to lowercase hexadecimal without the `0x` prefix. Call this `normalizedAddress`.
3. Compute:

   `seed = keccak256(utf8("swarmit-fallback-name-v1:" + normalizedAddress))`

4. Treat `seed` as a 256-bit big-endian bitstring and consume bits from left to right.
5. Build two pronounceable words followed by a short checksum tag.

Syllable encoding:

- Each syllable consumes 9 bits:
  - 4 bits for `onset`
  - 2 bits for `vowel`
  - 3 bits for `coda`
- `onset` table:
  - `["b", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "r", "s", "t", "v", "z"]`
- `vowel` table:
  - `["a", "e", "i", "o"]`
- `coda` table:
  - `["", "l", "n", "r", "s", "m", "k", "th"]`
- One syllable = `onset + vowel + coda`

Word and tag construction:

- Use the first 18 bits for `word1` as two consecutive syllables
- Use the next 18 bits for `word2` as two consecutive syllables
- Use the next 25 bits for `tag` as five base32 characters
- Base32 alphabet:
  - `"abcdefghijklmnopqrstuvwxyz234567"`

Output format:

- `fallbackNameV1(address) = "<word1>-<word2>-<tag>"`
- output MUST be lowercase ASCII

Interpretation guidance:

- the fallback name is intended to be human-friendly and operationally distinct at product scale
- the checksum-like `tag` is included to reduce accidental collisions between otherwise similar names
- the fallback name is not the canonical identity
- clients MUST still key all identity-sensitive behavior by address
```

### Patch Section 15 `Security and Abuse Assumptions`

Append the following normative text:

```md
Human-readable fallback names do not provide proof of identity, account ownership beyond the underlying address, uniqueness guarantees suitable for authorization, or anti-impersonation protection by themselves.

Clients SHOULD treat fallback names as convenience labels, not trust anchors.
```

## Open Questions for This Draft

1. Is the proposed output style fun enough?
   - The current draft uses a fully specified syllable-based algorithm so it can be implemented without external wordlists.
   - We may decide that a fixed adjective-plus-noun lexicon feels more playful, at the cost of freezing and maintaining those tables.
2. Is the 5-character tag long enough?
   - The current draft aims for operational distinctness at product scale.
   - If we want a larger collision margin, we can lengthen the tag without changing the rest of the model.
3. Should this standard later grow into a broader address-appearance package?
   - For example: fallback display names plus deterministic default avatars.
   - This patch deliberately limits itself to names.

## Implementation Guidance

If adopted, the shared protocol library SHOULD expose a pure helper for this algorithm so consumers do not drift.

Suggested library surface:

- `addressToFallbackName(address)`
- `FALLBACK_NAME_VERSION = "v1"`

Consumers SHOULD prefer the shared helper over local reimplementation.

Golden tests SHOULD be added with fixed address-to-name fixtures so the algorithm cannot drift silently across repos.

## Explicit Non-Goals of This Patch

This patch does not:

- add an on-chain username registry
- add a paid claim flow
- add a new Swarm object type for author profiles
- add `name` fields to `post`, `reply`, or `submission`
- make fallback names canonical identifiers
- switch user routes from address-based to name-based
- define profile pictures or avatar generation

## Backward Compatibility

This patch is backward-compatible.

It does not require:

- a contract migration
- a schema migration
- any change to existing immutable content

Old clients may continue to show truncated addresses.

Compliant upgraded clients will instead show the standardized fallback name when no stronger explicit name exists.

## Recommendation

If adopted, this patch should be merged into:

- `docs/protocol-spec/swarm-message-board-v1-spec.md`

No changes are required to:

- `docs/protocol-spec/swarm-message-board-v1-contract-spec.md`
- `docs/protocol-spec/swarm-message-board-v1-schemas.md`

because this patch changes display-layer identity resolution, not the contract or Swarm object surface.
