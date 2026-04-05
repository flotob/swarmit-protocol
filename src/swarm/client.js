/**
 * Node Bee client — bee-js v11 wrapper for fetch, publish, and feed operations.
 *
 * Factory returns a client with instance-scoped state (Bee instance, fetch cache, signer).
 * Multiple clients with different keys can coexist in one process.
 *
 * Lifted and parameterized from swarmit-curator/src/swarm/client.js. Two key differences:
 *   1. Instance state instead of module state (Bee, cache, signer are per-client, not module-level globals).
 *   2. No implicit config — all config is passed explicitly to createBeeClient.
 *
 * `@ethersphere/bee-js` is an optional peer dependency. This module will fail to import
 * if the peer dep is not installed — that's the intended signal to consumers that they
 * need to install it if they use the swarm subpath.
 */

import { Bee, Topic, PrivateKey } from '@ethersphere/bee-js';
import { Wallet } from 'ethers';
import { refToHex } from '../references.js';

/**
 * Create a Bee client scoped to a specific node, postage batch, and (optionally) signer.
 *
 * @param {Object} config
 * @param {string} config.beeUrl - Bee API URL (e.g., 'http://bee:1633')
 * @param {string} [config.postageBatchId] - Postage batch ID (required for publish + feed ops)
 * @param {string} [config.privateKey] - Ethereum private key, 0x-prefixed or bare hex (required for feed ops)
 * @returns {{
 *   fetchObject: (ref: string) => Promise<Object>,
 *   clearCache: () => void,
 *   publishJSON: (obj: Object) => Promise<string>,
 *   createFeedManifest: (feedName: string) => Promise<string>,
 *   updateFeed: (feedName: string, contentHex: string) => Promise<void>,
 *   resolveFeed: (feedManifestHex: string) => Promise<Object>,
 * }}
 */
export function createBeeClient({ beeUrl, postageBatchId, privateKey } = {}) {
  if (!beeUrl) throw new Error('createBeeClient: beeUrl is required');

  const bee = new Bee(beeUrl);
  const cache = new Map();

  // Signer + owner are derived once from the private key, if provided.
  // Feed ops (createFeedManifest, updateFeed) throw if these are missing.
  let signer = null;
  let ownerAddress = null;
  if (privateKey) {
    const bareHexKey = privateKey.replace(/^0x/, '');
    signer = new PrivateKey(bareHexKey);
    ownerAddress = new Wallet('0x' + bareHexKey).address;
  }

  function requirePostageBatch(operation) {
    if (!postageBatchId) {
      throw new Error(`createBeeClient: postageBatchId is required for ${operation}`);
    }
  }

  function requireSigner(operation) {
    if (!signer || !ownerAddress) {
      throw new Error(`createBeeClient: privateKey is required for ${operation}`);
    }
  }

  /**
   * Fetch an immutable JSON object from Swarm by reference.
   * Uses instance-scoped in-memory cache.
   * @param {string} ref - bzz:// URL or bare hex
   * @returns {Promise<Object>}
   */
  async function fetchObject(ref) {
    const hex = refToHex(ref);
    if (!hex) throw new Error(`Invalid Swarm reference: ${ref}`);

    if (cache.has(hex)) return cache.get(hex);

    const result = await bee.downloadFile(hex);
    const text = new TextDecoder().decode(result.data.bytes);
    const obj = JSON.parse(text);
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
   * @param {string} feedName
   * @param {string} contentHex - The immutable reference hex to point to
   */
  async function updateFeed(feedName, contentHex) {
    requireSigner('updateFeed');
    requirePostageBatch('updateFeed');
    const topic = Topic.fromString(feedName);
    const writer = bee.makeFeedWriter(topic, signer);
    await writer.uploadReference(postageBatchId, contentHex);
  }

  /**
   * Resolve a feed manifest to its latest content as JSON.
   * @param {string} feedManifestHex - Feed manifest hex reference
   * @returns {Promise<Object>}
   */
  async function resolveFeed(feedManifestHex) {
    const hex = refToHex(feedManifestHex);
    if (!hex) throw new Error(`Invalid feed manifest reference: ${feedManifestHex}`);
    const result = await bee.downloadFile(hex);
    return JSON.parse(new TextDecoder().decode(result.data.bytes));
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
