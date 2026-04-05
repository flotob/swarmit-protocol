/**
 * Node Bee client — bee-js v11 wrapper for fetch, publish, and feed operations.
 *
 * Factory returns a client with instance-scoped state (Bee instance, bounded
 * fetch cache, signer). Multiple clients with different keys can coexist in
 * one process.
 *
 * `@ethersphere/bee-js` is an optional peer dependency. This module will fail
 * to import if the peer dep is not installed — that's the intended signal to
 * consumers that they need to install it if they use the swarm subpath.
 */

import { Bee, Topic, PrivateKey } from '@ethersphere/bee-js';
import { refToHex } from '../references.js';

const TEXT_DECODER = new TextDecoder();

const DEFAULT_CACHE_MAX = 2000;

/**
 * Create a Bee client scoped to a specific node, postage batch, and (optionally) signer.
 *
 * @param {Object} config
 * @param {string} config.beeUrl - Bee API URL (e.g., 'http://bee:1633')
 * @param {string} [config.postageBatchId] - Postage batch ID (required for publish + feed ops)
 * @param {string} [config.privateKey] - Ethereum private key, 0x-prefixed or bare hex (required for feed ops)
 * @param {number} [config.cacheMax=2000] - Max entries in the per-instance fetchObject cache.
 *   LRU eviction; set to Infinity to disable eviction. Consumers with bounded poll loops
 *   (like the curator) can call clearCache() explicitly instead.
 * @returns {{
 *   fetchObject: (ref: string) => Promise<Object>,
 *   clearCache: () => void,
 *   publishJSON: (obj: Object) => Promise<string>,
 *   createFeedManifest: (feedName: string) => Promise<string>,
 *   updateFeed: (feedName: string, contentRef: string) => Promise<void>,
 *   resolveFeed: (feedManifestHex: string) => Promise<Object>,
 * }}
 */
export function createBeeClient({ beeUrl, postageBatchId, privateKey, cacheMax = DEFAULT_CACHE_MAX } = {}) {
  if (!beeUrl) throw new Error('swarmit-protocol/swarm: beeUrl is required');

  const bee = new Bee(beeUrl);
  // Map preserves insertion order, so `cache.keys().next().value` is always the
  // oldest entry — sufficient for a cheap LRU without an external dep.
  const cache = new Map();

  let signer = null;
  let ownerAddress = null;
  if (privateKey) {
    signer = new PrivateKey(privateKey);
    ownerAddress = signer.publicKey().address().toChecksum();
  }

  function requirePostageBatch(operation) {
    if (!postageBatchId) {
      throw new Error(`swarmit-protocol/swarm: postageBatchId is required for ${operation}`);
    }
  }

  function requireSigner(operation) {
    if (!signer) {
      throw new Error(`swarmit-protocol/swarm: privateKey is required for ${operation}`);
    }
  }

  /**
   * Fetch an immutable JSON object from Swarm by reference.
   * Uses instance-scoped bounded LRU cache (most-recently-used entries kept).
   * @param {string} ref - bzz:// URL or bare hex
   * @returns {Promise<Object>}
   */
  async function fetchObject(ref) {
    const hex = refToHex(ref);
    if (!hex) throw new Error(`Invalid Swarm reference: ${ref}`);

    if (cache.has(hex)) {
      // LRU bump: re-insert at the end of the Map's insertion order.
      const obj = cache.get(hex);
      cache.delete(hex);
      cache.set(hex, obj);
      return obj;
    }

    const result = await bee.downloadFile(hex);
    const obj = JSON.parse(TEXT_DECODER.decode(result.data.bytes));

    if (cache.size >= cacheMax) {
      // Evict the oldest entry (first key in insertion order).
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    cache.set(hex, obj);

    return obj;
  }

  /**
   * Clear the instance fetch cache.
   * Consumers like the curator call this at the end of each poll-loop iteration.
   */
  function clearCache() {
    cache.clear();
  }

  /**
   * Publish a JSON object to Swarm immutably.
   * @param {Object} obj
   * @returns {Promise<string>} 64-char hex reference
   */
  async function publishJSON(obj) {
    requirePostageBatch('publishJSON');
    const json = JSON.stringify(obj);
    const result = await bee.uploadFile(postageBatchId, json, 'data.json', {
      contentType: 'application/json',
      deferred: false,
    });
    return result.reference.toString();
  }

  /**
   * Create a feed manifest. Topic is derived from feedName; owner is derived from privateKey.
   * Idempotent: same owner + topic → same manifest reference.
   * @param {string} feedName
   * @returns {Promise<string>} Feed manifest reference hex
   */
  async function createFeedManifest(feedName) {
    requireSigner('createFeedManifest');
    requirePostageBatch('createFeedManifest');
    const topic = Topic.fromString(feedName);
    const result = await bee.createFeedManifest(postageBatchId, topic, ownerAddress);
    return result.toString();
  }

  /**
   * Update a feed to point at a new content reference. Signs with the client's privateKey.
   * Accepts the content reference as either a bzz:// URL or a bare 64-char hex string.
   * @param {string} feedName
   * @param {string} contentRef - bzz://<hex> or bare hex
   */
  async function updateFeed(feedName, contentRef) {
    requireSigner('updateFeed');
    requirePostageBatch('updateFeed');
    const hex = refToHex(contentRef);
    if (!hex) throw new Error(`Invalid content reference for updateFeed: ${contentRef}`);
    const topic = Topic.fromString(feedName);
    const writer = bee.makeFeedWriter(topic, signer);
    await writer.uploadReference(postageBatchId, hex);
  }

  /**
   * Resolve a feed manifest to its latest content as JSON.
   * @param {string} feedManifestHex - Feed manifest reference (bzz:// or bare hex)
   * @returns {Promise<Object>}
   */
  async function resolveFeed(feedManifestHex) {
    const hex = refToHex(feedManifestHex);
    if (!hex) throw new Error(`Invalid feed manifest reference: ${feedManifestHex}`);
    const result = await bee.downloadFile(hex);
    return JSON.parse(TEXT_DECODER.decode(result.data.bytes));
  }

  return {
    fetchObject,
    clearCache,
    publishJSON,
    createFeedManifest,
    updateFeed,
    resolveFeed,
  };
}
