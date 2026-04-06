# Feed-Backed Curator Profiles — Execution Roadmap

**Goal**: Change curator profiles from "immutable object declared on-chain every time" to "feed-backed mutable profile declared once."

**Contract**: unchanged. **ABI**: unchanged. **Protocol schema**: unchanged.
This is a semantics upgrade + implementation refactor across three repos.

**Rollout order**: library → SPA → curator (SPA-first so readers handle both old and new refs before curators start emitting feed-manifest refs).

---

## Phase 1 — Library (`swarmit-protocol`)

Tiny. Adds one constant + updates JSDoc. No behavior change.

### 1.1 Add `CURATOR_PROFILE_FEED_NAME` constant

- [ ] In `src/objects/constants.js`, add:
  ```js
  export const CURATOR_PROFILE_FEED_NAME = 'curator-profile-v1';
  ```
  Versioned topic name — cheap future-proofing if the profile feed schema ever changes.

- [ ] In `src/objects/index.js`, add `CURATOR_PROFILE_FEED_NAME` to the re-export list from `./constants.js`.

- [ ] In `src/index.js`, add `CURATOR_PROFILE_FEED_NAME` to the named re-export list from `./objects/constants.js`.

### 1.2 Update `declareCurator` encoder JSDoc

- [ ] In `src/chain/encode.js`, update the JSDoc on `declareCurator()`:
  ```
  curatorProfileRef is the stable Swarm locator for the curator profile.
  In v1.x practice this should be the curator's profile feed manifest ref
  (a Swarm feed that always resolves to the latest curatorProfile JSON).
  The contract accepts any string; the feed-manifest convention is a
  protocol-level recommendation, not an on-chain enforcement.
  ```

### 1.3 Test + tag

- [ ] Add a test in `test/objects/objects.test.js` asserting the constant is exported and equals `'curator-profile-v1'`.
- [ ] `npm test` — expect 135+ green.
- [ ] Bump `package.json` version to `0.3.0`.
- [ ] Commit, tag `v0.3.0`, push main + tag.

**Exit criterion**: library published on GitHub at v0.3.0 with the new constant and updated JSDoc.

---

## Phase 2 — SPA (`swarmit`)

Adds a TTL-aware profile resolver. Replaces all `fetchObject(curatorProfileRef)` calls in curator-profile read sites. Makes `useCuratorProfiles` genuinely refreshable. Works with both old immutable refs and new feed-manifest refs.

### 2.1 Add `resolveCuratorProfile()` to `src/swarm/feeds.js`

- [ ] Add function `resolveCuratorProfile(curatorProfileRef)`:
  - Accepts a `bzz://` ref or bare hex (same as all other ref-accepting helpers)
  - Fetches via `/bzz/<ref>/` (works for both immutable content refs AND feed manifest refs)
  - Parses JSON
  - Validates specifically as a curatorProfile via `validate()` — checks `protocol === TYPES.CURATOR`
  - Uses a **30-second TTL cache** keyed by the ref:
    - If cached entry exists and is younger than 30s, return it
    - Otherwise fetch fresh, cache, return
  - Does NOT use `fetchObject()` (which caches immutably forever)
  - Does NOT modify `fetchObject()`'s cache or behavior
  - Returns the validated curatorProfile object

- [ ] Implementation note on the TTL cache:
  - A simple `Map<ref, { profile, fetchedAt }>` is sufficient
  - No LRU needed — there are at most a handful of curators
  - The cache lives at module scope in `feeds.js` (same lifetime as the SPA session)

### 2.2 Replace `fetchObject(curatorProfileRef)` in all curator-profile read sites

Grep for `fetchObject.*curatorProfileRef` and replace each with `resolveCuratorProfile()`:

- [ ] `src/composables/useCurators.js` — `buildCandidates()` function where it fetches profiles to find which curator covers a board
- [ ] `src/composables/useGlobalFeed.js` — where it fetches each curator candidate's profile to resolve the global feed
- [ ] `src/composables/useSubmissionStatus.js` — where it fetches curator profiles during submission status polling
- [ ] `src/composables/useCuratorProfiles.js` — where it loads profiles into the reactive Map (plus the refresh fix below)

For each:
- Import `resolveCuratorProfile` from `'../swarm/feeds.js'`
- Replace `fetchObject(c.curatorProfileRef)` with `resolveCuratorProfile(c.curatorProfileRef)`
- Remove any now-unused `fetchObject` import if it was the only consumer

### 2.3 Fix `useCuratorProfiles.js` — make it genuinely refreshable

Current behavior: loads each curator's profile into a reactive `Map` once, never refreshes.

Required change:
- [ ] Add a periodic refresh mechanism that re-resolves known curator profiles
- [ ] The refresh must be **lifecycle-safe**: if the composable is unmounted (component using it is destroyed), the timer must be cleaned up
- [ ] Implementation:
  - Use `setInterval` (or Vue's `useIntervalFn` from `@vueuse/core` if available) with a 30s interval
  - On each tick, re-resolve ALL entries in the profiles Map via `resolveCuratorProfile()`
  - Update the reactive Map entries with fresh profiles
  - On unmount (`onUnmounted` / `onScopeDispose`), clear the interval
- [ ] The refresh should re-resolve **existing entries**, not just newly-seen curators
- [ ] The 30s interval aligns with the resolver's 30s TTL — so each refresh actually hits the network (the TTL has expired by the time the interval fires)

### 2.4 Remove stale comment in `useCuratorProfiles.js`

- [ ] Delete the line: `"Profiles are immutable Swarm objects — fetchObject caches them after first load"` — no longer true.

### 2.5 SPA tests

- [ ] Add `test/swarm/feeds.test.js` (or extend existing test file) with tests for `resolveCuratorProfile()`:
  1. Resolves a valid curatorProfile successfully
  2. Returns cached result within 30s TTL window
  3. Refetches after TTL expiry
  4. Validates the fetched object — rejects non-curatorProfile objects
  5. Works with an immutable content ref (old-style)
  6. Works with a feed-manifest ref (new-style) — same implementation path, but lock the expectation with two explicit test cases as the reviewer requested

- [ ] Add or update tests for `useCuratorProfiles`:
  1. Profiles update after TTL/refresh, not permanently stuck on first fetch
  2. Timer is cleaned up on unmount (lifecycle safety)

### 2.6 Update SPA's `swarmit-protocol` dep to v0.3.0

- [ ] In `package.json`, update the git dep pin to `#v0.3.0`.
- [ ] `rm -rf node_modules/swarmit-protocol package-lock.json && npm install`
- [ ] `npm test` + `npm run build`

### 2.7 Commit locally (no push)

- [ ] Commit: `"feat: feed-backed curator profile resolution with 30s TTL"`
- [ ] Do NOT push. Per feedback memory, rides on next real ship.

**Exit criterion**: SPA resolves curator profiles with TTL freshness. Works with both old immutable refs and new feed-manifest refs. `useCuratorProfiles` refreshes periodically and cleans up on unmount. Tests green, vite build clean.

---

## Phase 3 — Curator (`swarmit-curator`)

Major refactor of `profile-manager.js`. Reuses existing feed machinery. Adds signature-based change detection. Declaration becomes a one-time event.

### 3.1 Update curator's `swarmit-protocol` dep to v0.3.0

- [ ] In `package.json`, update the git dep pin to `#v0.3.0`.
- [ ] `rm -rf node_modules/swarmit-protocol package-lock.json && npm install`
- [ ] `npm test` — expect 175/175 green (baseline before any changes)

### 3.2 Add state helpers for profile signature

- [ ] In the meta/state layer, add two helpers (or just use `getMeta`/`setMeta` directly):
  - `getLastProfileSignature()` — reads `meta.last_profile_signature` (returns null if not set)
  - `setLastProfileSignature(sig)` — writes to `meta.last_profile_signature`

### 3.3 Refactor `src/publisher/profile-manager.js`

Split the current `needsProfileUpdate()` + `publishAndDeclare()` into:

#### A. `buildProfile()`

- [ ] Extract the profile-building logic from the top half of `publishAndDeclare()` into a standalone function.
- [ ] Returns the built `curatorProfile` object (validated), or throws if no global feed exists yet.
- [ ] Pure function of current state — no side effects, no network calls.

#### B. `needsProfileUpdate()`

- [ ] Replace the marker-based detection with signature-based detection:
  ```js
  export function needsProfileUpdate() {
    try {
      const profile = buildProfile();
      const currentSig = JSON.stringify(profile);
      const lastSig = getLastProfileSignature();
      return currentSig !== lastSig;
    } catch {
      return false; // no global feed yet, nothing to publish
    }
  }
  ```
- [ ] This catches ALL profile content changes: name, description, board additions, view additions, default-feed changes, feed URL changes — not just board/view marker presence.
- [ ] Note: do NOT call this from `hasPendingWork()`. The retry flag (`getRepublishProfile()`) handles the "wake up" case. `needsProfileUpdate()` runs only inside `publishGlobalAndProfile()` where we'd actually publish.

#### C. `publishProfileToFeed()`

- [ ] Build the profile via `buildProfile()`
- [ ] Publish profile JSON immutably via existing `publishAndUpdateFeed(CURATOR_PROFILE_FEED_NAME, profile, 'curatorProfile')` from `feed-manager.js`
- [ ] This handles: validate → publishJSON → ensureFeed → updateFeed
- [ ] On success, store the new signature: `setLastProfileSignature(JSON.stringify(profile))`
- [ ] Also update `setPublishedKeys()` for backward compat of the bookkeeping (optional — can defer removal to a later cleanup)
- [ ] Return the profile feed manifest bzz:// URL via `getFeedBzzUrl(CURATOR_PROFILE_FEED_NAME)`

#### D. `ensureDeclared()`

- [ ] Lives in `profile-manager.js` (not chain/reader.js — this is profile-publication logic)
- [ ] Runs after every successful profile-feed publish (not just at startup)
- [ ] Logic:
  1. Get the local profile feed manifest ref: `getFeedBzzUrl(CURATOR_PROFILE_FEED_NAME)`
  2. Query chain for the latest `CuratorDeclared` event for this curator address (helper function, see 3.4 below)
  3. If no declaration exists OR the declared ref !== local feed manifest ref:
     - Send `declareCurator({ curatorProfileRef: feedManifestBzzUrl })` tx
     - Log the tx hash
  4. Otherwise: skip (already declared correctly)
- [ ] This handles:
  - Fresh start: no declaration → declare
  - Migration from old immutable ref: declared ref differs from feed manifest → declare once
  - Steady state: declared ref matches feed manifest → skip (no gas, no tx)

### 3.4 Add chain query helper for own declaration

- [ ] In `profile-manager.js`, add a local helper:
  ```js
  async function getLatestOwnDeclaration() {
    // Query CuratorDeclared events filtered by curator address (indexed topic)
    // from CONTRACT_DEPLOY_BLOCK to 'latest'
    // Return the curatorProfileRef string from the most recent event, or null
  }
  ```
- [ ] Uses `provider.getLogs()` with topic filter on `TOPICS.CuratorDeclared` + curator address
- [ ] Parses the last log entry with `iface.parseLog()`
- [ ] Returns `curatorProfileRef` string or `null`

### 3.5 Update orchestrator wiring

- [ ] In `src/indexer/orchestrator.js`, `publishGlobalAndProfile()`:
  - Replace the current profile block:
    ```js
    // OLD:
    if (needsProfileUpdate() || getRepublishProfile()) {
      await publishAndDeclare();
      setRepublishProfile(false);
    }
    ```
    With:
    ```js
    // NEW:
    if (needsProfileUpdate() || getRepublishProfile()) {
      await publishProfileToFeed();
      await ensureDeclared();
      setRepublishProfile(false);
    }
    ```
  - Error handling stays the same: catch → `setRepublishProfile(true)`

- [ ] `hasPendingWork()`:
  - Keep checking `getRepublishProfile()` (the retry flag)
  - Remove `needsProfileUpdate()` from `hasPendingWork()` — the signature check is too expensive for an idle check and only needs to run when we're actually about to publish
  - Actually: `needsProfileUpdate()` builds the entire profile just to compare signatures. That's fine inside `publishGlobalAndProfile()` but wasteful in `hasPendingWork()`. Use only the retry flag there.

### 3.6 Curator tests

Rewrite `test/publisher/profile-manager.test.js`:

- [ ] **Test 1: profile feed publish path** — publishing a profile update writes to the feed without sending a tx when the declaration already matches.
  - Setup: mock chain to return existing declaration matching the local feed manifest
  - Assert: `publishJSON` called, feed updated, `wallet.sendTransaction` NOT called

- [ ] **Test 2: initial declaration** — no declaration exists → publish profile feed → send exactly one tx.
  - Setup: mock chain to return no CuratorDeclared events
  - Assert: `publishJSON` called, feed updated, `wallet.sendTransaction` called once with correct calldata

- [ ] **Test 3: migration from old immutable profile ref** — latest on-chain ref differs from local feed manifest → sends exactly one tx.
  - Setup: mock chain to return CuratorDeclared with old ref, local feed manifest is different
  - Assert: `wallet.sendTransaction` called once

- [ ] **Test 4: no-op profile change detection** — same profile as last time → no feed update.
  - Setup: build profile, set `last_profile_signature` to matching JSON.stringify
  - Assert: `needsProfileUpdate()` returns false

- [ ] **Test 5: metadata-only profile change detection** — change curator name → profile update needed even if board/view set is unchanged.
  - Setup: publish profile, then change `config.curatorName`, rebuild
  - Assert: `needsProfileUpdate()` returns true

- [ ] **Test 6: republish retry semantics** — feed publish failure sets republish flag; successful retry clears it.
  - Setup: mock publishJSON to throw on first call, succeed on second
  - Assert: `getRepublishProfile()` true after failure, false after success

### 3.7 Run full test suite + smoke test

- [ ] `npm test` — expect all tests green
- [ ] `NODE_OPTIONS='--preserve-symlinks' node src/index.js` — briefly start curator locally, verify it boots, creates the profile feed, and declares once. Kill after a few poll cycles.
  - Note: this only works with a local `.env` and Bee connectivity. If not available, rely on test suite only.

### 3.8 Commit locally (no push)

- [ ] Commit: `"feat: feed-backed curator profiles — declare once, update via feed"`
- [ ] Do NOT push. Rides on next real deploy.

**Exit criterion**: curator publishes profiles to a stable feed. Declares on-chain only when feed manifest ref differs from latest on-chain declaration. Signature-based change detection catches all profile content changes. 6 new test scenarios green.

---

## Phase 4 — Verification checklist

After all three phases, verify:

- [ ] **Fresh curator bootstrap**: profile feed created, `CuratorDeclared` emitted once pointing at the feed manifest ref
- [ ] **Later profile changes** (e.g., new board registered): profile feed updates, NO new `CuratorDeclared` tx
- [ ] **Migration from old immutable declaration**: first upgraded run emits exactly one new declaration pointing to the feed manifest; later changes emit zero
- [ ] **SPA reads profiles with TTL freshness**: stale profiles refresh within 30s
- [ ] **SPA handles both old and new refs**: `resolveCuratorProfile()` works for immutable content refs and feed-manifest refs
- [ ] **`useCuratorProfiles` refreshes**: profiles in the picker update after changes, not permanently stuck
- [ ] **Chain logs clean up**: no more endless `CuratorDeclared` events per curator per board/view addition

---

## Things explicitly NOT in scope

- No contract changes
- No ABI changes
- No "unregister curator" work
- No custom-curator feature work
- No broad rewrite of `fetchObject()` caching behavior
- No mandatory backward-compat branch for old vs new refs (single resolver path handles both)
- No `declared_profile_feed_ref` state optimization in v1 (read chain state when needed)
- No tightening of curator profile validation to distinguish immutable vs feed refs
