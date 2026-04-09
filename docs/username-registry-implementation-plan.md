# Swarmit Username Registry — Detailed Implementation Plan

Date: 2026-04-09
Status: Builder implementation plan

## Goal

Add an optional on-chain username system to Swarmit that:

- keeps wallet address as the canonical identity
- allows users to claim a transferable username
- lets clients resolve `address -> explicit username` without changing existing protocol object schemas
- composes cleanly with the already-implemented deterministic fallback names

This plan covers:

- Solidity contract work in `swarmit-protocol`
- shared JavaScript support in `swarmit-protocol`
- SPA integration in `/Users/florian/Git/freedom-dev/swarmit`
- deployment and rollout sequencing

This plan does **not** require curator changes for MVP.

---

## Decisions Already Made

These decisions are treated as fixed unless review explicitly overturns them:

- separate username registry contract
- `ERC-721` standard
- transferable usernames
- wallet address remains canonical identity
- usernames are a display-layer enhancement, not a replacement for address identity

Recommended MVP decisions in this plan:

- no `ERC721Enumerable`
- no expiry / renewal
- no Unicode
- no commit-reveal
- no reserved-name system
- no burn
- no metadata hosting requirement beyond basic ERC-721 compatibility

---

## Repos and Ownership

### Repo 1: `swarmit-protocol`

Primary owner for:

- username registry contract
- contract tests
- deploy script
- shared ABI / interface / calldata encoders
- shared pure username validation helpers
- release version bump and tag

### Repo 2: `swarmit`

Primary owner for:

- client-side username lookup
- batching and caching
- display-name precedence
- claim / set-primary transactions
- UI surfaces

### Repo 3: `swarmit-curator`

No required MVP work.

Curator indexes content and votes today. Usernames are resolved at read time by clients, so the curator can stay unaware for v1 of this feature.

---

## Product Model

### Canonical identity

Canonical identity remains the wallet address.

No protocol object is changed to embed usernames:

- no `author.name` in `post`
- no `author.name` in `reply`
- no `author.name` in `submission`
- no username field in `userFeedIndex`

This avoids stale content and keeps all authored data cryptographically anchored to the address.

### Display-name precedence

Clients should render names in this precedence order:

1. explicit contextual name already present in protocol context
   - example: `curatorProfile.name`
2. on-chain primary username
3. deterministic fallback name from `addressToFallbackName(address)`
4. truncated address

Routes remain address-based:

- `/u/<address>`

Usernames are for display, not routing or authorization.

---

## MVP Contract Design

## Contract name

Create:

- `contracts/src/SwarmitUsernameRegistry.sol`

This contract should be independent of `SwarmitRegistryV2`.

## Base contracts

Use OpenZeppelin Contracts 5.x:

- `ERC721`
- `Ownable`
- `ReentrancyGuard`

Do **not** use:

- `ERC721Enumerable`
- `ERC721URIStorage`

Reasoning:

- `ERC721` gives us transfers, approvals, and standard wallet/tooling compatibility
- `Enumerable` adds gas and storage overhead we do not need for MVP
- `URIStorage` is unnecessary unless we decide to ship custom NFT metadata immediately

## OpenZeppelin dependency

Add OpenZeppelin under `contracts/lib/`.

Preferred layout:

- `contracts/lib/openzeppelin-contracts/`

Use the same general “vendored dependency in `contracts/lib/`” approach already used for `forge-std`.

## Name rules

MVP username syntax should be intentionally strict:

- length: `3..24`
- lowercase ASCII only
- allowed chars: `a-z`, `0-9`, `-`
- no leading `-`
- no trailing `-`
- no consecutive `--`

Important:

- reject invalid names on-chain
- do not silently normalize uppercase on-chain

The SPA may lowercase input before submission for convenience, but the contract remains strict.

## Storage

Recommended storage:

```solidity
uint256 public immutable baseMintPrice;
uint256 public immutable priceStep;
uint256 private _nextTokenId = 1;

mapping(bytes32 => uint256) public tokenIdByNameHash;
mapping(uint256 => string) private _nameByTokenId;
mapping(address => uint256) public primaryTokenOf;
```

Notes:

- token IDs are sequential, not derived from the hash
- `0` is the sentinel for “none”
- no burn means `_nextTokenId - 1` is the total minted count
- `tokenIdByNameHash[nameHash] != 0` means name already claimed

## Pricing model

This plan recommends a monotonic supply-based linear price:

```solidity
currentMintPrice() = baseMintPrice + ((nextTokenId - 1) * priceStep)
```

Rationale:

- matches the product goal of “price increases with each new user”
- easy to reason about
- predictable and cheap to compute on-chain
- avoids prematurely inventing a more complex network-effect formula

Important:

- this is **not** a true Metcalfe-law model
- it is a simple monotonic pricing curve suitable for MVP

Constructor parameters:

- `baseMintPrice`
- `priceStep`
- `owner`

Recommended deployment-time choice:

- make both pricing params immutable

That keeps the economics predictable and avoids adding an admin repricing surface in v1.

## External API

Recommended external surface:

```solidity
function currentMintPrice() external view returns (uint256);
function isAvailable(string calldata name) external view returns (bool);
function claim(string calldata name, uint256 maxPrice) external payable returns (uint256 tokenId);
function setPrimaryName(uint256 tokenId) external;
function primaryNameOf(address owner) external view returns (string memory);
function nameOfToken(uint256 tokenId) external view returns (string memory);
function withdraw(address payable to) external onlyOwner;
```

Public inherited `ERC721` methods provide:

- `ownerOf`
- `approve`
- `setApprovalForAll`
- `transferFrom`
- `safeTransferFrom`

## Events

Add custom events:

```solidity
event UsernameClaimed(address indexed owner, uint256 indexed tokenId, string name, uint256 pricePaid);
event PrimaryNameSet(address indexed owner, uint256 indexed tokenId, string name);
```

The standard `Transfer` event from `ERC721` remains canonical for ownership transfer.

## Claim flow

`claim(name, maxPrice)` should:

1. validate the name
2. compute `bytes32 nameHash = keccak256(bytes(name))`
3. require name unclaimed
4. compute `price = currentMintPrice()`
5. require `price <= maxPrice`
6. require `msg.value >= price`
7. mint via `_safeMint(msg.sender, tokenId)`
8. persist `_nameByTokenId[tokenId] = name`
9. persist `tokenIdByNameHash[nameHash] = tokenId`
10. if `primaryTokenOf[msg.sender] == 0`, set it to the new token
11. refund any overpayment
12. emit `UsernameClaimed`
13. if primary auto-set happened, emit `PrimaryNameSet`

Why `maxPrice` exists:

- the price can move upward between quote time and inclusion time
- `maxPrice` gives the user slippage protection

## Refund handling

Because `claim` may accept `msg.value > currentMintPrice()`, the contract must refund the difference safely.

Recommended implementation:

- inherit `ReentrancyGuard`
- use checks-effects-interactions order
- perform refund at the end using `call`
- revert if refund fails

## Primary-name semantics

Primary-name behavior should be:

- on mint:
  - auto-set as primary if the owner has none
- on `setPrimaryName(tokenId)`:
  - require caller is owner or approved operator
  - set `primaryTokenOf[owner] = tokenId`
  - emit `PrimaryNameSet`
- on transfer:
  - if sender’s primary token was transferred away, clear sender primary
  - if recipient has no primary, auto-set transferred token as recipient primary
  - if recipient already has a primary, leave it unchanged

Implement transfer-side primary updates by overriding the OZ 5.x `_update` hook.

## Read model

The key reverse-lookup method is:

```solidity
function primaryNameOf(address owner) external view returns (string memory)
```

This is the most important MVP read because clients primarily need:

- visible address -> preferred on-chain display name

This is better for the SPA than forcing two-step reads like:

- `primaryTokenOf(address)` then `nameOfToken(tokenId)`

Keep `primaryTokenOf(address)` public anyway, but optimize the client contract surface around `primaryNameOf(address)`.

## Deliberate omissions

Do not implement yet:

- burn
- renewals
- expirations
- auctions
- short-name premiums
- reserved names
- commit-reveal anti-front-running
- subnames
- resolver records
- avatar NFTs / metadata art

---

## Shared Library Work in `swarmit-protocol`

## Pure username helpers

Extend the shared pure-name surface so username syntax is not reimplemented in every app.

Recommended additions in a pure module:

- `normalizeUsernameInput(name)` — trim + lowercase for UI convenience
- `isValidUsername(name)` — boolean
- `validateUsername(name)` — returns `string[]`
- `usernameHash(name)` — `keccak256(bytes(name))`

The fallback-name helper already exists:

- `addressToFallbackName(address)`

Do **not** mix on-chain username lookup into the pure helper module.

## New JS subpath for the registry contract

Add a dedicated subpath rather than overloading the existing `chain/` surface, which is currently about `SwarmitRegistryV2`.

Recommended new subpath:

- `swarmit-protocol/username-registry`

Suggested file layout:

```text
src/username-registry/
  abi.js
  interface.js
  encode.js
  index.js
```

Recommended exports:

- `ABI`
- `iface`
- `encode.claim({ name, maxPrice })`
- `encode.setPrimaryName({ tokenId })`

Optional convenience constants:

- `EVENTS.UsernameClaimed`
- `EVENTS.PrimaryNameSet`

Do **not** add RPC/provider logic to this library subpath.

## Package exports

Update `package.json` exports with:

- `"./username-registry": "./src/username-registry/index.js"`

## Tests

Add:

- pure helper tests for valid/invalid usernames
- ABI fragment count / interface lookup tests
- golden calldata tests for:
  - `claim`
  - `setPrimaryName`

## Versioning

This is a new library feature.

After implementation:

- bump `swarmit-protocol` version
- tag
- update consuming repos to the new tag

---

## Solidity Work in `swarmit-protocol/contracts`

## New files

Add:

- `contracts/src/SwarmitUsernameRegistry.sol`
- `contracts/test/SwarmitUsernameRegistry.t.sol`
- `contracts/script/DeployUsernameRegistry.s.sol`

## Contract test coverage

Required Foundry tests:

### Name validation

- rejects too-short name
- rejects too-long name
- rejects uppercase
- rejects invalid characters
- rejects leading hyphen
- rejects trailing hyphen
- rejects consecutive hyphen

### Claiming

- first claim succeeds
- duplicate name reverts
- underpay reverts
- `maxPrice` below current price reverts
- overpay refunds the difference
- token ID increments sequentially
- `UsernameClaimed` event emitted correctly

### Pricing

- `currentMintPrice()` equals `baseMintPrice` before first mint
- price increases after each successful mint
- price follows the linear formula exactly

### Primary-name behavior

- first mint auto-sets primary
- later mint does not overwrite existing primary
- `setPrimaryName` works for owner
- approved operator can set primary if desired
- unapproved caller reverts
- `primaryNameOf(address)` returns empty string when none set
- `PrimaryNameSet` emits on explicit change

### Transfer behavior

- transfer clears sender primary if transferred token was primary
- transfer auto-sets recipient primary if recipient had none
- transfer does not overwrite recipient primary if they already had one
- `primaryNameOf` follows the updated ownership correctly

### Withdraw

- owner can withdraw
- non-owner cannot withdraw

## Deployment script

The deploy script should:

- read constructor params from env or script constants
- deploy `SwarmitUsernameRegistry`
- log deployed address
- log chosen `baseMintPrice`
- log chosen `priceStep`

Recommended script name:

- `DeployUsernameRegistry.s.sol`

---

## SPA Work in `/Users/florian/Git/freedom-dev/swarmit`

## High-level read strategy

The SPA should **not** block rendering on username lookups.

Render strategy:

1. compute fallback names immediately from the local pure helper
2. render them synchronously
3. batch-fetch on-chain primary usernames for the visible addresses
4. replace fallback labels with on-chain usernames where present

This keeps the UI responsive while still honoring explicit usernames.

## Username registry config

Add env-backed config entries:

- `VITE_USERNAME_REGISTRY_ADDRESS`
- optionally `VITE_MULTICALL3_ADDRESS`

In:

- `/Users/florian/Git/freedom-dev/swarmit/src/config.js`

Also add app-level feature guards:

- username registry configured or not

## Chain reader/writer support

Add SPA contract support for the new registry in new modules rather than mixing it into `src/chain/contract.js`, which is currently Swarmit-registry-specific.

Recommended files:

- `/Users/florian/Git/freedom-dev/swarmit/src/chain/username-registry.js`
- `/Users/florian/Git/freedom-dev/swarmit/src/composables/useUsernameRegistry.js`

Responsibilities:

### `src/chain/username-registry.js`

- holds registry address constant / guard
- wraps read-only calls
- wraps transaction sends using encoded calldata from `swarmit-protocol/username-registry`

Suggested functions:

- `isUsernameRegistryConfigured()`
- `getCurrentUsernamePrice()`
- `getPrimaryName(address)`
- `getPrimaryNames(addresses)` — batched
- `claimUsername(name, maxPrice, valueWei)`
- `setPrimaryUsername(tokenId)`

## Batched lookup

To avoid a raw RPC lookup per address in hot UI paths, use batching.

Recommended MVP approach:

- batch reverse lookups via `Multicall3`
- configure its address via env or a chain-specific constant
- dedupe visible addresses before querying
- batch only the cache misses

Caching strategy:

- in-memory app cache keyed by lowercase address
- cache both:
  - positive results
  - negative results (no primary name)
- use a TTL for negative and positive results, for example 5 minutes
- invalidate affected entries after local claim or primary-name transactions

If `Multicall3` is not ready on day 1, a temporary fallback is:

- `Promise.all` on unique visible addresses

But the intended implementation should be batched.

## Display-name composable

Add a dedicated display-name abstraction so the UI stops calling `truncateAddress()` directly for identity labels.

Recommended file:

- `/Users/florian/Git/freedom-dev/swarmit/src/composables/useDisplayNames.js`

Suggested API:

```js
getDisplayName(address, { explicitName } = {})
prefetchDisplayNames(addresses)
```

Resolution inside this composable:

1. if `explicitName` exists, return it
2. else if cached on-chain username exists, return it
3. else return `addressToFallbackName(address)`
4. if fallback helper throws, return `truncateAddress(address)`

This composable should also expose a way to prefetch visible addresses for feeds and threads.

## UI surfaces to update

Replace direct address truncation in identity contexts with the display-name composable.

At minimum:

- `/Users/florian/Git/freedom-dev/swarmit/src/components/PostCard.vue`
- `/Users/florian/Git/freedom-dev/swarmit/src/components/ReplyNode.vue`
- `/Users/florian/Git/freedom-dev/swarmit/src/views/UserProfileView.vue`
- `/Users/florian/Git/freedom-dev/swarmit/src/components/AppHeader.vue`
- `/Users/florian/Git/freedom-dev/swarmit/src/components/CuratorBar.vue`
- `/Users/florian/Git/freedom-dev/swarmit/src/views/CuratorPickerView.vue`
- `/Users/florian/Git/freedom-dev/swarmit/src/views/SubmissionDetailView.vue`
- `/Users/florian/Git/freedom-dev/swarmit/src/composables/useCuratorProfiles.js`

Important:

- continue to show the raw address somewhere on the profile page
- keep `/u/<address>` routing unchanged

## Claim UI

Add a minimal user-facing claim flow.

Recommended first surface:

- account area in header dropdown or a small settings/account view

Required UI pieces:

- text input
- client-side normalization to lowercase
- client-side validation using shared helper
- current price display
- “claim username” button
- success state showing claimed token and active primary name

Transaction behavior:

- fetch `currentMintPrice()`
- choose `maxPrice` equal to or slightly above the quoted price
- send `claim(name, maxPrice)` with `value = maxPrice`
- on success:
  - invalidate local username cache for the connected address
  - refresh display name

## Primary-name UI

MVP only needs a minimal primary-name management surface.

Recommended first version:

- if wallet owns exactly one username, nothing extra needed
- if wallet owns more than one username, show a simple list with a “set primary” button

For MVP we do **not** need:

- full username gallery route
- public marketplace UI
- profile editing system

## SPA tests

Add tests for:

- username validation helpers
- display-name precedence:
  - explicit name wins
  - on-chain username beats fallback
  - fallback beats truncation
- cache hit / miss behavior
- batched lookup behavior
- claim flow invalidation of cached names

Add a few component-level tests around:

- `PostCard`
- `ReplyNode`
- `AppHeader`

to ensure they render usernames/fallback names instead of truncation when available.

---

## Protocol Doc Work

This feature should be documented using the same patch-doc approach already used in this repo.

Add:

- `docs/protocol-spec/swarm-message-board-v1-usernames-patch.md`

That patch should define:

- wallet address remains canonical identity
- optional on-chain usernames as an additional display-layer identity source
- display-name precedence relative to:
  - `curatorProfile.name`
  - on-chain username
  - deterministic fallback name
- no change to post/reply/submission schemas

No contract-spec merge is required on day 1 unless we want a separate username-registry spec document.

---

## Release and Rollout Order

Recommended order:

1. protocol docs
2. `swarmit-protocol` contract + shared JS support
3. library tag + push
4. deploy username registry to Gnosis
5. update `swarmit` to new protocol tag
6. ship SPA read path
7. ship SPA claim + set-primary UI

Important:

- ship SPA read support before pushing users toward minting
- fallback names already provide a safe default, so the registry can roll out incrementally

---

## Acceptance Criteria

This feature is done when all of the following are true:

1. a user can claim a valid username on Gnosis Chain
2. the claimed username is an ERC-721 token transferable by standard wallet flows
3. the contract exposes `primaryNameOf(address)` and the SPA can read it
4. the SPA renders names with precedence:
   - explicit contextual name
   - on-chain username
   - deterministic fallback name
   - truncated address
5. visible feeds and threads resolve usernames with batching and cache misses are not executed as one raw RPC call per rendered address indefinitely
6. transferring a username updates primary-name behavior correctly for sender and recipient
7. tests are green in `swarmit-protocol` and `swarmit`

---

## Explicit Non-Goals for MVP

Do not add in this implementation pass:

- username expiry
- name auctions
- subnames
- Unicode names
- ENS interoperability
- on-chain profile metadata beyond name ownership
- curator-side username indexing
- dashboard integration
- marketplace UX

---

## Review Questions for Builder AI

Ask the builder review to focus on these points:

1. Is `ERC721 + Ownable + ReentrancyGuard` the right minimal Solidity shape?
2. Is the proposed `_update`-based primary-name transfer logic correct and ergonomic?
3. Is the linear supply-based pricing model good enough for MVP, or should it be tiered instead?
4. Is `primaryNameOf(address)` the right reverse-lookup primitive for the SPA?
5. Is the proposed library split (`./names` for pure helpers, `./username-registry` for ABI/encoders) clean enough?
6. Is `Multicall3` the right MVP batching strategy for the SPA hot path?
