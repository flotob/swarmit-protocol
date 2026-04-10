/**
 * Calldata encoders for SwarmitUsernameRegistry write methods.
 *
 * Each encoder accepts human-form args and returns hex calldata.
 * The consumer wraps the result in a transaction with their own signer.
 */

import { iface } from './interface.js';

/**
 * Encode claim(name, maxPrice).
 * @param {Object} params
 * @param {string} params.name - validated username to claim
 * @param {bigint|string} params.maxPrice - max price in wei (slippage guard)
 * @returns {string} 0x-prefixed calldata hex
 */
function claim({ name, maxPrice }) {
  if (!name || typeof name !== 'string') {
    throw new Error('name is required');
  }
  if (maxPrice == null) {
    throw new Error('maxPrice is required');
  }
  return iface.encodeFunctionData('claim', [name, maxPrice]);
}

/**
 * Encode setPrimaryName(tokenId).
 * @param {Object} params
 * @param {number|bigint} params.tokenId - token ID to set as primary
 * @returns {string} 0x-prefixed calldata hex
 */
function setPrimaryName({ tokenId }) {
  if (tokenId == null) {
    throw new Error('tokenId is required');
  }
  return iface.encodeFunctionData('setPrimaryName', [tokenId]);
}

export const encode = {
  claim,
  setPrimaryName,
};
