import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addressToFallbackName, FALLBACK_NAME_VERSION } from '../src/index.js';

// Golden fixtures — fixed address → fixed name.
// If the algorithm changes, these break. That's the point.
// Regenerate only on an intentional algorithm change.
const GOLDEN = [
  { address: '0x0000000000000000000000000000000000000000', name: 'honhath-vapim#3rxv7' },
  { address: '0x0000000000000000000000000000000000000001', name: 'miljem-gothnil#f2ucc' },
  { address: '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf', name: 'lekni-jalfam#pl4lg' },
  { address: '0xbF5Ac1f40d966E0cfF13f8E11d6f079fDc6EDa48', name: 'zortil-vathvis#4kuyw' },
  { address: '0x185479B283475854F6585fFD5393970fDDB5eCaf', name: 'nepan-fethgam#ngz33' },
  { address: '0xdead000000000000000000000000000000000000', name: 'sasdos-malko#z6k5y' },
];

describe('FALLBACK_NAME_VERSION', () => {
  it('equals v1', () => {
    assert.equal(FALLBACK_NAME_VERSION, 'v1');
  });
});

describe('addressToFallbackName', () => {
  // Golden tests — algorithm stability
  for (const { address, name } of GOLDEN) {
    it(`${address.slice(0, 10)}… → ${name}`, () => {
      assert.equal(addressToFallbackName(address), name);
    });
  }

  // Determinism
  it('same address always produces the same name', () => {
    const addr = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';
    assert.equal(addressToFallbackName(addr), addressToFallbackName(addr));
  });

  // Case insensitivity (addresses are case-insensitive in Ethereum)
  it('different casing of the same address produces the same name', () => {
    const lower = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';
    const mixed = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';
    assert.equal(addressToFallbackName(lower), addressToFallbackName(mixed));
  });

  // Different addresses produce different names
  it('different addresses produce different names', () => {
    const names = GOLDEN.map(g => g.name);
    const unique = new Set(names);
    assert.equal(unique.size, names.length);
  });

  // Output format: <word>-<word>#<tag>
  it('output matches <word>-<word>#<tag> format', () => {
    const name = addressToFallbackName('0x0000000000000000000000000000000000000000');
    const [words, tag] = name.split('#');
    assert.ok(tag, 'should have a # separator');
    assert.equal(tag.length, 5, 'tag should be exactly 5 chars');
    const [w1, w2] = words.split('-');
    assert.ok(w1.length >= 2, 'word1 should be at least 2 chars');
    assert.ok(w2.length >= 2, 'word2 should be at least 2 chars');
  });

  // Output is lowercase ASCII
  it('output is lowercase ASCII only', () => {
    for (const { address } of GOLDEN) {
      const name = addressToFallbackName(address);
      assert.ok(/^[a-z0-9#-]+$/.test(name), `${name} should be lowercase ASCII + digits + hyphens + #`);
    }
  });

  // Error cases
  it('throws on invalid address (too short)', () => {
    assert.throws(() => addressToFallbackName('0x1234'), /invalid EVM address/);
  });

  it('throws on invalid address (no 0x prefix)', () => {
    assert.throws(() => addressToFallbackName('7E5F4552091A69125d5DfCb7b8C2659029395Bdf'), /invalid EVM address/);
  });

  it('throws on null', () => {
    assert.throws(() => addressToFallbackName(null), /invalid EVM address/);
  });

  it('throws on non-hex characters', () => {
    assert.throws(() => addressToFallbackName('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'), /invalid EVM address/);
  });
});
