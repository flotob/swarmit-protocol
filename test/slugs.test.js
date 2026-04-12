import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBoardSlugInput,
  isValidBoardSlug,
  validateBoardSlug,
} from '../src/slugs.js';

describe('normalizeBoardSlugInput', () => {
  it('trims whitespace', () => {
    assert.equal(normalizeBoardSlugInput('  tech  '), 'tech');
  });

  it('lowercases', () => {
    assert.equal(normalizeBoardSlugInput('Tech'), 'tech');
  });

  it('trims and lowercases', () => {
    assert.equal(normalizeBoardSlugInput('  My-Board  '), 'my-board');
  });

  it('returns empty string for non-string input', () => {
    assert.equal(normalizeBoardSlugInput(null), '');
    assert.equal(normalizeBoardSlugInput(42), '');
  });
});

describe('validateBoardSlug', () => {
  it('accepts simple slug', () => {
    assert.deepEqual(validateBoardSlug('tech'), []);
  });

  it('accepts single character', () => {
    assert.deepEqual(validateBoardSlug('a'), []);
  });

  it('accepts max length (32)', () => {
    assert.deepEqual(validateBoardSlug('a'.repeat(32)), []);
  });

  it('accepts slug with digits', () => {
    assert.deepEqual(validateBoardSlug('board123'), []);
  });

  it('accepts slug with hyphens', () => {
    assert.deepEqual(validateBoardSlug('my-board'), []);
  });

  it('rejects empty', () => {
    const errors = validateBoardSlug('');
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('at least 1'));
  });

  it('rejects too long', () => {
    const errors = validateBoardSlug('a'.repeat(33));
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('at most 32'));
  });

  it('rejects uppercase', () => {
    const errors = validateBoardSlug('Tech');
    assert.ok(errors.some(e => e.includes('invalid character')));
  });

  it('rejects underscores', () => {
    const errors = validateBoardSlug('my_board');
    assert.ok(errors.some(e => e.includes('invalid character')));
  });

  it('rejects leading hyphen', () => {
    const errors = validateBoardSlug('-tech');
    assert.ok(errors.some(e => e.includes('start with a hyphen')));
  });

  it('rejects trailing hyphen', () => {
    const errors = validateBoardSlug('tech-');
    assert.ok(errors.some(e => e.includes('end with a hyphen')));
  });

  it('rejects consecutive hyphens', () => {
    const errors = validateBoardSlug('my--board');
    assert.ok(errors.some(e => e.includes('consecutive hyphens')));
  });

  it('rejects non-string', () => {
    const errors = validateBoardSlug(123);
    assert.ok(errors.some(e => e.includes('must be a string')));
  });
});

describe('isValidBoardSlug', () => {
  it('delegates to validateBoardSlug', () => {
    assert.ok(isValidBoardSlug('tech'));
    assert.ok(!isValidBoardSlug('Tech'));
  });
});
