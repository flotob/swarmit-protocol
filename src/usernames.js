/**
 * Pure username validation and normalization helpers for the Swarmit
 * Username Registry.
 *
 * These are client-side utilities — they do NOT perform on-chain lookups.
 * The contract enforces the same rules, so names validated here will pass
 * on-chain validation (and vice-versa).
 *
 * Rules:
 *   - length: 3..24
 *   - lowercase ASCII only: a-z, 0-9, -
 *   - no leading or trailing hyphen
 *   - no consecutive hyphens
 */

import { id } from 'ethers';
import { validateAsciiIdentifier } from './_validation.js';

/**
 * Trim whitespace and lowercase a raw user input string.
 * Convenience pre-processing for UI text fields.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeUsernameInput(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

/**
 * Return an array of human-readable error strings.
 * Empty array = valid.
 *
 * @param {string} name - already-normalized username candidate
 * @returns {string[]}
 */
export function validateUsername(name) {
  return validateAsciiIdentifier(name, 3, 24, 'username');
}

/**
 * Boolean convenience wrapper around validateUsername.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isValidUsername(name) {
  return validateUsername(name).length === 0;
}

/**
 * Compute the keccak256 hash of a username, matching the on-chain
 * `keccak256(bytes(name))` used by the contract.
 *
 * @param {string} name - a valid username (not validated here)
 * @returns {string} 0x-prefixed 32-byte hex hash
 */
export function usernameHash(name) {
  return id(name);
}
