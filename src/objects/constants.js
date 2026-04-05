/**
 * Protocol constants — shared across all Swarmit consumers.
 */

export const PROTOCOL_VERSION = 'v1';
export const PROTOCOL_PREFIX = 'freedom-board';

export const TYPES = {
  BOARD: `${PROTOCOL_PREFIX}/board/${PROTOCOL_VERSION}`,
  POST: `${PROTOCOL_PREFIX}/post/${PROTOCOL_VERSION}`,
  REPLY: `${PROTOCOL_PREFIX}/reply/${PROTOCOL_VERSION}`,
  SUBMISSION: `${PROTOCOL_PREFIX}/submission/${PROTOCOL_VERSION}`,
  USER_FEED: `${PROTOCOL_PREFIX}/user-feed/${PROTOCOL_VERSION}`,
  BOARD_INDEX: `${PROTOCOL_PREFIX}/board-index/${PROTOCOL_VERSION}`,
  THREAD_INDEX: `${PROTOCOL_PREFIX}/thread-index/${PROTOCOL_VERSION}`,
  GLOBAL_INDEX: `${PROTOCOL_PREFIX}/global-index/${PROTOCOL_VERSION}`,
  CURATOR: `${PROTOCOL_PREFIX}/curator/${PROTOCOL_VERSION}`,
};

/**
 * Recommended view names for curator-published indexes.
 *
 * These are the view identifiers used by the reference curator and understood
 * by the reference clients. Curators MAY publish additional custom view names
 * and clients MUST tolerate unknown `viewId`s — this list is a recommendation,
 * not an exhaustive enumeration of what the protocol allows.
 *
 * `new` is the chronological fallback; the other four require curator-computed
 * ranking. Use RECOMMENDED_RANKED_VIEW_NAMES when iterating only the ranked set.
 */
export const RECOMMENDED_VIEW_NAMES = Object.freeze([
  'new',
  'best',
  'hot',
  'rising',
  'controversial',
]);

/**
 * Recommended ranked view names — the subset of RECOMMENDED_VIEW_NAMES that
 * require curator-computed ranking (excludes `new`, which is chronological).
 */
export const RECOMMENDED_RANKED_VIEW_NAMES = Object.freeze([
  'best',
  'hot',
  'rising',
  'controversial',
]);
