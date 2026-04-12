/**
 * Calldata encoders for SwarmitRegistryV3 write methods.
 *
 * Each encoder accepts human-form args (slugs, bzz:// refs), converts them
 * to the contract's expected types, and returns hex calldata.
 */

import { slugToBoardId, refToBytes32 } from '../references.js';
import { topicToContractFormat } from '../feeds.js';
import { iface, BYTES32_ZERO } from './interface.js';

/**
 * Encode registerBoard.
 * V3: the contract derives boardId from the slug internally.
 * @param {Object} params
 * @param {string} params.slug - canonical lowercase board slug
 * @param {string} params.boardRef - bzz:// reference to the immutable board metadata object
 * @returns {string} 0x-prefixed calldata hex
 */
function registerBoard({ slug, boardRef }) {
  return iface.encodeFunctionData('registerBoard', [slug, boardRef]);
}

/**
 * Encode updateBoardMetadata. Only the board's governance address can successfully submit this tx.
 * @param {Object} params
 * @param {string} params.slug - human-readable board slug (used to derive boardId)
 * @param {string} params.boardRef - bzz:// reference to the new board metadata object
 * @returns {string} 0x-prefixed calldata hex
 */
function updateBoardMetadata({ slug, boardRef }) {
  const boardId = slugToBoardId(slug);
  return iface.encodeFunctionData('updateBoardMetadata', [boardId, boardRef]);
}

/**
 * Encode announceSubmission (post or reply).
 *
 * Top-level post: both parentSubmissionRef and rootSubmissionRef must be null.
 * Reply: both refs must be non-null bzz:// references.
 * Mixed: throws.
 */
function announceSubmission({ boardSlug, submissionRef, parentSubmissionRef, rootSubmissionRef }) {
  const parentIsNull = parentSubmissionRef == null;
  const rootIsNull = rootSubmissionRef == null;
  if (parentIsNull !== rootIsNull) {
    throw new Error(
      'parentSubmissionRef and rootSubmissionRef must both be null (top-level post) or both be non-null (reply)',
    );
  }

  const boardId = slugToBoardId(boardSlug);
  const submissionId = refToBytes32(submissionRef);

  const parentBytes32 = parentIsNull ? BYTES32_ZERO : refToBytes32(parentSubmissionRef);
  const rootBytes32 = rootIsNull ? submissionId : refToBytes32(rootSubmissionRef);

  return iface.encodeFunctionData('announceSubmission', [boardId, submissionId, parentBytes32, rootBytes32]);
}

/**
 * Encode setVote. Direction must be -1 (downvote), 0 (clear), or 1 (upvote).
 */
function setVote({ submissionRef, direction }) {
  if (direction !== -1 && direction !== 0 && direction !== 1) {
    throw new Error(`direction must be -1, 0, or 1 (got ${direction})`);
  }
  const submissionId = refToBytes32(submissionRef);
  return iface.encodeFunctionData('setVote', [submissionId, direction]);
}

/**
 * Encode declareCurator.
 */
function declareCurator({ curatorProfileRef }) {
  if (!curatorProfileRef || typeof curatorProfileRef !== 'string') {
    throw new Error('curatorProfileRef is required');
  }
  return iface.encodeFunctionData('declareCurator', [curatorProfileRef]);
}

/**
 * Encode declareUserFeed.
 * @param {Object} params
 * @param {string} params.feedTopic - 0x-prefixed bytes32 hex feed topic
 * @param {string} params.feedOwner - 0x-prefixed Swarm signer address
 * @returns {string} 0x-prefixed calldata hex
 */
function declareUserFeed({ feedTopic, feedOwner }) {
  if (!feedOwner || typeof feedOwner !== 'string') {
    throw new Error('feedOwner is required');
  }
  const normalizedTopic = topicToContractFormat(feedTopic);
  return iface.encodeFunctionData('declareUserFeed', [normalizedTopic, feedOwner]);
}

/**
 * Encode revokeUserFeed.
 * @param {Object} params
 * @param {string} params.feedId - 0x-prefixed bytes32 feedId to revoke
 * @returns {string} 0x-prefixed calldata hex
 */
function revokeUserFeed({ feedId }) {
  if (!feedId || typeof feedId !== 'string') {
    throw new Error('feedId is required');
  }
  return iface.encodeFunctionData('revokeUserFeed', [feedId]);
}

export const encode = {
  registerBoard,
  updateBoardMetadata,
  announceSubmission,
  setVote,
  declareCurator,
  declareUserFeed,
  revokeUserFeed,
};
