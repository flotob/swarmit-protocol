# swarmit-protocol

Shared JavaScript implementation of the Swarmit (Swarm Message Board v1) protocol.

Single source of truth for:

- **Protocol object builders and validators** — the 9 object types defined by the [schema spec](https://github.com/flotob/swarmit/blob/main/docs/swarm-message-board-v1-schemas.md) (board, post, reply, submission, userFeedIndex, boardIndex, threadIndex, globalIndex, curatorProfile).
- **Reference helpers** — `bzz://` normalization, hex↔bytes32 conversion, slug→boardId hashing.
- **Contract ABI and calldata encoders** — the full public surface of [`SwarmitRegistryV2`](./contracts/src/SwarmitRegistryV2.sol) and ergonomic `encode.*` wrappers for the 5 write methods.
- **Node Bee client (optional)** — `createBeeClient` factory wrapping `@ethersphere/bee-js` for read + publish + feed operations. Only needed by Node consumers that write to Swarm.

## Consumers

- [`swarmit`](https://github.com/flotob/swarmit) — Vue web app, reference user client.
- [`swarmit-curator`](https://github.com/flotob/swarmit-curator) — Node curator service.
- [`swarmit-dashboard`](https://github.com/flotob/swarmit-dashboard) — Next.js ops dashboard.
- [`swarmit-bot`](https://github.com/flotob/swarmit-bot) — RSS-to-Swarmit bridge (upcoming).

## Design plan and roadmap

- Design plan: [`swarmit/docs/swarmit-protocol-plan.md`](https://github.com/flotob/swarmit/blob/main/docs/swarmit-protocol-plan.md)
- Execution roadmap: [`ROADMAP.md`](./ROADMAP.md)

## Subpath exports

```js
import { validate, buildPost, slugToBoardId, TYPES } from 'swarmit-protocol';
import { iface, TOPICS, encode, BYTES32_ZERO } from 'swarmit-protocol/chain';
import { createBeeClient } from 'swarmit-protocol/swarm';         // requires @ethersphere/bee-js peer dep
```

## Contracts

The Solidity contracts live in [`contracts/`](./contracts) as a Foundry project. Co-located with the JS library so a single commit can change the contract, update the ABI, update the encoders, and bump the version atomically.

- `contracts/src/SwarmitRegistryV2.sol` — the canonical v2 registry contract (5 events, 5 write methods, 7 public state getters)
- `contracts/test/` — Foundry tests
- `contracts/script/` — deploy scripts
- `contracts/lib/forge-std` — vendored, not a git submodule (no `--recurse-submodules` needed)

Contract development requires [Foundry](https://getfoundry.sh/). JS consumers installing via `npm` / git dep don't pull the `contracts/` directory — the `files` allowlist in `package.json` excludes it.

## Keeping the library in sync with the contract

When `contracts/src/SwarmitRegistryV2.sol` changes:

1. Update `src/chain/abi.js` to match the new Solidity surface (events, writes, public getters).
2. If write method signatures change, update `src/chain/encode.js` to match.
3. Add or update golden tests in `test/chain/encode.test.js`.
4. Bump the version in `package.json`, tag, push.
5. Update consumers' `package.json` git-dep pin to the new tag.

This is a manual discipline — the ABI in `src/chain/abi.js` is hand-maintained rather than generated from `contracts/out/`. Rationale in the [design plan](https://github.com/flotob/swarmit/blob/main/docs/swarmit-protocol-plan.md).

## License

MIT
