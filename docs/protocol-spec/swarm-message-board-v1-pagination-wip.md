# Swarm Message Board v1 Pagination WIP

Date: 2026-04-02
Status: Work in progress

## Purpose

This note captures an unfinished protocol/design discussion about scaling Swarmit when boards, global feeds, and threads become very large.

It is not a patch proposal yet.

## Current Situation

Today the main mutable view objects are feed-backed objects containing full arrays:

- `userFeedIndex.entries`
- `boardIndex.entries`
- `globalIndex.entries`
- `threadIndex.nodes`

In the current reference implementation, curators materialize those arrays in memory, publish a new immutable JSON object, and repoint the feed to the latest version.

At small scale this is fine.

At large scale this becomes expensive because:

- index objects become large
- every update republishes large arrays
- clients fetch large objects even when they only need the first visible slice
- thread discovery currently depends on the root post still being discoverable from the active board view

## Main Observation

The current protocol is conceptually compatible with bounded head views, but it does not yet define real pagination.

There is an important difference between:

- publishing only the latest/top N entries
- defining how clients fetch page 2, page 3, older slices, or deeper thread slices

The first is already possible as curator behavior.
The second needs protocol design.

## Likely Direction

The strongest current direction is cursor/page-reference pagination rather than offset pagination.

High-level idea:

- a feed points to a head page
- that head page contains the first N entries
- the page may include a `nextPageRef` to an older immutable page
- clients paginate by following page references

This seems especially natural for:

- chronological board views
- chronological global views
- author history (`userFeedIndex`)

## Important Caveat

Ranked views such as:

- `best`
- `hot`
- `rising`
- `controversial`

are harder to paginate deeply because the ranking can change as votes change.

So pagination likely needs to distinguish between:

- chronological pagination, which should be first-class
- ranked pagination, which may initially be limited to top windows rather than arbitrary deep paging

## Thread-Specific Problem

Threads are not just flat pagination.

For very large threads, likely future needs include:

- loading more replies
- loading more children under a given node
- loading tree slices rather than a single monolithic `threadIndex.nodes` array

Also, direct thread loading should not permanently depend on the root post still appearing in the currently visible board head page.

## Current Tentative Conclusions

1. The current protocol/index objects are MVP-scale, not internet-scale.
2. The main scaling bottleneck is in mutable curator indexes, not immutable content objects themselves.
3. Real pagination should probably be added as a new protocol patch after the current multi-view work.
4. Chronological pagination should come before deep ranked pagination.
5. Thread discovery and thread pagination should be treated as related but separate design problems.

## Questions To Revisit

1. Should pagination be defined as:
   - `nextPageRef` chains
   - bidirectional cursor pages
   - feed-per-page windows
2. Should `boardIndex` / `globalIndex` gain paged variants, or should pagination be encoded inside the existing object families?
3. How should a client resolve a thread route if the root post is no longer present in the visible board head page?
4. Should ranked views support deep pagination at all in v1.x, or only bounded top windows?
5. What is the clean equivalent of pagination for very large reply trees?

## Suggested Next Step

When revisiting this topic, the next useful artifact would be a real patch proposal for:

- paginated chronological board/global/user feeds
- thread-discovery resilience independent of board head visibility
- explicit non-goals for deep ranked pagination in the first pass
