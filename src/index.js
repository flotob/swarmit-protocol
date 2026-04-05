/**
 * swarmit-protocol — root export.
 *
 * Pure protocol surface (no I/O, no chain RPC, no Swarm HTTP):
 *   - Object builders and validators
 *   - Reference helpers (bzz://, hex, bytes32, slug→boardId)
 *   - The TYPES enum
 *
 * For chain encoding (ABI, Interface, calldata encoders) use `swarmit-protocol/chain`.
 * For the Node Bee client (bee-js wrapper) use `swarmit-protocol/swarm`.
 */

// Objects (builders + validators + constants)
export * from './objects/index.js';

// Reference helpers
export * from './references.js';
