# Swarm Message Board v1 Multi-View Feeds Patch

Date: 2026-03-27
Status: Draft patch proposal

## Purpose

This document proposes a backward-compatible v1 extension that allows a curator to publish multiple named feed-backed views for:

- `globalIndex`
- `boardIndex`
- optionally `threadIndex`

Examples include:

- `new`
- `best`
- `hot`
- `rising`
- `controversial`

The key idea is that these are not merely client-side sort toggles. They are distinct curator-published views over the same underlying submission universe.

This patch concerns off-chain Swarm objects and feed discovery only. The `submissionId` and `submissionRef` fields shown in `boardIndex`, `threadIndex`, and `globalIndex` examples remain the existing off-chain Swarm-ref fields and are unaffected by the V2 contract's on-chain `bytes32 submissionId` surface.

## Summary of Changes

1. Keep existing feed fields as the default view:
   - `curatorProfile.globalIndexFeed`
   - `curatorProfile.boardFeeds`
   - `boardIndex.entries[].threadIndexFeed`
2. Add optional named-view feed maps:
   - `curatorProfile.globalViewFeeds`
   - `curatorProfile.boardViewFeeds`
   - `boardIndex.entries[].threadViewFeeds`
3. Define `viewId` as an interoperable identifier for a named curator view
4. Define fallback rules:
   - if a requested view is available, use it
   - otherwise fall back to the existing default feed
5. Do not change:
   - contract surface
   - `boardIndex`, `globalIndex`, or `threadIndex` object core identity rules

## Rationale

The current protocol already treats curator-owned feeds as mutable view surfaces rather than singular truths.

Allowing multiple named feeds per curator extends that same design:

- one curator may publish a default board view plus a chronological `new` board view
- another curator may publish a `best` global feed and a `controversial` thread feed
- different views may differ in both ranking and inclusion

This is more honest than pretending these are only local client-side sort modes.

## Design Principles

1. Existing single-feed fields remain the default path for backward compatibility.
2. Named views are optional. Curators are not required to publish every view.
3. Clients MUST tolerate unknown view IDs.
4. The protocol may recommend shared view IDs without requiring identical algorithms across curators.
5. Named views are discovery metadata, not new object types.

## View ID Semantics

`viewId` is a short identifier for a named curator view.

Recommended v1 vocabulary:

- `new`
- `best`
- `hot`
- `rising`
- `controversial`

Rules:

- Clients MUST tolerate unknown `viewId` values.
- Curators MAY publish custom `viewId` values.
- `new` SHOULD represent a clearly chronological view, ideally by chain announcement order or another documented chronological policy.
- `best`, `hot`, `rising`, and `controversial` MAY be offered as curator-defined ranked views.
- When raw vote signals are available, curators MAY use them as inputs to ranked views such as `best`, `hot`, `rising`, and `controversial`, but the ranking formulas remain curator-defined.
- Clients MUST NOT assume that non-`new` view IDs have identical semantics across curators.

## Normative Patch for `swarm-message-board-v1-spec.md`

### Patch Section 7.6 `boardIndex`

Amend the optional entry fields list to include:

```md
- `threadViewFeeds`
```

Add the following normative text after the existing `threadIndexFeed` definition:

```md
`threadViewFeeds`, if present, MUST be an object whose keys are `viewId` strings and whose values are stable feed-manifest `bzz://` URLs for alternate `threadIndex` views of the same root submission by the same curator.

`threadIndexFeed` remains the default thread view feed.

If a client requests a specific thread `viewId` and `threadViewFeeds[viewId]` exists, the client SHOULD use that feed. Otherwise it SHOULD fall back to `threadIndexFeed`.
```

Replace the existing example entry with:

```json
{
  "submissionId": "bzz://SUB1_REF",
  "submissionRef": "bzz://SUB1_REF",
  "threadIndexFeed": "bzz://THREAD1_DEFAULT_FEED_MANIFEST_REF",
  "threadViewFeeds": {
    "new": "bzz://THREAD1_NEW_FEED_MANIFEST_REF",
    "controversial": "bzz://THREAD1_CONTROVERSIAL_FEED_MANIFEST_REF"
  },
  "rank": 1,
  "labels": ["hot"]
}
```

### Patch Section 7.7 `threadIndex`

Replace the `Discovery:` text with:

```md
Discovery:

- clients discover a curator's default `threadIndex` feed for a thread from the matching top-level `boardIndex` entry's `threadIndexFeed`
- clients MAY discover alternate named thread views from `boardIndex` entry `threadViewFeeds`
- `threadIndexFeed` and `threadViewFeeds[*]` SHOULD be stable feed-manifest URLs so later thread updates do not require changing the thread route itself
```

### Patch Section 7.9 `curatorProfile`

Amend the optional fields list to include:

```md
- `globalViewFeeds`
- `boardViewFeeds`
```

Add the following normative text after the optional fields list:

```md
`globalViewFeeds`, if present, MUST be an object whose keys are `viewId` strings and whose values are stable feed-manifest `bzz://` URLs resolving to alternate `globalIndex` views by the same curator.

`boardViewFeeds`, if present, MUST be an object whose keys are board slug strings and whose values are objects mapping `viewId` strings to stable feed-manifest `bzz://` URLs resolving to alternate `boardIndex` views for that board by the same curator.

`globalIndexFeed` remains the default global view feed.

`boardFeeds[slug]`, if present, remains the default board view feed for that board.

If a client requests a specific global or board `viewId` and the corresponding named view feed exists, the client SHOULD use that feed. Otherwise it SHOULD fall back to the default feed field.
```

Replace the example with:

```json
{
  "protocol": "freedom-board/curator/v1",
  "curator": "0xCuratorA",
  "name": "Chronological Curator",
  "description": "Spam-filtered board and global views",
  "policyRef": "bzz://POLICY_REF",
  "globalIndexFeed": "bzz://GLOBAL_DEFAULT_FEED_MANIFEST_REF",
  "globalViewFeeds": {
    "new": "bzz://GLOBAL_NEW_FEED_MANIFEST_REF",
    "best": "bzz://GLOBAL_BEST_FEED_MANIFEST_REF"
  },
  "boardFeeds": {
    "tech": "bzz://TECH_DEFAULT_FEED_MANIFEST_REF"
  },
  "boardViewFeeds": {
    "tech": {
      "new": "bzz://TECH_NEW_FEED_MANIFEST_REF",
      "best": "bzz://TECH_BEST_FEED_MANIFEST_REF"
    }
  }
}
```

### Patch Section 7.10 Stable Feed Manifest References

Extend the examples list with:

```md
- `curatorProfile.globalViewFeeds` and `curatorProfile.boardViewFeeds` SHOULD contain stable feed-manifest URLs
- `boardIndex.entries[].threadViewFeeds` SHOULD contain stable feed-manifest URLs
```

### Add New Section 10.0 `Global Front Page Load`

Insert before current Section 10.1:

```md
## 10.0 Global Front Page Load

Given a route such as `/` or another client-defined global front page route, a compliant client SHOULD:

1. load the application shell
2. select a curator
3. select a desired global `viewId`, if any
4. resolve the curator's global feed:
   - use `globalViewFeeds[viewId]` if available
   - otherwise fall back to `globalIndexFeed`
5. fetch the latest `globalIndex`
6. fetch each referenced `submission`
7. fetch each referenced immutable content object
8. render the curated cross-board front page
```

### Patch Section 10.1 `Board Page Load`

Replace steps 4 through 6 with:

```md
4. select a curator
5. select a desired board `viewId`, if any
6. resolve the curator's board feed:
   - use `boardViewFeeds[slug][viewId]` if available
   - otherwise fall back to `boardFeeds[slug]`
7. fetch the latest `boardIndex`
8. fetch each referenced `submission`
9. fetch each referenced `post` or `reply`
10. render the board view
```

Replace the sequence diagram feed-resolution steps with:

```md
  C->>F: Resolve board feed for selected view
  F-->>C: latest boardIndex ref
```

### Patch Section 10.2 `Thread Page Load`

Replace steps 5 through 7 with:

```md
5. locate the root submission entry
6. select a desired thread `viewId`, if any
7. resolve the thread feed:
   - use `threadViewFeeds[viewId]` if available
   - otherwise fall back to `threadIndexFeed`
8. fetch the latest `threadIndex`
9. fetch each referenced `submission`
10. fetch each referenced immutable content object
11. render the materialized reply tree
```

Replace the sequence diagram thread feed steps with:

```md
  C->>C: Read thread feed metadata from root entry
  C->>F: Resolve thread feed for selected view
  F-->>C: latest threadIndex ref
```

### Patch Section 12 `Curator Responsibilities`

Amend item 5 to:

```md
5. publish updated default `boardIndex`, `threadIndex`, and optionally `globalIndex` feeds, and MAY publish additional named views for those same scopes
```

## Normative Patch for `swarm-message-board-v1-schemas.md`

### Patch Section 7 `boardIndex`

Amend optional entry fields to include:

```md
- `threadViewFeeds`
```

Add the following note:

```md
`threadViewFeeds`, if present, MUST be an object mapping `viewId` strings to stable feed-manifest `bzz://` URLs for alternate `threadIndex` views of the same root submission by the same curator.

`threadIndexFeed` remains the default thread view feed.
```

### Patch Section 10 `curatorProfile`

Amend the example to:

```json
{
  "protocol": "freedom-board/curator/v1",
  "curator": "0xCuratorA",
  "name": "Chronological Curator",
  "description": "Spam-filtered board and global views",
  "policyRef": "bzz://POLICY_REF",
  "globalIndexFeed": "bzz://GLOBAL_DEFAULT_FEED_MANIFEST_REF",
  "globalViewFeeds": {
    "new": "bzz://GLOBAL_NEW_FEED_MANIFEST_REF",
    "best": "bzz://GLOBAL_BEST_FEED_MANIFEST_REF"
  },
  "boardFeeds": {
    "tech": "bzz://TECH_DEFAULT_FEED_MANIFEST_REF"
  },
  "boardViewFeeds": {
    "tech": {
      "new": "bzz://TECH_NEW_FEED_MANIFEST_REF",
      "best": "bzz://TECH_BEST_FEED_MANIFEST_REF"
    }
  }
}
```

Amend the optional fields list to include:

```md
- `globalViewFeeds`
- `boardViewFeeds`
```

Add the following constraints:

```md
- `globalViewFeeds`, if present, MUST be an object mapping `viewId` strings to stable feed-manifest `bzz://` URLs for `globalIndex` views
- `boardViewFeeds`, if present, MUST be an object mapping board slug strings to objects that map `viewId` strings to stable feed-manifest `bzz://` URLs for `boardIndex` views
- `globalIndexFeed` remains the default global view feed
- `boardFeeds[slug]`, if present, remains the default board view feed
```

## Validation Implications

If this patch is adopted, validators should be extended so that:

- `globalViewFeeds[*]` must be normalized `bzz://` feed-manifest URLs
- `boardViewFeeds[*][*]` must be normalized `bzz://` feed-manifest URLs
- `threadViewFeeds[*]` must be normalized `bzz://` feed-manifest URLs
- unknown `viewId` strings are accepted

## Client Guidance

Recommended client behavior:

- preserve a separate user preference for:
  - selected curator
  - selected `viewId`
- default to the curator's default feed if no named view is selected
- show the active curator and active view clearly in the UI
- gracefully hide unavailable view tabs rather than rendering them as broken

## Operational Guidance

This patch allows, but does not require, multi-view thread publishing.

Curators may choose to publish:

- multiple global views
- multiple board views
- only a single default thread view

Nothing in this patch requires every curator to publish every named view for every scope.

A simple reference deployment can demonstrate the mechanism with `new` plus one explicitly defined ranked view such as `best`. More ambiguous ranked labels can wait until their formulas are documented.

## Explicit Non-Goals of This Patch

This patch does not:

- standardize ranking algorithms across curators
- require votes or karma systems
- require time-windowed views such as `top/day` or `top/week`
- add new on-chain events
- require a single canonical default view label

## Backward Compatibility

This patch is backward compatible:

- existing clients can keep using:
  - `globalIndexFeed`
  - `boardFeeds`
  - `threadIndexFeed`
- existing curator profiles remain valid
- existing board and thread routes remain valid

## Recommendation

If adopted, this patch should be merged into:

- `docs/swarm-message-board-v1-spec.md`
- `docs/swarm-message-board-v1-schemas.md`

No contract changes are required.
