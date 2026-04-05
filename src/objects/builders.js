/**
 * Protocol object builders.
 * Pure constructors for all 9 protocol object types.
 * Matches swarm-message-board-v1-schemas.md exactly.
 */

import { TYPES } from './constants.js';

/**
 * Build a board object.
 */
export function buildBoard({ boardId, slug, title, description, governance, rulesRef, endorsedCurators, defaultCurator, metadata }) {
  const obj = {
    protocol: TYPES.BOARD,
    boardId: boardId || slug,
    slug,
    title,
    description,
    createdAt: Date.now(),
    governance,
  };
  if (rulesRef) obj.rulesRef = rulesRef;
  if (endorsedCurators) obj.endorsedCurators = endorsedCurators;
  if (defaultCurator) obj.defaultCurator = defaultCurator;
  if (metadata) obj.metadata = metadata;
  return obj;
}

/**
 * Build a post object.
 */
export function buildPost({ author, title, body, link, attachments }) {
  const obj = {
    protocol: TYPES.POST,
    author,
    title,
    createdAt: Date.now(),
  };
  if (body) obj.body = body;
  if (link) obj.link = link;
  if (attachments && attachments.length > 0) obj.attachments = attachments;
  return obj;
}

/**
 * Build a reply object.
 */
export function buildReply({ author, body }) {
  return {
    protocol: TYPES.REPLY,
    author,
    body,
    createdAt: Date.now(),
  };
}

/**
 * Build a submission object.
 * Note: submissionId is NOT included — the Swarm reference after publish IS the identity.
 */
export function buildSubmission({ boardId, kind, contentRef, author, parentSubmissionId, rootSubmissionId, flair, metadata }) {
  const obj = {
    protocol: TYPES.SUBMISSION,
    boardId,
    kind,
    contentRef,
    author,
    createdAt: Date.now(),
  };
  if (kind === 'reply') {
    obj.parentSubmissionId = parentSubmissionId;
    obj.rootSubmissionId = rootSubmissionId;
  }
  if (flair) obj.flair = flair;
  if (metadata) obj.metadata = metadata;
  return obj;
}

/**
 * Build a userFeedIndex object.
 */
export function buildUserFeedIndex({ author, entries }) {
  return {
    protocol: TYPES.USER_FEED,
    author,
    updatedAt: Date.now(),
    entries: entries || [],
  };
}

/**
 * Build a boardIndex object (curator-produced).
 */
export function buildBoardIndex({ boardId, curator, entries, hidden }) {
  const obj = {
    protocol: TYPES.BOARD_INDEX,
    boardId,
    curator,
    updatedAt: Date.now(),
    entries: entries || [],
  };
  if (hidden && hidden.length > 0) obj.hidden = hidden;
  return obj;
}

/**
 * Build a threadIndex object (curator-produced).
 */
export function buildThreadIndex({ rootSubmissionId, curator, nodes, hidden }) {
  const obj = {
    protocol: TYPES.THREAD_INDEX,
    rootSubmissionId,
    curator,
    updatedAt: Date.now(),
    nodes: nodes || [],
  };
  if (hidden && hidden.length > 0) obj.hidden = hidden;
  return obj;
}

/**
 * Build a globalIndex object (curator-produced).
 */
export function buildGlobalIndex({ curator, entries }) {
  return {
    protocol: TYPES.GLOBAL_INDEX,
    curator,
    updatedAt: Date.now(),
    entries: entries || [],
  };
}

/**
 * Build a curatorProfile object.
 */
export function buildCuratorProfile({ curator, name, description, globalIndexFeed, policyRef, boardFeeds, globalViewFeeds, boardViewFeeds }) {
  const obj = {
    protocol: TYPES.CURATOR,
    curator,
    name,
    description,
    globalIndexFeed,
  };
  if (policyRef) obj.policyRef = policyRef;
  if (boardFeeds) obj.boardFeeds = boardFeeds;
  if (globalViewFeeds) obj.globalViewFeeds = globalViewFeeds;
  if (boardViewFeeds) obj.boardViewFeeds = boardViewFeeds;
  return obj;
}
