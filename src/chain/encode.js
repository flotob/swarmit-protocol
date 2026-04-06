/**
 * Calldata encoders for SwarmitRegistryV2 write methods.
 *
 * Each encoder accepts human-form args (slugs, bzz:// refs), converts them
 * to bytes32 internally, and returns hex calldata from iface.encodeFunctionData.
 * The consumer wraps the result in a transaction and sends it with their
 * own signer.
 *
 * Naming convention: parameters carrying bzz:// refs are named *Ref.
 * On-chain bytes32 IDs are derived internally and never exposed in the API.
 */

import { slugToBoardId, refToBytes32 } from '../references.js';
import { iface, BYTES32_ZERO } from './interface.js';

/**
 * Encode registerBoard.
 * @param {Object} params
 * @param {string} params.slug - human-readable board slug
 * @param {string} params.boardRef - bzz:// reference to the immutable board metadata object
 * @returns {string} 0x-prefixed calldata hex
 */
function registerBoard({ slug, boardRef }) {
  const boardId = slugToBoardId(slug);
  return iface.encodeFunctionData('registerBoard', [boardId, slug, boardRef]);
}

/**
 * Encode updateBoardMetadata. Only the board's governance address can successfully submit this tx.
 * @param {Object} params
 * @param {string} params.slug - human-readable board slug
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
 *   → parentBytes32 = BYTES32_ZERO; rootBytes32 = submissionId (the encoded submissionRef).
 *   This matches the contract invariant at SwarmitRegistryV2.sol:118-119:
 *     "if parentSubmissionId == bytes32(0), rootSubmissionId must equal submissionId".
 *
 * Reply: both refs must be non-null bzz:// references.
 *   → both encoded via refToBytes32.
 *
 * Mixed (one null, one not): throws.
 *
 * @param {Object} params
 * @param {string} params.boardSlug - human-readable board slug
 * @param {string} params.submissionRef - bzz:// reference to this submission object
 * @param {string|null} params.parentSubmissionRef - bzz:// reference to parent submission, or null for top-level
 * @param {string|null} params.rootSubmissionRef - bzz:// reference to root submission, or null for top-level
 * @returns {string} 0x-prefixed calldata hex
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

  // Top-level post: parent is zero, root equals submissionId (enforced by contract).
  // Reply: both refs are encoded from their bzz:// form.
  const parentBytes32 = parentIsNull ? BYTES32_ZERO : refToBytes32(parentSubmissionRef);
  const rootBytes32 = rootIsNull ? submissionId : refToBytes32(rootSubmissionRef);

  return iface.encodeFunctionData('announceSubmission', [boardId, submissionId, parentBytes32, rootBytes32]);
}

/**
 * Encode setVote. Direction must be -1 (downvote), 0 (clear), or 1 (upvote).
 * @param {Object} params
 * @param {string} params.submissionRef - bzz:// reference to the submission being voted on
 * @param {number} params.direction - -1, 0, or 1
 * @returns {string} 0x-prefixed calldata hex
 */
function setVote({ submissionRef, direction }) {
  if (direction !== -1 && direction !== 0 && direction !== 1) {
    throw new Error(`direction must be -1, 0, or 1 (got ${direction})`);
  }
  const submissionId = refToBytes32(submissionRef);
  return iface.encodeFunctionData('setVote', [submissionId, direction]);
}

/**
 * Encode declareCurator. The tx sender (msg.sender) is the curator identity.
 *
 * curatorProfileRef is the stable Swarm locator for the curator profile.
 * In v1.x practice this should be the curator's profile feed manifest ref
 * (a Swarm feed that always resolves to the latest curatorProfile JSON).
 * The contract accepts any string; the feed-manifest convention is a
 * protocol-level recommendation, not an on-chain enforcement.
 *
 * @param {Object} params
 * @param {string} params.curatorProfileRef - stable Swarm locator (feed manifest ref) for the curatorProfile
 * @returns {string} 0x-prefixed calldata hex
 */
function declareCurator({ curatorProfileRef }) {
  if (!curatorProfileRef || typeof curatorProfileRef !== 'string') {
    throw new Error('curatorProfileRef is required');
  }
  return iface.encodeFunctionData('declareCurator', [curatorProfileRef]);
}

export const encode = {
  registerBoard,
  updateBoardMetadata,
  announceSubmission,
  setVote,
  declareCurator,
};
