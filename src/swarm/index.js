/**
 * Swarm subpath — Node Bee client factory.
 *
 * Requires the `@ethersphere/bee-js` peer dependency to be installed.
 * Browser consumers (like the swarmit Vue web app) should not use this subpath —
 * they should use their own gateway-based fetch layer.
 */

export { createBeeClient } from './client.js';
