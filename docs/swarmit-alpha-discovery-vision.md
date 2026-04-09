# Swarmit Alpha Discovery Vision

Date: 2026-04-04
Status: Discussion memo for builder planning

## Why This Exists

As Swarmit gets closer to its first public alpha, the protocol and the default app experience need to be separated more clearly.

Right now, the system tends to treat:

- everything registered on-chain
- everything declared on-chain

as if it should automatically appear in the main product surfaces.

That is useful during development, but it is not a coherent alpha model.

## The Core Distinction

Swarmit has at least three different layers that should not be conflated:

### 1. Protocol namespace

This is the open, permissionless layer.

Examples:

- `BoardRegistered`
- `CuratorDeclared`
- `SubmissionAnnounced`
- `VoteSet`

This layer is about:

- addressability
- public coordination
- global discoverability in principle

It is not, by itself, the right default product surface.

### 2. Default app discovery

This is what a new user sees by default when they open Swarmit.

This should be:

- curated
- coherent
- resistant to spam
- aligned with the feed they are actually looking at

### 3. User-customized discovery

This is what the user intentionally adds or pins.

Examples:

- a board added by slug
- a curator added by address
- pinned boards
- per-board curator preferences

This layer gives the user freedom without forcing the default app to surface everything.

## Product Direction For Alpha

The alpha should keep the protocol open while making the default app experience curated and intentional.

In plain terms:

- registration can remain permissionless
- declaration can remain permissionless
- the app should stop auto-featuring everything registered or declared on-chain

## Boards: The Proposed Model

### What should not happen by default

The top board bar should not be sourced from:

- every `BoardRegistered` event ever emitted

That creates four problems:

- poor scaling
- spam exposure
- liability exposure
- conceptual mismatch with the actual feed below

### What should happen instead

The default board bar should come from:

- the selected/default curator's `boardFeeds`
- plus optional user-pinned boards

This makes the board list correspond much more closely to the feed the user is actually looking at.

If the user is browsing the `Chronological Curator`, they should see the boards that curator actually curates.

That is much more coherent than mixing:

- one list derived from all chain registrations
- one feed derived from a specific curator

### User freedom

This model still preserves openness:

- any user can add a board by slug
- any board can still exist in the protocol
- the app just does not have to feature every board by default

### Optional endorsed board list

If we want a "starter set" of boards for alpha, that should be treated as an app/discovery layer, not a protocol invariant.

For alpha, the best options are:

- hardcoded app config
- or a small Swarm-hosted app config

Not recommended for alpha:

- on-chain DAO-curated featured-board registry

That is possible later, but it is heavier governance/product machinery than alpha needs.

## Curators: The Proposed Model

### What should not happen by default

The default curator picker should not simply list:

- every `CuratorDeclared` address on-chain

That has the same problems as boards:

- spam
- low trust
- legal/reputation risk
- confusing defaults

### What should happen instead

The default curator picker should be composed from:

- app-endorsed curators
- board-endorsed/default curators
- optionally user-added curators

This still leaves the protocol open, but keeps the default product experience sane.

### User freedom

Users should still be able to:

- add a curator by address
- choose that curator for global or per-board use

Again, openness is preserved without making the default app surface unfiltered.

## Scaling Reality

### Boards today

Today the SPA can ask the RPC for all `BoardRegistered` logs since deploy block and then resolve board metadata one by one.

That is acceptable for development.

It is not a scalable alpha default if the board count grows very large.

Practical limits are:

- RPC response size
- RPC timeouts
- browser memory
- the fan-out of metadata fetches from Swarm

### Curators today

The same is true for `CuratorDeclared`.

It is usable for a tiny ecosystem.

It is not the right long-term default UX.

### The alpha answer

Do not solve this with contract changes first.

Solve it by changing what the SPA treats as its default discovery source.

In other words:

- direct lookup remains open
- default app lists become curated

## Registration Economics

### Boards

Charging for board registration is not the first thing needed for alpha.

Why:

- most of the immediate problem is default app surfacing, not protocol openness
- removing "all boards are featured" from the UI already reduces the spam problem significantly

There is still a real future question around:

- namespace squatting

But that can be handled later.

### Curators

Same conclusion:

- do not add declaration costs just to compensate for a UI surfacing problem

First fix the discovery model.

## Recommended Alpha UX Model

### Default boards

Show:

- boards covered by the current default curator
- optionally user-pinned boards

### Default feed

Show:

- the feed produced by that curator

These two surfaces should correspond.

### Default curators

Show:

- a small endorsed set
- plus board-endorsed/default curators where relevant

### Advanced actions

Allow:

- add board by slug
- add curator by address

These are explicit user actions, not default ambient discovery.

## What This Preserves

This model preserves everything good about the protocol:

- anyone can still register a board
- anyone can still declare a curator
- users can still directly navigate to or add open resources
- curators can still differentiate discovery and ranking

It simply stops pretending that "permissionless existence" should equal "default product featuring."

## Concrete Alpha Direction

For alpha, the simplest coherent policy is:

- keep board registration permissionless and free
- keep curator declaration permissionless and free
- top board bar comes from curator coverage, not all chain-registered boards
- default curator picker comes from endorsed/default curators, not all declared curators
- users can add boards by slug
- users can add curators by address
- chain-wide enumeration becomes an advanced or deferred surface, not the main UX

## Discussion Questions For Planning

Before implementation, the main questions to settle are:

1. Is the top board bar sourced only from the selected curator, or from an app-level default curator plus user pins?
2. Do we want an app-endorsed board starter set in addition to curator coverage?
3. How should user-pinned boards be stored and merged into the board bar?
4. What should the default curator picker contain in the first alpha build?
5. Do we expose an advanced "browse all boards" or "browse all curators" route now, or explicitly defer it?
6. Do we want any NSFW / safety filtering in default discovery for alpha?

## Recommended Sequencing

1. Align on the discovery model in product terms.
2. Decide the alpha default curator and endorsed curator set.
3. Decide whether the board bar is curator-derived only or curator-derived plus app starter set.
4. Add user-managed boards and user-managed curators.
5. Only then reconsider whether any contract-level economics are needed.
