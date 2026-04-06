# Swarm Message Board v1 Link Posts Patch

Date: 2026-03-26
Status: Draft patch proposal

## Purpose

This document proposes a small v1 protocol extension to support first-class link posts and cleaner media posts without introducing a separate post object type.

The intent is to support three top-level post variants:

- text post
- media post
- external link post

This patch does not change the contract surface.

This patch does not add "post to profile" as a destination. In v1, top-level submissions remain board-targeted.

## Summary of Changes

1. Add optional `link` to `post`
2. Make `body` optional on `post`
3. Change post validation from:
   - `body` is always required
   to:
   - a post MUST contain at least one of:
     - `body`
     - `link`
     - `attachments`
4. Keep `reply` unchanged
5. Keep `submission` unchanged
6. Keep attachments for Swarm-hosted media/files; use `link` for external URLs

## Rationale

The current v1 `post` object works well for text posts and already supports Swarm-hosted media through `attachments`, but it does not cleanly express a top-level post whose primary payload is an external URL.

Adding an explicit `link` field is cleaner than:

- forcing external URLs into markdown body text
- overloading `attachments` with non-Swarm external URLs
- or creating a separate `linkPost` object type

This preserves a single top-level `post` object while allowing the client UI to offer distinct "text", "image/video", and "link" creation flows.

## Normative Patch for `swarm-message-board-v1-spec.md`

### Replace Section 7.2 `post` with the following

```md
### 7.2 `post`

Purpose:

- immutable top-level content payload

Storage:

- immutable Swarm object

Required fields:

- `protocol`
- `author`
- `title`
- `createdAt`

Optional fields:

- `body`
- `link`
- `attachments`

Content rule:

- A `post` MUST include at least one of:
  - `body`
  - `link`
  - one or more `attachments`

Body semantics:

- If `body` is present:
  - `body.kind` MUST currently be `"markdown"`
  - `body.text` MUST be a non-empty string

Link semantics:

- If `link` is present:
  - `link.url` is required
  - `link.url` MUST be an absolute `http://` or `https://` URL
- `link` is for external link targets
- `link` is distinct from `attachments`
- `link` MAY optionally include captured preview hints:
  - `title`
  - `description`
  - `siteName`
  - `thumbnailRef`
- `thumbnailRef`, if present, MUST be a `bzz://` Swarm reference to immutable thumbnail content

Attachment descriptor v1 schema:

- `reference` (required) — `bzz://` Swarm reference to separately published immutable attachment content
- `contentType` (required)
- `name` (optional)
- `sizeBytes` (optional)
- `kind` (optional)
- `caption` (optional)
- `altText` (optional)

`kind` is a UI hint, not the canonical technical type. Clients SHOULD tolerate unknown values.

Recommended v1 vocabulary:

- `image`
- `video`
- `audio`
- `file`
- `link`

Interpretation guidance:

- Use `attachments` for Swarm-hosted media or files that are part of the post payload
- Use `link` when the post's primary target is an external URL
- A post MAY include both `link` and `body`
- A post MAY include both `attachments` and `body`
- A post MAY include `link`, `attachments`, and `body` together

Example: text post

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
  "createdAt": 1773792000000
}
```

Example: media post

```json
{
  "protocol": "freedom-board/post/v1",
  "author": {
    "address": "0xAuthor",
    "userFeed": "bzz://USER_FEED_MANIFEST_REF"
  },
  "title": "Look at this",
  "attachments": [
    {
      "reference": "bzz://IMAGE_REF",
      "contentType": "image/webp",
      "kind": "image",
      "altText": "A colorful image"
    }
  ],
  "createdAt": 1773792000000
}
```

Example: link post

```json
{
  "protocol": "freedom-board/post/v1",
  "author": {
    "address": "0xAuthor",
    "userFeed": "bzz://USER_FEED_MANIFEST_REF"
  },
  "title": "Interesting article",
  "link": {
    "url": "https://example.com/article",
    "title": "Interesting article",
    "description": "A short captured summary",
    "siteName": "Example",
    "thumbnailRef": "bzz://THUMBNAIL_REF"
  },
  "createdAt": 1773792000000
}
```
```

## Normative Patch for `swarm-message-board-v1-schemas.md`

### Replace Section 3 `post` with the following

```md
## 3. `post`

```json
{
  "protocol": "freedom-board/post/v1",
  "author": {
    "address": "0xAuthor",
    "userFeed": "bzz://USER_FEED_MANIFEST_REF"
  },
  "title": "Interesting article",
  "link": {
    "url": "https://example.com/article",
    "title": "Interesting article",
    "description": "A short captured summary",
    "siteName": "Example",
    "thumbnailRef": "bzz://THUMBNAIL_REF"
  },
  "createdAt": 1773792000000
}
```

Required:

- `protocol`
- `author`
- `title`
- `createdAt`

Optional:

- `body`
- `link`
- `attachments`

Constraints:

- at least one of `body`, `link`, or `attachments` MUST be present
- if `body` is present:
  - `body.kind` MUST be `"markdown"`
  - `body.text` MUST be a non-empty string
- if `link` is present:
  - `link.url` is required
  - `link.url` MUST be an absolute `http://` or `https://` URL
- if `link.thumbnailRef` is present, it MUST be a `bzz://` Swarm reference
```

## Validator / Builder Implications

The protocol object builder and validator should change as follows:

- `buildPost(...)`
  - accept optional `link`
  - accept optional `attachments`
  - accept optional `body`

- `validatePost(...)`
  - require:
    - `protocol`
    - `author`
    - `title`
    - `createdAt`
  - allow optional `body`
  - allow optional `link`
  - allow optional `attachments`
  - enforce:
    - at least one of `body`, `link`, or `attachments`
    - `body.text` non-empty if `body` exists
    - `link.url` absolute `http://` or `https://` if `link` exists
    - `link.thumbnailRef` valid normalized `bzz://` ref if present

## Client Implementation Guidance

This patch enables three submit flows without adding separate protocol objects:

- Text post:
  - `title` + markdown `body`

- Media post:
  - `title` + one or more `attachments`
  - optional markdown `body`

- Link post:
  - `title` + `link.url`
  - optional markdown `body`
  - optional captured preview hints in `link`

Recommended UI mapping:

- "Text" tab:
  - title
  - text

- "Image/Video" tab:
  - title
  - uploaded Swarm media
  - optional text

- "Link" tab:
  - external URL
  - title
  - optional text

## Explicit Non-Goals of This Patch

This patch does not add:

- reply attachments
- profile-destination posts
- live remote unfurl fetching requirements
- automatic metadata scraping rules
- new on-chain events

## Backward Compatibility

This patch is backward compatible with existing text-only posts:

- all existing valid posts remain valid
- old clients may ignore `link`
- new clients SHOULD gracefully render posts that only contain:
  - `body`
  - `attachments`
  - `link`
  - or any allowed combination

## Recommendation

If adopted, this patch should be merged into:

- `docs/swarm-message-board-v1-spec.md`
- `docs/swarm-message-board-v1-schemas.md`
- `src/protocol/objects.js`

No contract changes are required.
