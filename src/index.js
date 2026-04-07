/**
 * swarmit-protocol — root export.
 *
 * Pure protocol surface (no I/O, no chain RPC, no Swarm HTTP):
 *   - Object builders and validators
 *   - Reference helpers (bzz://, hex, bytes32, slug→boardId)
 *   - The TYPES enum
 *
 * For chain encoding (ABI, Interface, calldata encoders) use `swarmit-protocol/chain`.
 * For the Node Bee client (bee-js wrapper) use `swarmit-protocol/swarm`.
 */

// Constants
export {
  TYPES, PROTOCOL_VERSION, PROTOCOL_PREFIX,
  RECOMMENDED_VIEW_NAMES, RECOMMENDED_RANKED_VIEW_NAMES,
  CURATOR_PROFILE_FEED_NAME,
} from './objects/constants.js';

// Object builders (9)
export {
  buildBoard, buildPost, buildReply, buildSubmission,
  buildUserFeedIndex, buildBoardIndex, buildThreadIndex,
  buildGlobalIndex, buildCuratorProfile,
} from './objects/builders.js';

// Object validators (9 + dispatcher). Note: named validators return string[]
// (empty = valid). The dispatcher `validate()` returns { valid, errors } for
// ergonomic boolean checks. Pick the shape that fits your call site.
export {
  validateBoard, validatePost, validateReply, validateSubmission,
  validateUserFeedIndex, validateBoardIndex, validateThreadIndex,
  validateGlobalIndex, validateCuratorProfile,
  validate,
} from './objects/validators.js';

// Fallback display names
export { addressToFallbackName, FALLBACK_NAME_VERSION } from './names.js';

// Reference helpers
export {
  refToHex, hexToBzz,
  isValidRef, isValidBzzRef,
  hexToBytes32, bytes32ToHex,
  refToBytes32, bytes32ToRef,
  slugToBoardId,
} from './references.js';
