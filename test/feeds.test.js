import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AbiCoder, keccak256 } from 'ethers';
import {
  topicToContractFormat,
  topicToSwarmFormat,
  feedIdFromCoordinates,
  decodeFeedPayload,
  decodeFeedJSON,
} from '../src/feeds.js';
import { VALID_ADDRESS } from './helpers/fixtures.js';

const coder = AbiCoder.defaultAbiCoder();

const RAW_TOPIC = 'aa'.repeat(32);                // Freedom Browser format
const PREFIXED_TOPIC = '0x' + RAW_TOPIC;           // contract format
const OWNER = VALID_ADDRESS;
const EXPECTED_FEED_ID = keccak256(coder.encode(['bytes32', 'address'], [PREFIXED_TOPIC, OWNER]));

// ============================================
// topicToContractFormat
// ============================================

describe('topicToContractFormat', () => {
  it('normalizes raw 64-char hex to 0x-prefixed', () => {
    assert.equal(topicToContractFormat(RAW_TOPIC), PREFIXED_TOPIC);
  });

  it('passes through already-prefixed topic', () => {
    assert.equal(topicToContractFormat(PREFIXED_TOPIC), PREFIXED_TOPIC);
  });

  it('lowercases', () => {
    assert.equal(topicToContractFormat('AA'.repeat(32)), PREFIXED_TOPIC);
  });

  it('throws on missing input', () => {
    assert.throws(() => topicToContractFormat(null), /topic is required/);
  });

  it('throws on malformed input', () => {
    assert.throws(() => topicToContractFormat('not-hex'), /must be 64-char hex/);
  });

  it('throws on too-short hex', () => {
    assert.throws(() => topicToContractFormat('aa'.repeat(31)), /must be 64-char hex/);
  });
});

// ============================================
// topicToSwarmFormat
// ============================================

describe('topicToSwarmFormat', () => {
  it('strips 0x prefix from contract format', () => {
    assert.equal(topicToSwarmFormat(PREFIXED_TOPIC), RAW_TOPIC);
  });

  it('passes through raw 64-char hex', () => {
    assert.equal(topicToSwarmFormat(RAW_TOPIC), RAW_TOPIC);
  });

  it('lowercases', () => {
    assert.equal(topicToSwarmFormat('0x' + 'AA'.repeat(32)), RAW_TOPIC);
  });

  it('throws on missing input', () => {
    assert.throws(() => topicToSwarmFormat(null), /topic is required/);
  });

  it('throws on malformed input', () => {
    assert.throws(() => topicToSwarmFormat('not-hex'), /must be 64-char hex/);
  });
});

// ============================================
// feedIdFromCoordinates
// ============================================

describe('feedIdFromCoordinates', () => {
  it('matches on-chain keccak256(abi.encode(feedTopic, feedOwner))', () => {
    assert.equal(feedIdFromCoordinates(PREFIXED_TOPIC, OWNER), EXPECTED_FEED_ID);
  });

  it('accepts raw 64-char hex topic (Freedom Browser format)', () => {
    assert.equal(feedIdFromCoordinates(RAW_TOPIC, OWNER), EXPECTED_FEED_ID);
  });

  it('returns 0x-prefixed 32-byte hex', () => {
    const result = feedIdFromCoordinates(PREFIXED_TOPIC, OWNER);
    assert.ok(result.startsWith('0x'));
    assert.equal(result.length, 66);
  });

  it('is deterministic', () => {
    assert.equal(
      feedIdFromCoordinates(RAW_TOPIC, OWNER),
      feedIdFromCoordinates(PREFIXED_TOPIC, OWNER),
    );
  });

  it('different inputs produce different ids', () => {
    const topic2 = 'bb'.repeat(32);
    assert.notEqual(
      feedIdFromCoordinates(RAW_TOPIC, OWNER),
      feedIdFromCoordinates(topic2, OWNER),
    );
  });

  it('throws if feedTopic is missing', () => {
    assert.throws(() => feedIdFromCoordinates(null, OWNER), /topic is required/);
  });

  it('throws if feedOwner is missing', () => {
    assert.throws(() => feedIdFromCoordinates(RAW_TOPIC, null), /feedOwner is required/);
  });
});

// ============================================
// decodeFeedPayload / decodeFeedJSON
// ============================================

describe('decodeFeedPayload', () => {
  it('decodes base64 to string', () => {
    const original = 'hello world';
    const b64 = Buffer.from(original).toString('base64');
    assert.equal(decodeFeedPayload({ data: b64 }), original);
  });
});

describe('decodeFeedJSON', () => {
  it('decodes base64 to parsed JSON', () => {
    const obj = { foo: 'bar', n: 42 };
    const b64 = Buffer.from(JSON.stringify(obj)).toString('base64');
    assert.deepEqual(decodeFeedJSON({ data: b64 }), obj);
  });

  it('throws on invalid JSON', () => {
    const b64 = Buffer.from('not json').toString('base64');
    assert.throws(() => decodeFeedJSON({ data: b64 }));
  });
});
