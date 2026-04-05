/**
 * Chain subpath — ABI, ethers Interface, event topic hashes, and calldata encoders.
 *
 * The library stops here on the chain side: it does NOT provide polling,
 * confirmation handling, providers, or signers. Consumers bring their own
 * `JsonRpcProvider.getLogs` loop and their own signer (ethers.Wallet,
 * injected wallet, WalletConnect, etc.) and use `encode.*` + `iface`
 * + `TOPICS` to compose them.
 */

export { ABI } from './abi.js';
export { iface, TOPICS, BYTES32_ZERO } from './interface.js';
export { encode } from './encode.js';

/**
 * Named constants for setVote direction. The contract takes int8; consumers
 * can use either the numeric literals or these constants interchangeably.
 */
export const VOTE = Object.freeze({ UP: 1, CLEAR: 0, DOWN: -1 });
