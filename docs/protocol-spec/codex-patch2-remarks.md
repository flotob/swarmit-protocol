Implement the multi-view feeds patch described in:

/Users/florian/Git/freedom-dev/swarmit/docs/swarm-message-board-v1-multi-view-feeds-patch.md

That patch doc is the current implementation target. It is a standalone patch proposal for now, not yet merged into the main spec/schemas docs.

High-level intent:
- Curators can publish multiple named feed-backed views for:
  - global scope
  - board scope
  - optionally thread scope
- Existing single-feed fields remain the default/backward-compatible path.
- Named views are discovery metadata, not new object types.
- No contract changes.

Exact field names from the patch:
- `curatorProfile.globalViewFeeds`
- `curatorProfile.boardViewFeeds`
- `boardIndex.entries[].threadViewFeeds`

Existing default fields remain:
- `curatorProfile.globalIndexFeed`
- `curatorProfile.boardFeeds`
- `boardIndex.entries[].threadIndexFeed`

Fallback rule:
- If a requested `viewId` exists in the named-view map, use it.
- Otherwise fall back to the existing default feed field.

Recommended vocabulary:
- `new`
- `best`
- `hot`
- `rising`
- `controversial`

Important protocol rules:
- Clients MUST tolerate unknown `viewId` strings.
- Curators are NOT required to publish every view.
- We should NOT invent fake ranking semantics.
- The reference implementation should publish `new` and one simple ranked view such as `best` once that formula is explicit; defer more ambiguous ranked views until their formulas are defined.

Implementation target for this pass:
- Add full protocol/data-model support for named views.
- Add SPA read-path/view-selection support for named views.
- Add curator publishing support for named views.
- Reference curator should publish:
  - default global feed as today
  - default board feeds as today
  - `new` named global/board views
  - `best` named global/board views using a simple documented formula
- It is acceptable for `new` to point to the same feed-manifest URL as the current default feed, since the current reference curator is chronological.
- For the first pass, `best` should sort by net score descending (`upvotes - downvotes`), with newer chain announcement order as the tie-break.
- Thread named views are optional in this pass:
  - implement protocol support and read fallback for them
  - curator may omit `threadViewFeeds` for now unless it is trivial to publish `new` as an alias of the default thread feed

Do NOT:
- add contract events
- add ranking algorithms for `hot/rising/controversial` before their formulas are defined
- break existing default-feed clients
- require thread multi-view publishing

========================================
SPA repo
========================================

Repo:
- /Users/florian/Git/freedom-dev/swarmit

Files likely to touch:
- `src/protocol/objects.js`
- `test/protocol/objects.test.js`
- `src/composables/useGlobalFeed.js`
- `src/composables/useBoard.js`
- `src/composables/useThread.js`
- `src/composables/useCurators.js` if it needs to surface profile-enriched view metadata
- `src/stores/curators.js`
- add a new store for view preferences, e.g. `src/stores/views.js`
- `src/views/FeedView.vue`
- `src/views/BoardView.vue`
- `src/views/ThreadView.vue`
- any current curator/view banner component, if we expose view selection in the UI

SPA protocol/data-model changes:
1. Extend `validateCuratorProfile()` to accept optional:
   - `globalViewFeeds`: object mapping `viewId -> bzz:// feed-manifest URL`
   - `boardViewFeeds`: object mapping `slug -> object(viewId -> bzz:// feed-manifest URL)`
2. Extend `buildCuratorProfile()` to accept those fields.
3. Extend `validateBoardIndex()` entry validation so each entry may optionally contain:
   - `threadViewFeeds`: object mapping `viewId -> bzz:// feed-manifest URL`
4. No changes to:
   - `globalIndex`
   - `boardIndex`
   - `threadIndex`
   object core identities beyond the optional discovery metadata above.

SPA state/preferences:
- Preserve selected curator separately from selected view.
- Do NOT overload curator preference keys with view selection.
- Add a dedicated persisted Pinia store for selected `viewId`, probably with scope keys like:
  - `global`
  - `board:<slug>`
  - optionally `thread:<slug>:<rootSubmissionId>`
- If thread-specific view selection is too much for first pass:
  - thread view may inherit the board-selected `viewId`
  - still support `threadViewFeeds` at the resolver level with fallback to default

SPA read-path changes:
1. Global front page:
   - if selected `viewId` exists in `curatorProfile.globalViewFeeds`, use that feed
   - otherwise use `curatorProfile.globalIndexFeed`
2. Board page:
   - if selected `viewId` exists in `curatorProfile.boardViewFeeds[slug]`, use that feed
   - otherwise use `curatorProfile.boardFeeds[slug]`
3. Thread page:
   - from the root `boardIndex` entry:
     - if selected `viewId` exists in `threadViewFeeds`, use it
     - otherwise use `threadIndexFeed`
4. All fetched objects must still be validated at the trust boundary as we do elsewhere.

SPA query-key changes:
- Include selected `viewId` in the query keys for:
  - global feed
  - board feed
  - thread feed
- Existing curator-pref-related refetch logic should remain correct.
- A view change must trigger a refetch.

SPA UI guidance:
- Show the active curator and active view clearly.
- Hide unavailable view tabs/buttons instead of showing broken ones.
- Do NOT hardcode that every curator has every view.
- Order known view IDs first if helpful:
  - `new`, `best`, `hot`, `rising`, `controversial`
  then any unknown/custom IDs after that.
- It is okay if the picker is hidden when there are no named views or only one effective option.
- Since the reference curator may initially publish only `new` and `best`, do not force a noisy UI if there is no meaningful choice yet.

SPA route/product guidance:
- Keep current routes.
- This change is feed-resolution and view-selection metadata, not a route redesign.
- Existing board/thread/global routes should continue to work with default feeds even if no named views are published.

SPA tests to add/update:
- protocol validator accepts valid `globalViewFeeds`, `boardViewFeeds`, `threadViewFeeds`
- rejects malformed non-object maps
- rejects invalid non-`bzz://` feed refs inside those maps
- `useGlobalFeed` resolves named view then falls back to default
- `useBoard` resolves named view then falls back to default
- `useThread` resolves named view then falls back to default
- changing selected `viewId` triggers refetch

========================================
Curator repo
========================================

Repo:
- /Users/florian/Git/freedom-dev/swarmit-curator

Files likely to touch:
- `src/protocol/objects.js`
- `src/indexer/board-indexer.js`
- `src/publisher/profile-manager.js`
- `src/publisher/feed-manager.js`
- `src/indexer/orchestrator.js` and/or `src/index.js`
- `src/indexer/state.js`
- maybe `src/config.js`
- tests:
  - `test/protocol/objects.test.js`
  - `test/publisher/profile-manager.test.js`
  - any orchestrator/feed-manager tests affected

Curator protocol/data-model changes:
1. Mirror the same validator/builder changes as the SPA:
   - `globalViewFeeds`
   - `boardViewFeeds`
   - `threadViewFeeds`
2. Unknown `viewId` strings are allowed.
3. All feed refs in those maps must be normalized `bzz://` feed-manifest URLs.

Curator publishing behavior for this pass:
- Continue publishing current default feeds exactly as today.
- Add named-view publishing for:
  - global scope: `new`
  - global scope: `best`
  - board scope: `new`
  - board scope: `best`
- It is acceptable for:
  - `globalViewFeeds.new === globalIndexFeed`
  - `boardViewFeeds[slug].new === boardFeeds[slug]`
  if the current default view is already chronological.
- For the first pass, `best` should use:
  - primary sort: net score descending (`upvotes - downvotes`)
  - tie-break: newer chain announcement first
- Do NOT publish fake `best/hot/rising/controversial` views unless there is real distinct logic.
- Thread named views:
  - protocol support should exist
  - publishing them is optional
  - safe first pass is to omit `threadViewFeeds` entirely
  - if trivial, `threadViewFeeds.new` may alias `threadIndexFeed`

Curator state/config guidance:
- Add an explicit concept of supported named views, even if initial value is just:
  - `['new', 'best']`
- This can live in config or a small constant.
- Feed manifests for named views should be tracked in state separately from default feeds.
- Avoid conflating default feed refs with named-view feed refs even if they currently point to the same manifest.

Curator profile changes:
- `publishAndDeclare()` / curator-profile building must include:
  - `globalViewFeeds`
  - `boardViewFeeds`
  when present
- Existing fields remain populated as before:
  - `globalIndexFeed`
  - `boardFeeds`

Board index changes:
- Each entry may optionally include `threadViewFeeds`
- If thread named views are not published in this pass, leave that field absent
- Do not emit empty objects just for the sake of it

Curator tests to add/update:
- protocol validator tests for new named-view fields
- profile-manager test must assert `globalViewFeeds` and `boardViewFeeds` in the published profile payload
- board-indexer test for optional `threadViewFeeds` if you choose to publish them
- orchestrator/feed-manager tests if named-view feeds add additional publish/update paths

========================================
Behavioral acceptance criteria
========================================

1. Backward compatibility:
- Existing clients using only default feeds still work.
- Existing curator profiles without named-view fields remain valid.
- Existing board/thread/global routes keep working.

2. SPA behavior:
- If a named view exists, the app can resolve and render it.
- If it does not exist, the app falls back cleanly to the default feed.
- View selection is persisted separately from curator selection.
- Query refetch happens when the selected view changes.

3. Curator behavior:
- Curator continues publishing default feeds.
- Curator now also publishes named `new` and `best` views for global and board scopes.
- CuratorProfile advertises those named views.
- No fake ranked views are published beyond the documented `best` formula.

4. Thread behavior:
- Thread read path supports `threadViewFeeds` when present.
- If absent, it cleanly falls back to `threadIndexFeed`.

5. Validation:
- Both repos validate all new named-view maps at the protocol boundary.
- Unknown `viewId` keys are accepted.
- Invalid feed refs are rejected.

If you need the authoritative patch source for this change, use:
- `/Users/florian/Git/freedom-dev/swarmit/docs/swarm-message-board-v1-multi-view-feeds-patch.md`

Implement against that patch.
