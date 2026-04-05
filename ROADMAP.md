# swarmit-protocol — Execution Roadmap

**Companion to**: [`swarmit/docs/swarmit-protocol-plan.md`](../swarmit/docs/swarmit-protocol-plan.md) (the design plan, reviewer-approved 2026-04-05).

This roadmap translates the plan into concrete, numbered, checkable steps. Work through them in order. Each step has a definition of done so it's clear when to move on.

**Conventions:**
- `$PROTOCOL` = `/Users/florian/Git/freedom-dev/swarmit-protocol`
- `$CURATOR` = `/Users/florian/Git/freedom-dev/swarmit-curator`
- `$WEBAPP` = `/Users/florian/Git/freedom-dev/swarmit`
- `$BOT` = `/Users/florian/Git/freedom-dev/swarmit-bot`
- `$DASHBOARD` = `/Users/florian/Git/freedom-dev/swarmit-dashboard`

---

## Phase 0 — Extract the library (no consumer refactors yet)

Goal: a standalone `swarmit-protocol` repo with all source modules copied over, tests passing, and nothing yet depending on it. Curator and web app are untouched.

### 0.1 Bootstrap the repo

- [ ] `cd $PROTOCOL`
- [ ] `git init` if not already initialized (user already created the directory)
- [ ] Create `package.json` with:
  - `"name": "swarmit-protocol"`
  - `"version": "0.0.1"` (pre-tag; bumped to `0.1.0` at Phase 2)
  - `"type": "module"`
  - `"exports"` map with all 5 subpaths from plan §3: `.`, `./objects`, `./references`, `./chain`, `./swarm`
  - `"dependencies": { "ethers": "^6.x" }`
  - `"peerDependencies": { "@ethersphere/bee-js": "^11.x" }`
  - `"peerDependenciesMeta": { "@ethersphere/bee-js": { "optional": true } }`
  - `"engines": { "node": ">=22" }`
  - `"scripts": { "test": "node --test" }`
- [ ] Create the directory skeleton exactly as specified in §3 of the plan
- [ ] Add a minimal `README.md` (one paragraph + link to the plan)
- [ ] `.gitignore`: `node_modules`, `.DS_Store`, `coverage/`, `.env`

**Definition of done**: `$PROTOCOL` has `package.json`, `.gitignore`, `README.md`, empty `src/` and `test/` dirs. `npm install` succeeds (pulls only `ethers`).

### 0.2 Copy the pure protocol modules

Source of truth for each file:

- [ ] `$CURATOR/src/protocol/constants.js` → `$PROTOCOL/src/objects/constants.js` (verbatim, exports `TYPES`)
- [ ] `$CURATOR/src/protocol/objects.js` → split into two files:
  - `$PROTOCOL/src/objects/builders.js` — the 9 `build*` functions + their internal helpers
  - `$PROTOCOL/src/objects/validators.js` — the 9 `validate*` functions + the `validate()` dispatcher + shared validation helpers (`requireString`, `requireRef`, etc.)
- [ ] `$PROTOCOL/src/objects/index.js` — re-exports everything from `builders.js`, `validators.js`, `constants.js`
- [ ] `$CURATOR/src/protocol/references.js` → `$PROTOCOL/src/references.js` (verbatim)
  - Cross-check against `$WEBAPP/src/protocol/references.js` to confirm they are identical (they should be, per recon)
  - Do NOT include `bzzToGatewayUrl` from `$WEBAPP/src/protocol/references.js:122` — it's UI-specific
- [ ] `$PROTOCOL/src/index.js` — top-level re-exports matching §4.1 of the plan exactly

**Definition of done**: `node -e "import('./src/index.js').then(m => console.log(Object.keys(m).sort()))"` prints the expected surface: 9 builders + 9 validators + `validate` + `TYPES` + 9 reference helpers.

### 0.3 Build the chain layer

- [ ] `$PROTOCOL/src/chain/abi.js` — copy the finalized ABI from §5 of the plan. Include:
  - 5 events (BoardRegistered, BoardMetadataUpdated, SubmissionAnnounced, CuratorDeclared, VoteSet)
  - 5 writes (registerBoard, updateBoardMetadata, announceSubmission, setVote, declareCurator)
  - 7 public state getters (boardGovernance, submissionExists, submissionBoard, submissionRoot, voteOf, upvoteCount, downvoteCount)
- [ ] `$PROTOCOL/src/chain/interface.js` — construct `iface = new Interface(ABI)`, export `TOPICS` map (5 event topic hashes), export `BYTES32_ZERO = '0x' + '0'.repeat(64)`
- [ ] `$PROTOCOL/src/chain/encode.js` — the encoder module. Each encoder:
  - Accepts human-form args (slugs, bzz:// refs)
  - Converts to bytes32 internally via `slugToBoardId` and `refToBytes32`
  - Returns hex calldata via `iface.encodeFunctionData(functionName, args)`
  - Throws on invalid inputs with clear error messages
- [ ] Implement the 5 encoders per §4.2 of the plan:
  - `encode.registerBoard({ slug, boardRef })`
  - `encode.updateBoardMetadata({ slug, boardRef })`
  - `encode.announceSubmission({ boardSlug, submissionRef, parentSubmissionRef, rootSubmissionRef })` — with the null-or-both invariant and the "top-level: root normalizes to self" rule from §4.2's table
  - `encode.setVote({ submissionRef, direction })` — direction ∈ {-1, 0, 1}, throws otherwise
  - `encode.declareCurator({ curatorProfileRef })`
- [ ] `$PROTOCOL/src/chain/index.js` — re-exports `ABI`, `iface`, `TOPICS`, `BYTES32_ZERO`, `encode`

**Definition of done**: `import { encode } from 'swarmit-protocol/chain'` (via file dep from a scratch test) works and `encode.announceSubmission(…)` returns a 0x-prefixed hex string.

### 0.4 Build the swarm layer

- [ ] `$PROTOCOL/src/swarm/client.js` — lift from `$CURATOR/src/swarm/client.js`, but parameterize via a `createBeeClient({ beeUrl, postageBatchId, privateKey })` factory function instead of reading from `config.js`. Every piece of state that is module-level in curator's current client (the `bee` instance, the `cache` Map, the `curatorSigner`) becomes **instance state** owned by the returned client object.
- [ ] The factory returns an object exposing these 6 methods (per plan §4.3):
  - `fetchObject(ref)` — download + cache immutable JSON. Reads from instance cache first.
  - `clearCache()` — empty the instance cache. Curator calls this at `orchestrator.js:75` and `orchestrator.js:392` — migration must preserve that call.
  - `publishJSON(obj)` — upload JSON immutably, return 64-char hex ref.
  - `createFeedManifest(feedName)` — topic derived from feedName, owner derived from `privateKey`. Throws if `privateKey` was not provided.
  - `updateFeed(feedName, contentHex)` — signs with `privateKey`. Throws if `privateKey` was not provided.
  - `resolveFeed(feedManifestHex)` — read latest feed content as JSON. No signer required.
- [ ] `@ethersphere/bee-js` is imported at the top of `src/swarm/client.js`. Node will fail to import this module if the peer dep is not installed — that's the intended behavior (the optional peer dep signals "only needed if you use the `swarm` subpath").
- [ ] `$PROTOCOL/src/swarm/index.js` — re-export `createBeeClient`.

**Definition of done**: `createBeeClient({...})` returns an object with all 6 methods. A basic smoke test (e.g., `typeof client.fetchObject === 'function'` for each method) passes. Live Bee interaction is not yet tested — that happens when curator runs against the library in Phase 1.

### 0.5 Lift and add tests

- [ ] Copy `$CURATOR/test/protocol/objects.test.js` → `$PROTOCOL/test/objects/objects.test.js`
  - Adjust import paths to point at `../../src/objects/`
- [ ] Copy `$CURATOR/test/protocol/references.test.js` → `$PROTOCOL/test/references.test.js`
  - Adjust import paths to `../src/references.js`
- [ ] Copy `$CURATOR/test/helpers/fixtures.js` if the tests depend on it → `$PROTOCOL/test/helpers/fixtures.js`
- [ ] Write new golden tests at `$PROTOCOL/test/chain/encode.test.js`:
  - **Fixed-input → fixed-output calldata** tests for all 5 encoders. Use realistic values:
    - `encode.announceSubmission` with a top-level post (null parent/root) — verify the rootBytes32 equals the submissionId bytes32
    - `encode.announceSubmission` with a reply (both refs non-null)
    - `encode.announceSubmission` with mixed (one null, one not) — expect throw
    - `encode.setVote` with direction ∈ {-1, 0, 1} (pass) and direction ∈ {2, -2, null} (throw)
    - `encode.registerBoard`, `encode.updateBoardMetadata`, `encode.declareCurator` — one happy-path test each
  - **ABI stability test**: assert that `iface.fragments.length` matches the expected count (5 events + 5 writes + 7 getters = 17 fragments)

**Definition of done**: `npm test` in `$PROTOCOL` is green. Any tests that fail because they reference things not in the library (e.g., curator-specific helpers) are either adapted or deleted.

### 0.6 Initial commit + local git dep wiring

- [ ] Commit everything: `git add . && git commit -m "initial extraction from swarmit-curator + swarmit"`
- [ ] **Do not tag yet.** We tag v0.1.0 only after Phase 1 validates the extraction against a real consumer.

**Phase 0 exit criterion**: `$PROTOCOL/npm test` green; repo is self-contained; no consumer has been modified.

---

## Phase 1 — Curator refactor (guinea pig, LOCAL ONLY)

Goal: `swarmit-curator` depends on `swarmit-protocol` via a local `file:` dep, all curator tests pass, and a local `node src/index.js` run against a test DB is happy. This validates that the extraction is faithful **before** we publish anything.

**Explicitly not in this phase**: any Coolify deploy of the curator. Nixpacks on Coolify cannot resolve `file:../swarmit-protocol` (build containers have no access to sibling directories). Coolify redeploy happens in Phase 2 after v0.1.0 is tagged and pushed to GitHub. This is not a caveat — it is the plan.

### 1.1 Wire the dependency

- [ ] In `$CURATOR/package.json`, add `"swarmit-protocol": "file:../swarmit-protocol"` to `dependencies`
- [ ] `cd $CURATOR && npm install`
- [ ] Verify `node_modules/swarmit-protocol/` is a symlink (or hardlink) to `../swarmit-protocol/` — that's how `file:` deps work

### 1.2 Replace curator modules

Do these edits in curator, one module at a time, running `npm test` after each. Each step should leave the test suite green.

- [ ] **Protocol objects**: in every curator file that imports from `./protocol/objects.js`, `./protocol/constants.js`, or `./protocol/references.js`, change the import to `'swarmit-protocol'` (root export). Grep for `from '.*protocol/(objects|constants|references)'` in `$CURATOR/src/` to find all call sites.
- [ ] Run `npm test` — should pass.
- [ ] **Swarm client**: in files that import from `./swarm/client.js`, replace with `import { createBeeClient } from 'swarmit-protocol/swarm'` and instantiate using curator's config values.
- [ ] Run `npm test` — should pass.
- [ ] **Chain ABI + TOPICS in reader**: in `$CURATOR/src/chain/reader.js`, replace the inline `ABI = [...]`, `iface = new Interface(...)`, and `TOPICS = {...}` with imports from `'swarmit-protocol/chain'`. Keep the polling/confirmation/cursor logic (that stays in curator).
- [ ] Run `npm test` — should pass.
- [ ] **Inline `declareCurator` in profile-manager**: in `$CURATOR/src/publisher/profile-manager.js:101-108`, replace the inline `iface.encodeFunctionData('declareCurator', [bzzUrl])` call with `encode.declareCurator({ curatorProfileRef: bzzUrl })` from `'swarmit-protocol/chain'`.
- [ ] Run `npm test` — should pass.

### 1.3 Delete the old files in curator

- [ ] `rm -r $CURATOR/src/protocol/` (all 3 files — constants, objects, references)
- [ ] `rm $CURATOR/src/swarm/client.js` — entire file, since `createBeeClient` is now imported
- [ ] Consider deleting or shrinking `$CURATOR/test/protocol/` since those tests now live in `swarmit-protocol` — but leave them as a safety net if you're worried about divergence. Decide at execution time.
- [ ] Run `npm test` one more time — should still pass.

### 1.4 Local smoke run

- [ ] `node -e "import('swarmit-curator/src/config.js')"` equivalent — just confirm curator's modules load without import errors against the new library (no runtime execution yet)
- [ ] Full `npm test` in curator one more time — the definitive local validation
- [ ] **Optional**: run `node src/index.js` locally against a throwaway test SQLite DB and a Bee endpoint of your choice (could be the Hetzner Bee if you set up an SSH tunnel, or a local Bee dev node, or skipped entirely — it's a belt-and-braces check on top of the test suite). Validate that the process starts, connects, and polls at least once without throwing.
- [ ] Commit all curator changes locally. **Do not push yet** — we push + Coolify-deploy in Phase 2 after the library is tagged and published.

**Phase 1 exit criterion**: `npm test` green in curator; curator code uses `swarmit-protocol` as its only source of protocol/chain/swarm code; old files deleted; curator process loads and polls cleanly in a local smoke run (or at minimum: all tests pass, which is the definition-of-done floor). Nothing deployed, nothing pushed.

---

## Phase 2 — Tag v0.1.0 and switch curator to git-pinned

Goal: library has a real version, curator installs it from git, Coolify deploy works.

### 2.1 Tag the library

- [ ] In `$PROTOCOL`: bump version in `package.json` to `0.1.0`
- [ ] Commit: `git commit -am "v0.1.0"`
- [ ] Tag: `git tag v0.1.0`
- [ ] Create GitHub repo `flotob/swarmit-protocol` (user step)
- [ ] `git remote add origin git@github.com:flotob/swarmit-protocol.git && git push -u origin main && git push origin v0.1.0`

### 2.2 Switch curator to git dep

- [ ] In `$CURATOR/package.json`, replace:
  ```jsonc
  "swarmit-protocol": "file:../swarmit-protocol"
  ```
  with:
  ```jsonc
  "swarmit-protocol": "github:flotob/swarmit-protocol#v0.1.0"
  ```
- [ ] `rm -rf $CURATOR/node_modules/swarmit-protocol && npm install` — refetch from git
- [ ] `npm test` — should still pass (same code, different source)
- [ ] Commit curator change, push to deploy branch

### 2.3 Coolify deploy curator

- [ ] Trigger redeploy via Coolify API (same curl command as before)
- [ ] Poll deployment status until `finished`
- [ ] Tail container logs — verify:
  - Curator starts with the correct address
  - Index catches up from last processed block (NOT from deploy block — we don't want another full reindex, state DB still has the mapping from the last deploy)
  - No import errors, no protocol validation errors
- [ ] Verify dashboard still renders curator state correctly (no schema changes, should just work)

**Phase 2 exit criterion**: Coolify curator running a git-pinned `swarmit-protocol@v0.1.0`; dashboard green; curator processing new chain events in steady state.

---

## Phase 3 — Bot scaffold against v0.1.0

Goal: `swarmit-bot` exists as a deployable app posting RSS entries to Swarmit. Plan-level details are in `swarmit-protocol-plan.md` §7 Phase 3; a full bot-specific design doc is out of scope here — the roadmap only covers the protocol-library-facing parts.

### 3.1 Repo scaffold

- [ ] `cd $BOT && git init` (if not already)
- [ ] Create `package.json` with:
  - `"swarmit-protocol": "github:flotob/swarmit-protocol#v0.1.0"` as the first dep
  - Other deps: `better-sqlite3`, `ethers`, `dotenv`, `rss-parser`, `@ethersphere/bee-js`
- [ ] Directory skeleton per the earlier bot design discussion: `src/{rss,poster,chain,db}/`, `test/`
- [ ] `.env.example` with the expected env vars: `RPC_URL`, `CONTRACT_ADDRESS`, `BEE_URL`, `POSTAGE_BATCH_ID`, `BOT_PRIVATE_KEY`, `POLL_INTERVAL`, `MAX_POSTS_PER_RUN_PER_SOURCE`, `STATE_DB`

### 3.2 Protocol library wire-up

- [ ] `src/config.js` — validate env vars, derive bot address from `BOT_PRIVATE_KEY` via `new Wallet(key).address`
- [ ] `src/chain/writer.js` — create an ethers `Wallet` signer + `JsonRpcProvider`; export a `sendAnnouncement(data)` helper that wraps `wallet.sendTransaction({ to: CONTRACT_ADDRESS, data })` and returns the confirmed receipt
- [ ] `src/poster/build.js` — use `buildPost` and `buildSubmission` from `swarmit-protocol` to construct the JSON objects; use `validate` to sanity-check before upload
- [ ] `src/poster/upload.js` — use `createBeeClient` from `swarmit-protocol/swarm` to `publishJSON` both the post and submission, return refs
- [ ] `src/poster/submit.js` — use `encode.announceSubmission(...)` from `swarmit-protocol/chain` to build calldata, pass to `chain/writer.js`
- [ ] `src/poster/user-feed.js` — use the bee client's `createFeedManifest` and `updateFeed` for the bot's own `author.userFeed`

### 3.3 Bot-specific logic (non-library)

- [ ] RSS fetcher via `rss-parser`
- [ ] SQLite state DB with `sources`, `posted_items`, `meta` tables
- [ ] Main loop in `src/loop.js`: fetch → dedup → build → upload → encode → send → record
- [ ] Tests for the bot-specific logic (dedup, HTML stripping, content sanity caps)

### 3.4 Local run + deploy

- [ ] Local `.env` with a test private key, test board slug, single RSS source (Hacker News). Run `node src/index.js`, observe it post one entry.
- [ ] Verify curator picks it up and indexes it (dashboard shows new post on the target board).
- [ ] Create Coolify app for the bot (similar shape to curator: Nixpacks, bind-mounted state DB, network alias `rss-bot`).
- [ ] Deploy, verify running in prod.

**Phase 3 exit criterion**: bot posts RSS entries to a test board; curator indexes them; dashboard shows them.

---

## Phase 4 — Deferred refactors (do when you're next in the repo for other reasons)

Not blocking anything. No specific schedule. Open tickets / TODOs:

- [ ] **Dashboard**: replace any protocol-object or chain-ABI references in `$DASHBOARD/src/lib/` with `swarmit-protocol` imports. Currently thin; expected to be a small PR.
- [ ] **Web app**: replace `$WEBAPP/src/protocol/`, `$WEBAPP/src/chain/contract.js`, `$WEBAPP/src/chain/events.js`, `$WEBAPP/src/chain/transactions.js` with `swarmit-protocol` imports. Keep `$WEBAPP/src/swarm/fetch.js` and `feeds.js` as-is (browser gateway, not in scope for the library). This is the biggest refactor and the one with the most user-facing risk. **Important**: during this refactor, rename all `parentSubmissionId` / `rootSubmissionId` call sites to `parentSubmissionRef` / `rootSubmissionRef` to match the library's API (see plan §10 item 6).
- [ ] **v0.2 consideration**: if log-shape normalization duplication starts to hurt (plan §11), add pure `decode.*` helpers to the library in a v0.2 release.

---

## Global notes / things to watch out for

1. **Never deploy curator from a `file:` dep.** Coolify Nixpacks cannot resolve `file:../swarmit-protocol` — the build container has no access to sibling repos. Must be a git dep (Phase 2) before Coolify deploy.

2. **Keep `swarmit-protocol` changes versioned.** Do not push breaking changes to the `main` branch of `swarmit-protocol` without bumping the version and creating a new tag. Consumers pin to tags precisely so they are not surprised.

3. **The root export and the ABI are API contracts.** Once v0.1.0 is tagged, removing or renaming an export = breaking change = minor version bump pre-1.0 (or major post-1.0). Adding new exports is non-breaking.

4. **`parentSubmissionRef` naming migration.** The library uses `parentSubmissionRef` / `rootSubmissionRef`. The web app's current `transactions.js` uses `parentSubmissionId` / `rootSubmissionId`. When the web app refactor happens (deferred, Phase 4), call sites need to be updated. Any bot code written against the library from day one will use the new names.

5. **Curator test suite is the integration safety net.** If curator tests pass after the refactor, the library extraction is good. Don't skip running them.

6. **The ABI is the one thing that must stay in sync with the contract.** Any change to `SwarmitRegistryV2.sol` requires a matching `swarmit-protocol` update and a library version bump. Document this discipline in the library's `README.md`.
