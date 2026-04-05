# swarmit-protocol

Shared JavaScript implementation of the Swarmit (Swarm Message Board v1) protocol.

Single source of truth for:

- **Protocol object builders and validators** — the 9 object types defined by the [schema spec](https://github.com/flotob/swarmit/blob/main/docs/swarm-message-board-v1-schemas.md) (board, post, reply, submission, userFeedIndex, boardIndex, threadIndex, globalIndex, curatorProfile).
- **Reference helpers** — `bzz://` normalization, hex↔bytes32 conversion, slug→boardId hashing.
- **Contract ABI and calldata encoders** — the full public surface of [`SwarmitRegistryV2`](https://github.com/flotob/swarmit/blob/main/contracts/src/SwarmitRegistryV2.sol) and ergonomic `encode.*` wrappers for the 5 write methods.
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

## Keeping the library in sync with the contract

When `SwarmitRegistryV2.sol` changes:

1. Update `src/chain/abi.js` to match the new Solidity surface (events, writes, public getters).
2. If write method signatures change, update `src/chain/encode.js` to match.
3. Add or update golden tests in `test/chain/encode.test.js`.
4. Bump the version in `package.json`, tag, push.
5. Update consumers' `package.json` git-dep pin to the new tag.

This is a manual discipline — there is no cross-repo build coupling. The tradeoff is documented in the design plan.

## License

MIT
