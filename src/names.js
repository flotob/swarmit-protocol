/**
 * Deterministic fallback display names for wallet addresses.
 *
 * Every valid EVM address maps to exactly one human-readable label via
 * addressToFallbackName(). The output is stable, versioned, and requires
 * no network lookup — it's a pure function of the address.
 *
 * See: swarm-message-board-v1-fallback-names-patch.md
 */

import { id, getBytes } from 'ethers';

export const FALLBACK_NAME_VERSION = 'v1';

const ONSET = Object.freeze(['b', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z']);
const VOWEL = Object.freeze(['a', 'e', 'i', 'o']);
const CODA = Object.freeze(['', 'l', 'n', 'r', 's', 'm', 'k', 'th']);
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

/**
 * Bit reader over a Uint8Array, consuming bits left-to-right.
 */
class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.bitPos = 0;
  }

  read(n) {
    let value = 0;
    for (let i = 0; i < n; i++) {
      const byteIndex = (this.bitPos + i) >> 3;
      const bitIndex = 7 - ((this.bitPos + i) & 7);
      value = (value << 1) | ((this.bytes[byteIndex] >> bitIndex) & 1);
    }
    this.bitPos += n;
    return value;
  }
}

/**
 * Build one syllable from 9 bits: 4 onset + 2 vowel + 3 coda.
 */
function readSyllable(reader) {
  return ONSET[reader.read(4)] + VOWEL[reader.read(2)] + CODA[reader.read(3)];
}

/**
 * Build one word from 18 bits (two syllables).
 */
function readWord(reader) {
  return readSyllable(reader) + readSyllable(reader);
}

/**
 * Build a 5-character base32 tag from 25 bits.
 */
function readTag(reader) {
  let tag = '';
  for (let i = 0; i < 5; i++) {
    tag += BASE32[reader.read(5)];
  }
  return tag;
}

/**
 * Derive a deterministic human-readable fallback name for an EVM address.
 *
 * Output format: "<word1>-<word2>-<tag>" (lowercase ASCII).
 * The same address always produces the same name.
 *
 * @param {string} address - EVM address (0x-prefixed, 42 chars)
 * @returns {string} Fallback name like "fibo-kenth-x3q7r"
 */
export function addressToFallbackName(address) {
  if (!address || typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error('addressToFallbackName: invalid EVM address');
  }

  const normalized = address.slice(2).toLowerCase();
  const seed = getBytes(id('swarmit-fallback-name-v1:' + normalized));
  const reader = new BitReader(seed);

  const word1 = readWord(reader);
  const word2 = readWord(reader);
  const tag = readTag(reader);

  return `${word1}-${word2}#${tag}`;
}
