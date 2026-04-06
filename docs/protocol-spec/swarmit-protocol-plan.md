# Swarmit Protocol Library — Design Plan (for review)

**Status:** Revised per reviewer feedback 2026-04-05. Greenlit for implementation. Author: Claude (opus-4-6).

**Purpose of this document:** Specify the structure, scope, API, and migration strategy for a new shared JavaScript package, `swarmit-protocol`, that unifies protocol code currently duplicated across three Swarmit codebases and will be consumed by a fourth (a new `swarmit-bot` service). This revision incorporates reviewer feedback: tightened ref-vs-id naming in the `/chain` API, corrected the root export list against the canonical `references.js`, finalized the ABI to the full `SwarmitRegistryV2` public surface, resolved open questions, and added a v0.2 note on optional pure event-decoder helpers.

---

## 1. Context

The Swarmit stack currently contains three JavaScript implementations of the on-chain + Swarm protocol code:

| Repo | Role | Protocol code |
|---|---|---|
| `swarmit` (Vue web app, Vite) | **Canonical user client.** Reads boards, reads feeds, and **writes** submissions/votes/curator declarations. Injected-wallet signing (`window.ethereum`). | `src/protocol/{objects,references}.js`, `src/chain/{contract,events,transactions}.js`, `src/swarm/{fetch,feeds}.js` |
| `swarmit-curator` (Node.js curator) | Reads chain events, fetches submissions from Swarm, validates, publishes ranked feed manifests, declares curator profile on-chain. Private-key signing. | `src/protocol/{objects,references,constants}.js`, `src/chain/reader.js`, `src/swarm/client.js`, `src/publisher/*` |
| `swarmit-dashboard` (Next.js) | Thin read-only ops dashboard for Bee + curator state. | `src/lib/{bee,curator,format}.ts` — mostly consumes curator SQLite, light on protocol code |

A fourth consumer is about to be built:

- **`swarmit-bot`**: RSS-to-Swarmit bridge. Polls RSS feeds, builds `post` + `submission` objects, uploads to Swarm via the existing Bee node, and sends `announceSubmission` transactions from its own funded Ethereum identity. Needs: object builders, validators, bzz-ref helpers, Swarm upload, chain write encoding — i.e., the full protocol surface, writer side.

A reconnaissance pass on the existing code found:

- **The pure protocol logic is literally identical** between the web app and curator: same `TYPES` enum, same 9 builders (`buildBoard`, `buildPost`, `buildReply`, `buildSubmission`, `buildUserFeedIndex`, `buildBoardIndex`, `buildThreadIndex`, `buildGlobalIndex`, `buildCuratorProfile`), same 9 validators, same reference helpers (`refToHex`, `hexToBzz`, `isValidRef`, `isValidBzzRef`, `hexToBytes32`, `bytes32ToHex`, `refToBytes32`, `bytes32ToRef`, `slugToBoardId`).
- **The web app has writer-side chain helpers the curator lacks**: `swarmit/src/chain/transactions.js` exposes `announceSubmission`, `setVote`, `registerBoard`, `updateBoardMetadata`, `declareCurator` as ergonomic wrappers over ethers' `Interface.encodeFunctionData`. The curator only has the read side (`chain/reader.js`) plus its own one-off `declareCurator` call inline in `publisher/profile-manager.js`.
- **The Swarm backends diverge by necessity**: web app uses browser `fetch()` against a Freedom-proxied gateway (read-only, no feed writes); curator uses `@ethersphere/bee-js` with a private-key signer (read + write + feed updates). These are not unifiable — they serve different runtimes and different trust models.
- **The spec docs** (`swarmit/docs/swarm-message-board-v1-{spec,contract-spec,schemas}.md`) are canonical; code is validated against them. The library's job is not to invent a spec, it's to provide a single implementation of the existing spec.

**The problem statement:** today, any protocol change (new object field, new validator rule, new contract method, new event) must be mirrored by hand across three repos. This has worked so far because the same person touches everything and changes have been rare. It will not continue to work as the bot is added and as the codebases evolve independently. We need a single source of truth **before** we add a fourth consumer, not after.

## 2. Goals and non-goals

**Goals:**

1. **One source of truth** for the pure protocol logic (object builders, validators, reference helpers, `TYPES` constants, contract ABI, event topic hashes).
2. **Enable the bot** to be built against a clean API from day one, without copying code.
3. **Allow the curator to migrate** as a low-risk guinea pig, so we validate the extraction before building on top of it.
4. **Allow the web app and dashboard to migrate later**, incrementally, without blocking bot work.
5. **Tree-shakeable API** so consumers only pay for what they import (Next.js dashboard shouldn't pull in `bee-js` just to validate an object).
6. **Minimal runtime dependencies** — `ethers` only, in the core. Optional `@ethersphere/bee-js` in the `swarm` subpath.
7. **Canonical ABI** reflecting `SwarmitRegistryV2.sol` exactly — all 5 write methods + all 5 events + any view getters consumers need.

**Non-goals:**

1. **Not a full SDK.** We are not building a "post to Swarmit in one line" convenience layer. Consumers still orchestrate: build → upload → sign → send. The library provides the primitives, not the orchestration.
2. **Not a wallet abstraction.** Web app uses injected wallets; curator and bot use private keys; a future mobile app might use WalletConnect. The library does not hide this — it provides encoded calldata and lets the consumer choose how to sign.
3. **Not a unified Swarm client.** Browser-fetch-via-gateway and bee-js-via-private-key are fundamentally different. The library provides a `@ethersphere/bee-js`-based client for Node consumers (curator, bot) and leaves the web app's browser client alone.
4. **Not a cross-repo build-coupled package.** The library stands on its own; it does not read from `../swarmit/contracts/out/` at build time. ABI is maintained as a hand-written TypeScript/JavaScript constant, same style as `swarmit/src/chain/contract.js` today. Rationale: cross-repo build coupling is brittle under CI and Coolify Nixpacks; the ABI changes rarely enough that hand-maintenance is cheap.
5. **Not a replacement for the spec docs.** `swarmit/docs/swarm-message-board-v1-*.md` remains the normative spec. The library is an implementation of it.
6. **No backwards-compatibility shims for legacy object shapes.** v0.1.0 implements the current schema; if the schema ever versions (e.g., v2), that's handled by a new major version of the library, not a compat layer.

## 3. Repository and package layout

**New repo: `swarmit-protocol`** (sibling to existing repos under `~/Git/freedom-dev/`). Reasoning for a separate repo rather than a subpackage inside `swarmit`:

- Every other service in the stack is its own repo. Consistency with the established pattern.
- A separate repo forces a clean, minimal API surface — you can't accidentally reach into app internals.
- Independent versioning: curator can pin to v0.1.0 while bot runs v0.2.0. Decouples release cadence.
- Retrofitting the `swarmit` repo (which is a Vite-built Vue app) with npm workspaces is invasive and risks the existing build.

**Package name:** `swarmit-protocol` (unscoped) or `@swarmit/protocol` (scoped). I lean `swarmit-protocol` for simplicity — no npm org setup required — but happy to switch to `@swarmit/protocol` if a scope already exists or is planned.

**Directory layout:**

```
swarmit-protocol/
├── package.json
├── README.md
├── CHANGELOG.md
├── src/
│   ├── index.js                  # top-level re-exports of the pure core
│   ├── objects/
│   │   ├── index.js              # re-exports builders + validators
│   │   ├── builders.js           # buildPost, buildReply, buildSubmission, …
│   │   ├── validators.js         # validatePost, …, validate() dispatcher
│   │   └── constants.js          # TYPES enum
│   ├── references.js             # bzz-ref helpers, slugToBoardId, bytes32 conversion
│   ├── chain/
│   │   ├── index.js              # ABI, iface, TOPICS, encode helpers
│   │   ├── abi.js                # hand-maintained ABI array (events + writes + reads)
│   │   ├── interface.js          # ethers Interface instance + TOPICS map
│   │   └── encode.js             # encode.announceSubmission({...}) → hex calldata, etc.
│   └── swarm/
│       ├── index.js              # Bee client for Node consumers (curator, bot)
│       └── client.js             # publishJSON, fetchJSON, createFeedManifest, updateFeed
├── test/
│   ├── objects/                  # LIFTED from swarmit-curator/test/protocol/objects.test.js
│   ├── references.test.js        # LIFTED from swarmit-curator/test/protocol/references.test.js
│   └── chain/
│       └── encode.test.js        # NEW — golden tests for calldata encoding
└── .github/workflows/test.yml    # node --test on push/PR
```

**`package.json` key fields:**

```jsonc
{
  "name": "swarmit-protocol",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.js",
    "./objects": "./src/objects/index.js",
    "./references": "./src/references.js",
    "./chain": "./src/chain/index.js",
    "./swarm": "./src/swarm/index.js"
  },
  "dependencies": {
    "ethers": "^6.x"
  },
  "peerDependencies": {
    "@ethersphere/bee-js": "^11.x"
  },
  "peerDependenciesMeta": {
    "@ethersphere/bee-js": { "optional": true }
  },
  "engines": { "node": ">=22" }
}
```

- `ethers` is a hard dependency (needed by everything in `chain/` and `references.js`).
- `@ethersphere/bee-js` is an **optional peer dependency** — only consumers that import `swarmit-protocol/swarm` need it. The web app and the dashboard can install the library without pulling bee-js.

## 4. API shape

### 4.1 `swarmit-protocol` (root export — pure, zero-I/O)

```js
import {
  // constants
  TYPES,
  // builders (9)
  buildBoard, buildPost, buildReply, buildSubmission,
  buildUserFeedIndex, buildBoardIndex, buildThreadIndex,
  buildGlobalIndex, buildCuratorProfile,
  // validators (9 + dispatcher)
  validateBoard, validatePost, validateReply, validateSubmission,
  validateUserFeedIndex, validateBoardIndex, validateThreadIndex,
  validateGlobalIndex, validateCuratorProfile,
  validate,
  // references — matches the canonical surface in swarmit/src/protocol/references.js
  refToHex,            // 'bzz://abc…' | 'abc…' → 'abc…' (64-char lowercase hex), '' if invalid
  hexToBzz,            // normalize input to 'bzz://<64hex>' or ''
  isValidRef,          // accepts bare hex OR bzz:// prefix
  isValidBzzRef,       // strict: only accepts normalized 'bzz://<64hex>'
  hexToBytes32,        // '<64hex>' → '0x<64hex>' (throws on invalid)
  bytes32ToHex,        // '0x<64hex>' → '<64hex>'
  refToBytes32,        // 'bzz://…' | '<64hex>' → '0x<64hex>' (throws on invalid)
  bytes32ToRef,        // '0x<64hex>' → 'bzz://<64hex>'
  slugToBoardId,       // slug → keccak256(toUtf8Bytes(slug))
} from 'swarmit-protocol';
```

All pure, no I/O, no ethers contract instances. Safe to use in any environment (Node, browser, React Server Components, edge runtimes).

**Notes:**
- This list mirrors the canonical surface at `swarmit/src/protocol/references.js:17-113` exactly. No aliases, no renames.
- `bzzToGatewayUrl` from the web app (`references.js:122`) is **deliberately omitted** — it is UI-specific (returns a local gateway path) and belongs in the web app, not a protocol library.
- Do not add a `bzzToHex` alias. The canonical name for "normalize ref to bare hex" is `refToHex`.

### 4.2 `swarmit-protocol/chain` — ABI + encoding, no signing

```js
import {
  // raw ABI + ethers interface
  ABI, iface, TOPICS,
  // bytes32 helpers (re-exported for convenience)
  BYTES32_ZERO,
  // high-level encoders — return hex calldata ready to be signed + sent
  encode,
} from 'swarmit-protocol/chain';

// Example — bot's posting path (top-level post):
const data = encode.announceSubmission({
  boardSlug: 'hn',
  submissionRef: 'bzz://abc123...',
  parentSubmissionRef: null,        // null for top-level post
  rootSubmissionRef: null,          // null for top-level post; encoder normalizes to self
});

// Consumer sends it their own way:
// Bot: await wallet.sendTransaction({ to: CONTRACT_ADDRESS, data });
// Web app: await ethereum.request({ method: 'eth_sendTransaction', params: [{ from, to: CONTRACT_ADDRESS, data }] });
```

All `encode.*` functions accept slugs and bzz-refs in human form and handle bytes32 conversion internally. This is deliberately an **API redesign**, not a verbatim port: in the current `swarmit/src/chain/transactions.js:51`, the parameters are named `parentSubmissionId` and `rootSubmissionId` even though the values passed in are `bzz://` refs. That naming is misleading (refs are not on-chain IDs — IDs are the bytes32 derived from the refs). The library uses `parentSubmissionRef` / `rootSubmissionRef` to match what the arguments actually are. Consumers will need to rename call sites during migration; this is a one-time find-and-replace.

**`encode.announceSubmission` — full semantics:**

| Case | `parentSubmissionRef` | `rootSubmissionRef` | Encoder behavior |
|---|---|---|---|
| Top-level post | `null` | `null` | `parentBytes32 = BYTES32_ZERO`; `rootBytes32 = submissionId` (the encoded `submissionRef`). This matches the contract's invariant at `SwarmitRegistryV2.sol:118-119`: "if parent is zero, root must equal submissionId." |
| Reply | `'bzz://<64hex>'` | `'bzz://<64hex>'` | Both encoded via `refToBytes32`. |
| Mixed (XOR) | one null, one not | — | Throws: `"parentSubmissionRef and rootSubmissionRef must both be null (top-level) or both non-null (reply)"`. Same invariant as `transactions.js:52-54` today. |

This normalization logic is the one non-trivial thing in the encoder layer; it is covered by golden tests (see §8).

**Full encoder list** (matching the 5 write methods on `SwarmitRegistryV2`):
- `encode.registerBoard({ slug, boardRef })` — slug hashed to boardId internally
- `encode.updateBoardMetadata({ slug, boardRef })`
- `encode.announceSubmission({ boardSlug, submissionRef, parentSubmissionRef, rootSubmissionRef })` — see table above
- `encode.setVote({ submissionRef, direction })` — direction ∈ {-1, 0, 1}, throws otherwise
- `encode.declareCurator({ curatorProfileRef })`

Each encoder returns a `0x`-prefixed hex string (ethers `Interface.encodeFunctionData` output). The consumer is responsible for wrapping it in a transaction with `to: CONTRACT_ADDRESS` and sending it via whatever signer mechanism they use.

For reading logs, consumers use `iface.parseLog(log)` + `TOPICS` directly — the library doesn't wrap `provider.getLogs()` because confirmation handling and polling logic are consumer-specific (curator has one style, bot may have another). **Optional v0.2:** tiny pure `decode.*` helpers for normalizing log shapes (see §11).

### 4.3 `swarmit-protocol/swarm` — Node Bee client (bee-js peer dep)

```js
import { createBeeClient } from 'swarmit-protocol/swarm';

const bee = createBeeClient({
  beeUrl: 'http://bee:1633',
  postageBatchId: '...',
  privateKey: '0x...',  // optional; required only for feed writes and owner derivation
});

// Read immutable content (cached per-instance)
const obj = await bee.fetchObject('bzz://abc…');        // returns parsed JSON, cached
bee.clearCache();                                        // invalidate cache (curator calls this per poll-loop iteration)

// Write immutable content
const contentHex = await bee.publishJSON(obj);           // returns 64-char hex ref

// Feed operations (signer-bearing)
const manifestHex = await bee.createFeedManifest('my-feed-name');  // topic from name, owner from privateKey
await bee.updateFeed('my-feed-name', contentHex);        // signs with privateKey
const feedContent = await bee.resolveFeed(manifestHex);  // read latest feed content as JSON
```

**Full method list** — faithful port of curator's current `swarm/client.js` surface, parameterized as instance methods on the client returned by the factory:

| Method | Purpose | Requires `privateKey`? |
|---|---|---|
| `fetchObject(ref)` | Download immutable JSON by bzz:// ref or bare hex. Uses instance-scoped in-memory cache. | No |
| `clearCache()` | Empty the instance-scoped fetch cache. Curator calls this at the end of each poll-loop iteration (`swarmit-curator/src/indexer/orchestrator.js:75`). | No |
| `publishJSON(obj)` | Upload JSON immutably, returns 64-char hex reference. | No |
| `createFeedManifest(feedName)` | Derive topic from `feedName`, owner from `privateKey`, create manifest. Idempotent (same topic+owner → same manifest). | **Yes** (for owner) |
| `updateFeed(feedName, contentHex)` | Sign and update a feed to point at a new content ref. | **Yes** (for signing) |
| `resolveFeed(feedManifestHex)` | Download latest feed content as JSON. | No |

This is curator's `swarm/client.js` lifted, tidied, and parameterized. Two key differences vs the curator original:

1. **Instance state instead of module state.** Curator's client holds the Bee instance, the cache Map, and the `PrivateKey` signer as module-level constants initialized from `config.js` at import time. The library's `createBeeClient(config)` factory encapsulates all of this per-instance, so a single process could theoretically use multiple clients with different private keys (e.g., an integration test harness). Matters more for the bot than the curator.
2. **No implicit config.** Every piece of config (`beeUrl`, `postageBatchId`, `privateKey`) is passed to the factory explicitly; the library never reads `process.env` or imports from a `config.js`. Consumers own their own config loading.

**Explicitly not for the web app.** The web app keeps its gateway-based reader in `swarmit/src/swarm/fetch.js` — that uses a Freedom gateway and browser `fetch()` and has no feed-write capability. It stays in the web app repo; the library's `swarm` subpath is for Node consumers (curator, bot) only.

### 4.4 What's deliberately absent

- **No wallet helpers.** Consumers bring their own signer (`ethers.Wallet`, `window.ethereum`, WalletConnect provider, etc.).
- **No block polling / chain reader.** Curator's reader is tied to its confirmation depth and cursor semantics; a bot might want a different strategy. The library gives you `iface`, `TOPICS`, and `ABI` — you write your own `provider.getLogs` loop.
- **No SQLite / persistence.** Every consumer has its own state needs.
- **No RSS parsing, no UI components, no dashboard glue.** Obviously.

## 5. ABI strategy

**Hand-maintained canonical ABI**, mirrored into `src/chain/abi.js` as a JavaScript array of human-readable strings, same style as `swarmit-curator/src/chain/reader.js:10-16` and `swarmit/src/chain/contract.js` today. The v0.1.0 ABI reflects the **complete public surface** of `SwarmitRegistryV2.sol` as of 2026-04-05 — all 5 events, all 5 write methods, and all 7 public state getters auto-generated by Solidity from the contract's `public` mappings. No "fill in later" placeholders; shipping with the full canonical surface so consumers don't need to extend the ABI ad-hoc.

```js
export const ABI = [
  // --- events (5) ---
  'event BoardRegistered(bytes32 indexed boardId, string slug, string boardRef, address governance)',
  'event BoardMetadataUpdated(bytes32 indexed boardId, string boardRef)',
  'event SubmissionAnnounced(bytes32 indexed boardId, bytes32 indexed submissionId, bytes32 parentSubmissionId, bytes32 rootSubmissionId, address author)',
  'event CuratorDeclared(address indexed curator, string curatorProfileRef)',
  'event VoteSet(bytes32 indexed boardId, bytes32 indexed submissionId, address indexed voter, bytes32 rootSubmissionId, int8 direction, int8 previousDirection, uint64 upvotes, uint64 downvotes)',

  // --- writes (5) ---
  'function registerBoard(bytes32 boardId, string slug, string boardRef)',
  'function updateBoardMetadata(bytes32 boardId, string boardRef)',
  'function announceSubmission(bytes32 boardId, bytes32 submissionId, bytes32 parentSubmissionId, bytes32 rootSubmissionId)',
  'function setVote(bytes32 submissionId, int8 direction)',
  'function declareCurator(string curatorProfileRef)',

  // --- public state getters (7, auto-generated by Solidity from public mappings) ---
  'function boardGovernance(bytes32 boardId) view returns (address)',
  'function submissionExists(bytes32 submissionId) view returns (bool)',
  'function submissionBoard(bytes32 submissionId) view returns (bytes32)',
  'function submissionRoot(bytes32 submissionId) view returns (bytes32)',
  'function voteOf(bytes32 submissionId, address voter) view returns (int8)',
  'function upvoteCount(bytes32 submissionId) view returns (uint64)',
  'function downvoteCount(bytes32 submissionId) view returns (uint64)',
];
```

**Sanity check against the Solidity source:** the 7 public getters correspond to `SwarmitRegistryV2.sol:54, 57, 58, 59, 62, 63, 64` (the `public` mappings in the State block). `voteOf` is a nested mapping `mapping(bytes32 => mapping(address => int8))`, so its getter takes two arguments — the library's ABI signature matches.

**Why not auto-generate from `forge build` output?**
- Cross-repo build coupling is fragile: `swarmit-protocol` would need `swarmit` checked out during `npm install`, which breaks Coolify Nixpacks and most CI patterns.
- ABI changes are rare. Contract has been stable; when it does change, the breaking change is a semantic event anyway — we want a human to update the ABI and bump the library version.
- Human-maintained keeps the ABI minimal (only methods we actually use). Forge output is noisy.

**Sync discipline:** any change to `swarmit/contracts/src/SwarmitRegistryV2.sol` must be accompanied by a PR to `swarmit-protocol` updating `src/chain/abi.js`, even if no consumer uses the new method yet. This is a checklist item, not an automated check, because automation requires the cross-repo coupling we're avoiding.

## 6. Versioning and distribution

**Phase 1 — local iteration (before first tag):**
Consumers point at a local path via npm file dep:
```jsonc
"swarmit-protocol": "file:../swarmit-protocol"
```
Fast iteration, no publish step. Not suitable for Coolify deploys.

**Phase 2 — git-pinned (once curator works against it):**
Tag `v0.1.0` and consumers pin to the tag via GitHub dependency:
```jsonc
"swarmit-protocol": "github:flotob/swarmit-protocol#v0.1.0"
```
Nixpacks on Coolify handles this transparently. No npm account, no publish ceremony. Pin is immutable-ish (a tag can be force-moved, but discipline says "don't").

**Phase 3 — npm (when the library stabilizes):**
Publish to npmjs.com or GitHub Packages. Eventually makes installs faster and enables semantic version ranges. Not needed for v0.1.0.

**Phase 4 — Swarm-hosted (speculative, long-term):**
Host the tarball on Swarm and install via a bzz:// URL. Aligns philosophically with the rest of the stack. Not on the near-term critical path.

**Versioning policy:** semver. Pre-1.0, breaking changes bump minor (0.1 → 0.2). After 1.0, breaking changes bump major. **New builders or encoders are non-breaking**; **changing existing builder or encoder signatures is breaking**.

## 7. Migration plan (phased)

### Phase 0 — Extract (no refactor)

1. Create `swarmit-protocol` repo.
2. Copy protocol modules from **whichever codebase is more complete per module**:
   - `objects.js`, `references.js`, `constants.js` → either source (identical); curator's layout with `protocol/constants.js` is cleaner, use that.
   - `chain/transactions.js` (encoders) → from **web app** (`swarmit/src/chain/transactions.js`); curator lacks this.
   - `chain/contract.js` (ABI + iface) → from **web app** (`swarmit/src/chain/contract.js`).
   - `swarm/client.js` (Node Bee client) → from **curator** (`swarmit-curator/src/swarm/client.js`); web app lacks writer-side Swarm client.
3. Decouple encoders from the web app's `send()` wrapper — return hex calldata instead of calling `window.ethereum`.
4. Lift tests wholesale from `swarmit-curator/test/protocol/` as the starting test suite. Add new tests for `chain/encode.*` as golden calldata tests (hex output pinned against known inputs).
5. Run the test suite locally. All tests should pass immediately because the code is a straight copy.

**Exit criterion:** `npm test` green in the new repo.

### Phase 1 — Curator refactor (guinea pig)

1. In `swarmit-curator`, add `"swarmit-protocol": "file:../swarmit-protocol"` as a dep.
2. Replace `swarmit-curator/src/protocol/*` with imports from `swarmit-protocol`.
3. Replace the inline ABI + TOPICS in `swarmit-curator/src/chain/reader.js` with imports from `swarmit-protocol/chain`.
4. Replace `swarmit-curator/src/swarm/client.js` with imports from `swarmit-protocol/swarm`.
5. Replace the inline `declareCurator` encoding in `swarmit-curator/src/publisher/profile-manager.js:101-108` with `encode.declareCurator` from the library.
6. Delete the now-empty `swarmit-curator/src/protocol/` and trimmed files.
7. Run curator's full test suite. Fix any fallout.
8. Deploy to Coolify staging (if we had one) or prod. Verify:
   - Container boots, new curator address logs correctly.
   - Fresh indexer run completes, feeds are recreated, `CuratorDeclared` tx sent.
   - Dashboard still reads curator state correctly.

**Exit criterion:** curator running on Coolify with `swarmit-protocol` as its only source of protocol code, dashboard still green.

### Phase 2 — Tag v0.1.0

1. Commit everything, tag `v0.1.0`.
2. Update curator's `package.json` to point at the git tag instead of `file:../swarmit-protocol`.
3. Redeploy curator to verify Nixpacks resolves the git dep on build.

**Exit criterion:** curator's deployed Coolify container built successfully from a git-pinned library.

### Phase 3 — Bot scaffold

1. Create `swarmit-bot` repo structure (directory, package.json, nixpacks config, DB schema, empty module stubs).
2. Add `"swarmit-protocol": "github:flotob/swarmit-protocol#v0.1.0"` as a dep from day one.
3. Build the poster pipeline: RSS fetch → build post + submission → upload via `swarm.publishJSON` → encode tx via `chain.encode.announceSubmission` → sign with `ethers.Wallet` → send → confirm → record.
4. Implement userFeed maintenance using `swarm.createFeedManifest` + `swarm.updateFeed`.
5. Tests, local run against Hetzner Bee via SSH tunnel.
6. Deploy to Coolify as a new app in the swarmit project.

**Exit criterion:** bot posts an RSS entry to a test board and the curator indexes it correctly.

### Phase 4 — Deferred refactors (nice-to-have, not blocking)

- **Dashboard**: swap `bee.ts` and any protocol touchpoints for `swarmit-protocol` imports. Low urgency.
- **Web app**: replace `swarmit/src/protocol/`, `src/chain/contract.js`, `src/chain/events.js`, `src/chain/transactions.js` with `swarmit-protocol` imports. Keep the web app's `swarm/fetch.js` and `swarm/feeds.js` as-is — those are browser-specific gateway code that the library does not replace. This is the riskiest refactor (touches the user-facing app) and should be done when we're next in that codebase for an unrelated reason, not as a standalone migration.

## 8. Testing strategy

1. **Lifted tests** — `swarmit-curator/test/protocol/{objects,references}.test.js` moves into `swarmit-protocol/test/` unchanged. These already cover builders, validators, and reference helpers exhaustively.
2. **New tests for `chain/encode.*`** — golden tests that pin the hex calldata output for known inputs. E.g., `encode.announceSubmission({ boardSlug: 'hn', submissionRef: 'bzz://aa...', parent: null, root: null })` should always produce the same hex. This catches ABI drift early.
3. **No on-chain integration tests in v0.1.0** — the cost/benefit is bad. Later, we could add a Gnosis fork test harness (e.g., via `anvil --fork-url`), but not for v1.
4. **Consumer smoke tests live in consumers** — the curator's existing indexer/orchestrator tests serve as integration validation. If the curator's tests still pass after the refactor, the library is good enough for v0.1.0.
5. **CI**: plain `node --test` on push. No bundling, no TypeScript compilation (library is pure ES modules).

## 9. Divergence prevention after v1

A shared library only helps if new code doesn't re-introduce duplication. Mitigations:

1. **Delete the old files** in each consumer repo as part of the refactor. Not just unused — actually deleted. Future edits to those paths will get noticed in review.
2. **Grep-based pre-commit hook (optional)** in each consumer repo that flags local definitions of `buildPost`, `validateSubmission`, etc. — anything suggesting someone re-inlined protocol logic. Low-effort guardrail.
3. **Document the import rules** in each consumer's README: "all protocol object builders, validators, references, and chain ABI MUST come from `swarmit-protocol`. Any local re-implementation is a bug."
4. **When the contract changes**, the discipline is: update `SwarmitRegistryV2.sol` → update `swarmit-protocol/src/chain/abi.js` → bump the library version → update consumers. Enforced by review, not tooling.

## 10. Open questions — resolved by reviewer

The original draft of this plan carried 10 open questions. The reviewer answered the load-bearing ones; the remainder are locked in below as v0.1.0 decisions.

1. **Ethers version — RESOLVED.** Both the SPA and curator are on **ethers v6** (`swarmit/package.json:21`, `swarmit-curator/package.json:18`). Library targets v6. No v5 regression risk.

2. **`SwarmitRegistryV2` view functions — RESOLVED.** The full public state surface is enumerated in §5: `boardGovernance`, `submissionExists`, `submissionBoard`, `submissionRoot`, `voteOf`, `upvoteCount`, `downvoteCount`. v0.1.0 ships the complete public surface, not a consumer-demand-driven subset.

3. **`slugToBoardId` hashing — RESOLVED.** `keccak256(toUtf8Bytes(slug))` matches the contract's `keccak256(bytes(slug))` exactly; existing implementation at `swarmit/src/protocol/references.js:111` is correct and is lifted verbatim.

4. **`validate()` return shape — RESOLVED.** Stays `{ valid, errors }`. Preserved exactly; changing it post-v0.1.0 would be a breaking change.

5. **Migration order — RESOLVED.** Curator-first confirmed. Strongest test surface, lowest user-facing blast radius. Web-app-first was considered and rejected as more disruptive for less gain.

6. **Chain API naming (`*Id` vs `*Ref`) — RESOLVED.** This revision renames the `announceSubmission` encoder parameters from `parentSubmissionId` / `rootSubmissionId` to `parentSubmissionRef` / `rootSubmissionRef`. The legacy names in `swarmit/src/chain/transactions.js:47-51` were misleading (the values passed in are `bzz://` refs, not on-chain bytes32 IDs). This is a deliberate clarity fix during extraction, not a bug-for-bug port. Consumer call sites update during migration (one-time find-and-replace).

7. **Root export list — RESOLVED.** Revised to mirror the canonical surface at `swarmit/src/protocol/references.js` exactly. The original draft fabricated a `bzzToHex` helper that does not exist in either codebase; the canonical name for "normalize ref to bare hex" is `refToHex`. `bzzToGatewayUrl` is excluded from the library as it is UI-specific.

### Still-open items deferred to implementation time

These were not on the reviewer's critical-path feedback and can be resolved as they come up during extraction:

- **Package name `swarmit-protocol` vs `@swarmit/protocol`.** No strong reviewer opinion. Defaulting to unscoped `swarmit-protocol` for simplicity — can migrate to a scope later if a multi-package ecosystem emerges.
- **Orchestration helpers.** Reviewer did not object to the primitives-only stance. Staying primitives-only in v0.1.0.
- **Browser-compatible Swarm client for feed writes.** Not needed now; the web app uses the Freedom Browser API for feed operations. The `swarm` subpath in v0.1.0 is Node-only (bee-js). Revisit if/when the web app needs to write feeds directly.
- **Ref-format edge cases.** `swarmit/docs/swarm-message-board-v1-schemas.md` defines the ref format; the existing `refToHex` / `isValidBzzRef` implementation handles the canonical cases. Any edge case found during migration becomes a test case, not a blocker.

## 11. Optional v0.2 — pure event-decoder helpers

The reviewer noted that both the SPA and curator currently do some duplicated log-shape normalization (the kind of thing you write after calling `iface.parseLog`: turning ethers' arg proxy into a plain object with renamed fields, unwrapping indexed bytes32 back to `bzz://` refs, coercing BigInt to Number where safe, etc.). v0.1.0 does **not** include this layer — the library stops at exposing `iface`, `TOPICS`, and `ABI`, and consumers roll their own normalization.

If that duplication becomes painful, v0.2 can add a tiny pure `decode.*` module:

```js
// Hypothetical v0.2 API — NOT shipping in v0.1.0
import { decode } from 'swarmit-protocol/chain';

const submission = decode.submissionAnnounced(log);
// → { boardId, submissionId, submissionRef, parentSubmissionRef, rootSubmissionRef, author, blockNumber, logIndex }

const vote = decode.voteSet(log);
// → { boardId, submissionId, submissionRef, voter, rootSubmissionRef, direction, previousDirection, upvotes, downvotes, blockNumber, logIndex }
```

Design rules if we ever add this:
- **Still no polling, still no confirmation logic, still no provider.** Pure function: `log → normalized object`. Consumer owns the `provider.getLogs` call.
- **Outputs are plain JS objects with human-friendly field names**: `submissionRef` (bzz://) instead of `submissionId` (bytes32), Numbers instead of BigInts for small counters (upvotes, downvotes, blockNumber, logIndex).
- **Keep bytes32 IDs available too** for cases where consumers need the raw on-chain form.
- **One decoder per event type**, matching `TOPICS`.

Whether this lands in v0.2 depends on whether the pain of duplicated normalization is greater than the pain of one more library layer. Explicitly NOT in scope for v0.1.0.

---

## Appendix A — File-to-library mapping (what moves where)

| Existing location | Target in `swarmit-protocol` | Notes |
|---|---|---|
| `swarmit-curator/src/protocol/objects.js` | `src/objects/{builders,validators}.js` | Split into two files. Behavior unchanged. |
| `swarmit-curator/src/protocol/constants.js` | `src/objects/constants.js` | Re-export at root. |
| `swarmit-curator/src/protocol/references.js` | `src/references.js` | Verbatim. |
| `swarmit-curator/src/swarm/client.js` | `src/swarm/client.js` | Parameterize the Bee URL / batch ID / signer. |
| `swarmit/src/chain/contract.js` | `src/chain/{abi,interface}.js` | Strip web-app-specific wrappers. Keep ABI + `iface` + `TOPICS`. |
| `swarmit/src/chain/transactions.js` | `src/chain/encode.js` | Replace `send()` with calldata return. |
| `swarmit-curator/test/protocol/*.test.js` | `test/objects/`, `test/references.test.js` | Verbatim. |
| `swarmit/src/chain/events.js` | *(not moved)* | Stays in web app. Consumers use `iface.parseLog` + `provider.getLogs` directly. |
| `swarmit/src/swarm/fetch.js`, `src/swarm/feeds.js` | *(not moved)* | Browser-gateway-specific, stays in web app. |
| `swarmit-curator/src/chain/reader.js` | *(not moved)* | Polling/confirmation logic stays in curator. |

## Appendix B — Things this plan explicitly does NOT solve

- Moderation / reporting flows.
- Curator endorsement or reputation mechanics.
- Spam filtering at protocol level.
- Vote weighting schemes.
- Content encryption for private boards.
- Cross-chain deployment (e.g., Swarmit on Ethereum mainnet in addition to Gnosis).
- Schema v2 migration strategy.

These are out of scope for v0.1.0 of the library, which is an extraction, not a redesign.
