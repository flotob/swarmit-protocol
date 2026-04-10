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

const MIN_LENGTH = 3;
const MAX_LENGTH = 24;
const INVALID_CHAR = /[^a-z0-9-]/;

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
  const errors = [];

  if (typeof name !== 'string') {
    errors.push('username must be a string');
    return errors;
  }

  if (name.length < MIN_LENGTH) {
    errors.push(`username must be at least ${MIN_LENGTH} characters`);
  }
  if (name.length > MAX_LENGTH) {
    errors.push(`username must be at most ${MAX_LENGTH} characters`);
  }

  const badChar = name.match(INVALID_CHAR);
  if (badChar) {
    errors.push(`invalid character '${badChar[0]}' at position ${badChar.index}`);
  }

  if (name.startsWith('-')) {
    errors.push('username must not start with a hyphen');
  }
  if (name.endsWith('-')) {
    errors.push('username must not end with a hyphen');
  }
  if (name.includes('--')) {
    errors.push('username must not contain consecutive hyphens');
  }

  return errors;
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
