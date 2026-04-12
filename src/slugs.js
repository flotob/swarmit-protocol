/**
 * Pure board-slug validation and normalization helpers for the Swarmit
 * Registry.
 *
 * These are client-side utilities — they do NOT perform on-chain lookups.
 * The V3 contract enforces the same rules, so slugs validated here will
 * pass on-chain validation (and vice-versa).
 *
 * Rules:
 *   - length: 1..32
 *   - lowercase ASCII only: a-z, 0-9, -
 *   - no leading or trailing hyphen
 *   - no consecutive hyphens
 */

import { validateAsciiIdentifier } from './_validation.js';

/**
 * Trim whitespace and lowercase a raw user input string.
 * Convenience pre-processing for UI text fields.
 *
 * @param {string} raw
 * @returns {string}
 */
export function normalizeBoardSlugInput(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

/**
 * Return an array of human-readable error strings.
 * Empty array = valid.
 *
 * @param {string} slug - already-normalized slug candidate
 * @returns {string[]}
 */
export function validateBoardSlug(slug) {
  return validateAsciiIdentifier(slug, 1, 32, 'board slug');
}

/**
 * Boolean convenience wrapper around validateBoardSlug.
 *
 * @param {string} slug
 * @returns {boolean}
 */
export function isValidBoardSlug(slug) {
  return validateBoardSlug(slug).length === 0;
}
