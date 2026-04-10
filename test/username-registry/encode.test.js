import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ABI, iface, TOPICS, encode } from '../../src/username-registry/index.js';

// ============================================
// ABI + Interface
// ============================================

describe('Username registry ABI + Interface', () => {
  it('has the expected number of fragments', () => {
    // 3 events + 2 writes + 10 views = 15
    assert.equal(ABI.length, 15);
    assert.equal(iface.fragments.length, 15);
  });

  it('can look up claim write method', () => {
    const fn = iface.getFunction('claim');
    assert.ok(fn);
    assert.equal(fn.inputs.length, 2); // name, maxPrice
  });

  it('can look up setPrimaryName write method', () => {
    const fn = iface.getFunction('setPrimaryName');
    assert.ok(fn);
    assert.equal(fn.inputs.length, 1);
  });

  it('can look up primaryNameOf view', () => {
    const fn = iface.getFunction('primaryNameOf');
    assert.ok(fn);
  });

  it('can look up currentMintPrice view', () => {
    const fn = iface.getFunction('currentMintPrice');
    assert.ok(fn);
  });

  it('can look up isAvailable view', () => {
    const fn = iface.getFunction('isAvailable');
    assert.ok(fn);
  });
});

// ============================================
// Event topics
// ============================================

describe('Username registry TOPICS', () => {
  it('has 3 event topic hashes', () => {
    assert.equal(Object.keys(TOPICS).length, 3);
  });

  it('all topic hashes are 0x + 64 hex', () => {
    for (const [name, topic] of Object.entries(TOPICS)) {
      assert.ok(topic.startsWith('0x'), `${name} should start with 0x`);
      assert.equal(topic.length, 66, `${name} should be 66 chars`);
    }
  });

  it('topic hashes are distinct', () => {
    const topics = Object.values(TOPICS);
    assert.equal(new Set(topics).size, topics.length);
  });
});

// ============================================
// encode.claim
// ============================================

describe('encode.claim', () => {
  it('returns 0x-prefixed hex calldata', () => {
    const data = encode.claim({ name: 'alice', maxPrice: 1000000000000000n });
    assert.ok(data.startsWith('0x'));
    assert.ok(data.length > 10);
  });

  it('golden calldata is stable', () => {
    const data = encode.claim({ name: 'alice', maxPrice: 1000000000000000n });
    // Re-encoding the same input must produce identical output
    const data2 = encode.claim({ name: 'alice', maxPrice: 1000000000000000n });
    assert.equal(data, data2);
  });

  it('different names produce different calldata', () => {
    const a = encode.claim({ name: 'alice', maxPrice: 1000000000000000n });
    const b = encode.claim({ name: 'bob', maxPrice: 1000000000000000n });
    assert.notEqual(a, b);
  });

  it('different maxPrice produces different calldata', () => {
    const a = encode.claim({ name: 'alice', maxPrice: 1000000000000000n });
    const b = encode.claim({ name: 'alice', maxPrice: 2000000000000000n });
    assert.notEqual(a, b);
  });

  it('can be decoded back via iface', () => {
    const data = encode.claim({ name: 'alice', maxPrice: 1000000000000000n });
    const decoded = iface.decodeFunctionData('claim', data);
    assert.equal(decoded[0], 'alice');
    assert.equal(decoded[1], 1000000000000000n);
  });

  it('throws if name is missing', () => {
    assert.throws(() => encode.claim({ name: '', maxPrice: 1000n }), /name is required/);
  });

  it('throws if maxPrice is missing', () => {
    assert.throws(() => encode.claim({ name: 'alice' }), /maxPrice is required/);
  });
});

// ============================================
// encode.setPrimaryName
// ============================================

describe('encode.setPrimaryName', () => {
  it('returns 0x-prefixed hex calldata', () => {
    const data = encode.setPrimaryName({ tokenId: 1 });
    assert.ok(data.startsWith('0x'));
  });

  it('golden calldata is stable', () => {
    const data = encode.setPrimaryName({ tokenId: 42 });
    const data2 = encode.setPrimaryName({ tokenId: 42 });
    assert.equal(data, data2);
  });

  it('different tokenIds produce different calldata', () => {
    const a = encode.setPrimaryName({ tokenId: 1 });
    const b = encode.setPrimaryName({ tokenId: 2 });
    assert.notEqual(a, b);
  });

  it('can be decoded back via iface', () => {
    const data = encode.setPrimaryName({ tokenId: 42 });
    const decoded = iface.decodeFunctionData('setPrimaryName', data);
    assert.equal(decoded[0], 42n);
  });

  it('throws if tokenId is missing', () => {
    assert.throws(() => encode.setPrimaryName({}), /tokenId is required/);
  });
});
