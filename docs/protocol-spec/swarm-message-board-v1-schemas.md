# Swarm Message Board v1 Schemas

Date: 2026-03-23
Status: Draft

This document provides implementation-friendly schema definitions for [swarm-message-board-v1-spec.md](/Users/florian/Git/freedom-dev/freedom-browser/docs/swarm-message-board-v1-spec.md).

These are not full machine-readable JSON Schema documents yet. They are human-readable schema references intended to make v1 implementation and later schema generation straightforward.

## 1. Common Conventions

### 1.1 Shared Rules

- all objects MUST include `protocol`
- timestamps use Unix epoch milliseconds
- Swarm references SHOULD use normalized `bzz://<hex>` form
- unknown optional fields SHOULD be ignored unless explicitly forbidden

### 1.2 Shared Sub-Objects

#### `AuthorRef`

```json
{
  "address": "0xAuthor",
  "userFeed": "bzz://USER_FEED_MANIFEST_REF"
}
```

Required:

- `address`
- `userFeed`

#### `Body`

```json
{
  "kind": "markdown",
  "text": "Hello"
}
```

Required:

- `kind`
- `text`

#### `AttachmentDescriptor`

```json
{
  "reference": "bzz://ATTACHMENT_REF",
  "contentType": "image/png",
  "name": "cover.png",
  "sizeBytes": 12345,
  "kind": "image",
  "caption": "Optional caption",
  "altText": "Optional alt text"
}
```

Required:

- `reference`
- `contentType`

Optional:

- `name`
- `sizeBytes`
- `kind`
- `caption`
- `altText`

## 2. `board`

```json
{
  "protocol": "freedom-board/board/v1",
  "boardId": "tech",
  "slug": "tech",
  "title": "Technology",
  "description": "Posts about software, hardware, and networks",
  "createdAt": 1773792000000,
  "governance": {
    "chainId": 100,
    "type": "safe",
    "address": "0xBoardSafe"
  },
  "rulesRef": "bzz://RULES_REF",
  "endorsedCurators": [
    "0xCuratorA"
  ],
  "defaultCurator": "0xCuratorA",
  "metadata": {}
}
```

Required:

- `protocol`
- `boardId`
- `slug`
- `title`
- `description`
- `createdAt`
- `governance`

Optional:

- `rulesRef`
- `endorsedCurators`
- `defaultCurator`
- `metadata`

Validation notes:

- `defaultCurator`, if present, SHOULD appear in `endorsedCurators`
- `boardId` and `slug` SHOULD match in v1 unless there is a migration reason not to

## 3. `post`

```json
{
  "protocol": "freedom-board/post/v1",
  "author": {
    "address": "0xAuthor",
    "userFeed": "bzz://USER_FEED_MANIFEST_REF"
  },
  "title": "Hello Swarm",
  "body": {
    "kind": "markdown",
    "text": "First post"
  },
  "attachments": [],
  "createdAt": 1773792000000
}
```

Required:

- `protocol`
- `author`
- `title`
- `body`
- `createdAt`

Optional:

- `attachments`

## 4. `reply`

```json
{
  "protocol": "freedom-board/reply/v1",
  "author": {
    "address": "0xAuthor",
    "userFeed": "bzz://USER_FEED_MANIFEST_REF"
  },
  "body": {
    "kind": "markdown",
    "text": "Interesting point"
  },
  "createdAt": 1773792060000
}
```

Required:

- `protocol`
- `author`
- `body`
- `createdAt`

## 5. `submission`

```json
{
  "protocol": "freedom-board/submission/v1",
  "boardId": "tech",
  "kind": "reply",
  "contentRef": "bzz://REPLY_REF",
  "parentSubmissionId": "bzz://PARENT_SUBMISSION_REF",
  "rootSubmissionId": "bzz://ROOT_SUBMISSION_REF",
  "author": {
    "address": "0xAuthor",
    "userFeed": "bzz://USER_FEED_MANIFEST_REF"
  },
  "createdAt": 1773792060000,
  "flair": null,
  "metadata": {}
}
```

Required:

- `protocol`
- `boardId`
- `kind`
- `contentRef`
- `author`
- `createdAt`

Optional:

- `flair`
- `metadata`

Conditional:

- `parentSubmissionId` is required for replies and absent for top-level posts
- `rootSubmissionId` is required for replies and absent for top-level posts

Validation notes:

- the canonical `submissionId` is the immutable `submission` object's normalized Swarm reference
- the immutable `submission` object itself does not contain a `submissionId` field
- `kind` MUST be `post` or `reply`
- replies MUST include `parentSubmissionId` and `rootSubmissionId`
- top-level posts MUST NOT include `parentSubmissionId`

## 6. `userFeedIndex`

```json
{
  "protocol": "freedom-board/user-feed/v1",
  "author": "0xAuthor",
  "updatedAt": 1773792120000,
  "entries": [
    {
      "submissionId": "bzz://SUBMISSION_REF",
      "submissionRef": "bzz://SUBMISSION_REF",
      "boardId": "tech",
      "kind": "reply",
      "createdAt": 1773792060000
    }
  ]
}
```

Required:

- `protocol`
- `author`
- `updatedAt`
- `entries`

Each entry requires:

- `submissionId`
- `submissionRef`
- `boardId`
- `kind`
- `createdAt`

## 7. `boardIndex`

```json
{
  "protocol": "freedom-board/board-index/v1",
  "boardId": "tech",
  "curator": "0xCuratorA",
  "updatedAt": 1773792180000,
  "entries": [
    {
      "submissionId": "bzz://SUB1_REF",
      "submissionRef": "bzz://SUB1_REF",
      "threadIndexFeed": "bzz://THREAD1_FEED_MANIFEST_REF",
      "rank": 1,
      "labels": ["hot"]
    }
  ],
  "hidden": [
    {
      "submissionId": "bzz://SUB2_REF",
      "reason": "spam"
    }
  ]
}
```

Required:

- `protocol`
- `boardId`
- `curator`
- `updatedAt`
- `entries`

Each entry requires:

- `submissionId`
- `submissionRef`

Optional entry fields:

- `rank`
- `labels`
- `threadIndexFeed`

`threadIndexFeed`, if present, SHOULD be the stable feed-manifest `bzz://` URL for the curator's `threadIndex` of that top-level submission.

Optional top-level fields:

- `hidden`

## 8. `threadIndex`

```json
{
  "protocol": "freedom-board/thread-index/v1",
  "rootSubmissionId": "bzz://ROOT_SUBMISSION_REF",
  "curator": "0xCuratorA",
  "updatedAt": 1773792240000,
  "nodes": [
    {
      "submissionId": "bzz://ROOT_SUBMISSION_REF",
      "parentSubmissionId": null,
      "depth": 0
    },
    {
      "submissionId": "bzz://REPLY1_SUBMISSION_REF",
      "parentSubmissionId": "bzz://ROOT_SUBMISSION_REF",
      "depth": 1
    }
  ],
  "hidden": []
}
```

Required:

- `protocol`
- `rootSubmissionId`
- `curator`
- `updatedAt`
- `nodes`

Each node requires:

- `submissionId`
- `parentSubmissionId`
- `depth`

Optional top-level fields:

- `hidden`

## 9. `globalIndex`

```json
{
  "protocol": "freedom-board/global-index/v1",
  "curator": "0xCuratorA",
  "updatedAt": 1773792300000,
  "entries": [
    {
      "boardId": "tech",
      "submissionId": "bzz://SUB1_REF",
      "submissionRef": "bzz://SUB1_REF",
      "rank": 1
    }
  ]
}
```

Required:

- `protocol`
- `curator`
- `updatedAt`
- `entries`

Each entry requires:

- `boardId`
- `submissionId`
- `submissionRef`

Optional entry fields:

- `rank`

## 10. `curatorProfile`

```json
{
  "protocol": "freedom-board/curator/v1",
  "curator": "0xCuratorA",
  "name": "Chronological Curator",
  "description": "Spam-filtered chronological board views",
  "policyRef": "bzz://POLICY_REF",
  "globalIndexFeed": "bzz://GLOBAL_INDEX_FEED_MANIFEST_REF",
  "boardFeeds": {
    "tech": "bzz://TECH_BOARD_FEED_MANIFEST_REF"
  }
}
```

Required:

- `protocol`
- `curator`
- `name`
- `description`
- `globalIndexFeed`

Optional:

- `policyRef`
- `boardFeeds`

## 11. Implementation Notes

- these schema definitions are intended to become machine-readable JSON Schema later
- unknown future-compatible fields SHOULD be tolerated where safe
- feed-backed objects are still immutable Swarm objects at each versioned point in time; the feed only points to the latest immutable reference

## 12. Summary

These schemas provide the canonical object shapes for v1 implementation. The normative rules remain in [swarm-message-board-v1-spec.md](/Users/florian/Git/freedom-dev/freedom-browser/docs/swarm-message-board-v1-spec.md).
