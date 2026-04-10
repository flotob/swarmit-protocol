import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUsernameInput,
  isValidUsername,
  validateUsername,
  usernameHash,
} from '../src/usernames.js';
import { id } from 'ethers';

// ============================================
// normalizeUsernameInput
// ============================================

describe('normalizeUsernameInput', () => {
  it('trims whitespace', () => {
    assert.equal(normalizeUsernameInput('  alice  '), 'alice');
  });

  it('lowercases', () => {
    assert.equal(normalizeUsernameInput('Alice'), 'alice');
  });

  it('trims and lowercases', () => {
    assert.equal(normalizeUsernameInput('  BoB  '), 'bob');
  });

  it('returns empty string for non-string input', () => {
    assert.equal(normalizeUsernameInput(null), '');
    assert.equal(normalizeUsernameInput(undefined), '');
    assert.equal(normalizeUsernameInput(42), '');
  });

  it('passes through already-normalized input', () => {
    assert.equal(normalizeUsernameInput('alice'), 'alice');
  });
});

// ============================================
// validateUsername
// ============================================

describe('validateUsername', () => {
  it('accepts valid simple name', () => {
    assert.deepEqual(validateUsername('alice'), []);
  });

  it('accepts valid name with digits', () => {
    assert.deepEqual(validateUsername('user123'), []);
  });

  it('accepts valid name with hyphens', () => {
    assert.deepEqual(validateUsername('cool-name'), []);
  });

  it('accepts minimum length (3)', () => {
    assert.deepEqual(validateUsername('abc'), []);
  });

  it('accepts maximum length (24)', () => {
    assert.deepEqual(validateUsername('abcdefghijklmnopqrstuvwx'), []);
  });

  it('rejects too short', () => {
    const errors = validateUsername('ab');
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('at least 3'));
  });

  it('rejects too long', () => {
    const errors = validateUsername('abcdefghijklmnopqrstuvwxy');
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('at most 24'));
  });

  it('rejects uppercase', () => {
    const errors = validateUsername('Alice');
    assert.ok(errors.length > 0);
    assert.ok(errors.some(e => e.includes('invalid character')));
  });

  it('rejects underscores', () => {
    const errors = validateUsername('al_ice');
    assert.ok(errors.length > 0);
  });

  it('rejects spaces', () => {
    const errors = validateUsername('al ice');
    assert.ok(errors.length > 0);
  });

  it('rejects leading hyphen', () => {
    const errors = validateUsername('-alice');
    assert.ok(errors.some(e => e.includes('start with a hyphen')));
  });

  it('rejects trailing hyphen', () => {
    const errors = validateUsername('alice-');
    assert.ok(errors.some(e => e.includes('end with a hyphen')));
  });

  it('rejects consecutive hyphens', () => {
    const errors = validateUsername('al--ice');
    assert.ok(errors.some(e => e.includes('consecutive hyphens')));
  });

  it('rejects non-string', () => {
    const errors = validateUsername(123);
    assert.ok(errors.some(e => e.includes('must be a string')));
  });
});

// ============================================
// isValidUsername
// ============================================

describe('isValidUsername', () => {
  it('delegates to validateUsername', () => {
    assert.ok(isValidUsername('alice'));
    assert.ok(!isValidUsername('Alice'));
  });
});

// ============================================
// usernameHash
// ============================================

describe('usernameHash', () => {
  // Golden value — keccak256("alice") as UTF-8 bytes.
  // Must match on-chain `keccak256(bytes(name))` exactly.
  const ALICE_HASH = '0x9c0257114eb9399a2985f8e75dad7600c5d89fe3824ffa99ec1c3eb8bf3b0501';

  it('matches on-chain keccak256(bytes(name))', () => {
    assert.equal(usernameHash('alice'), ALICE_HASH);
    assert.equal(usernameHash('alice'), id('alice'));
  });

  it('returns 0x-prefixed 32-byte hex', () => {
    const hash = usernameHash('alice');
    assert.ok(hash.startsWith('0x'));
    assert.equal(hash.length, 66);
  });

  it('different names produce different hashes', () => {
    assert.notEqual(usernameHash('alice'), usernameHash('bob'));
  });
});
