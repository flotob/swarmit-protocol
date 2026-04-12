/**
 * Shared ASCII identifier validation used by both username and board-slug
 * helpers. Not part of the public API — consumers use the specific helpers
 * in usernames.js and slugs.js.
 *
 * Rules (common to all identifier types):
 *   - lowercase ASCII only: a-z, 0-9, -
 *   - no leading or trailing hyphen
 *   - no consecutive hyphens
 *
 * Length bounds are caller-specified.
 */

const INVALID_CHAR = /[^a-z0-9-]/;

/**
 * Validate an ASCII identifier string.
 *
 * @param {string} value - the candidate string
 * @param {number} minLength
 * @param {number} maxLength
 * @param {string} label - human-readable label for error messages (e.g. "username", "board slug")
 * @returns {string[]} array of error strings; empty = valid
 */
export function validateAsciiIdentifier(value, minLength, maxLength, label) {
  const errors = [];

  if (typeof value !== 'string') {
    errors.push(`${label} must be a string`);
    return errors;
  }

  if (value.length < minLength) {
    errors.push(`${label} must be at least ${minLength} characters`);
  }
  if (value.length > maxLength) {
    errors.push(`${label} must be at most ${maxLength} characters`);
  }

  const badChar = value.match(INVALID_CHAR);
  if (badChar) {
    errors.push(`invalid character '${badChar[0]}' at position ${badChar.index}`);
  }

  if (value.startsWith('-')) {
    errors.push(`${label} must not start with a hyphen`);
  }
  if (value.endsWith('-')) {
    errors.push(`${label} must not end with a hyphen`);
  }
  if (value.includes('--')) {
    errors.push(`${label} must not contain consecutive hyphens`);
  }

  return errors;
}
