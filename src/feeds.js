/**
 * Feed utility helpers for the Swarmit journal-based feed model.
 *
 * - feedIdFromCoordinates: derives the on-chain feedId from topic + owner
 * - decodeFeedPayload / decodeFeedJSON: decode base64 feed entry responses
 */

import { AbiCoder, keccak256 } from 'ethers';

const coder = AbiCoder.defaultAbiCoder();
const HEX_64_RE = /^[0-9a-fA-F]{64}$/;

/**
 * Normalize a feed topic to 0x-prefixed bytes32 for contract calls.
 * Accepts both Freedom Browser format (raw 64-char hex) and 0x-prefixed.
 *
 * @param {string} topic - raw 64-char hex or 0x-prefixed bytes32
 * @returns {string} 0x-prefixed bytes32
 */
export function topicToContractFormat(topic) {
  if (!topic || typeof topic !== 'string') {
    throw new Error('topic is required');
  }
  if (topic.startsWith('0x') && HEX_64_RE.test(topic.slice(2))) {
    return topic.toLowerCase();
  }
  if (HEX_64_RE.test(topic)) {
    return '0x' + topic.toLowerCase();
  }
  throw new Error('topic must be 64-char hex (with or without 0x prefix)');
}

/**
 * Normalize a contract-format bytes32 topic back to raw 64-char hex for
 * Swarm read calls (window.swarm.readFeedEntry).
 *
 * @param {string} topic - 0x-prefixed bytes32 or raw 64-char hex
 * @returns {string} raw 64-char lowercase hex (no 0x prefix)
 */
export function topicToSwarmFormat(topic) {
  if (!topic || typeof topic !== 'string') {
    throw new Error('topic is required');
  }
  const raw = topic.startsWith('0x') ? topic.slice(2) : topic;
  if (!HEX_64_RE.test(raw)) {
    throw new Error('topic must be 64-char hex (with or without 0x prefix)');
  }
  return raw.toLowerCase();
}

/**
 * Derive a feedId from feed coordinates, matching the on-chain
 * `keccak256(abi.encode(feedTopic, feedOwner))`.
 *
 * Accepts both Freedom Browser format (raw 64-char hex) and 0x-prefixed topics.
 * Uses standard ABI encoding (NOT packed), matching Solidity's abi.encode.
 *
 * @param {string} feedTopic - raw 64-char hex or 0x-prefixed bytes32
 * @param {string} feedOwner - 0x-prefixed address hex
 * @returns {string} 0x-prefixed bytes32 feedId
 */
export function feedIdFromCoordinates(feedTopic, feedOwner) {
  if (!feedOwner || typeof feedOwner !== 'string') {
    throw new Error('feedOwner is required');
  }
  const normalizedTopic = topicToContractFormat(feedTopic);
  const encoded = coder.encode(['bytes32', 'address'], [normalizedTopic, feedOwner]);
  return keccak256(encoded);
}

/**
 * Decode a base64-encoded feed entry response to a string.
 * Works in both browser (atob) and Node (Buffer) environments.
 *
 * @param {{ data: string }} result - readFeedEntry response
 * @returns {string} decoded UTF-8 string
 */
export function decodeFeedPayload(result) {
  const b64 = result.data;
  const bytes = typeof atob === 'function'
    ? Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    : Uint8Array.from(Buffer.from(b64, 'base64'));
  return new TextDecoder().decode(bytes);
}

/**
 * Decode a base64-encoded feed entry response and parse as JSON.
 *
 * @param {{ data: string }} result - readFeedEntry response
 * @returns {*} parsed JSON value
 */
export function decodeFeedJSON(result) {
  return JSON.parse(decodeFeedPayload(result));
}
