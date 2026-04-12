import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TYPES,
  RECOMMENDED_VIEW_NAMES, RECOMMENDED_RANKED_VIEW_NAMES,
  CURATOR_PROFILE_FEED_NAME,
  buildBoard, buildPost, buildReply, buildSubmission,
  buildUserFeedEntry, buildBoardIndex, buildThreadIndex,
  buildGlobalIndex, buildCuratorProfile,
  validateBoard, validatePost, validateReply, validateSubmission,
  validateUserFeedEntry, validateBoardIndex, validateThreadIndex,
  validateGlobalIndex, validateCuratorProfile,
  validate,
} from '../../src/index.js';
import {
  VALID_HEX, VALID_BZZ, VALID_BZZ_2, VALID_BZZ_3,
  VALID_ADDRESS, GENERAL_BOARD_ID, validAuthor, validBody,
  validBoard, validPost, validReply,
  validSubmissionPost, validSubmissionReply,
  validUserFeedEntry, validBoardIndex, validThreadIndex,
  validGlobalIndex, validCuratorProfile,
} from '../helpers/fixtures.js';
import { slugToBoardId } from '../../src/references.js';

// ===========================================
// Recommended view names
// ===========================================

describe('RECOMMENDED_VIEW_NAMES / RECOMMENDED_RANKED_VIEW_NAMES', () => {
  it('includes the 5 canonical v1 view names in order', () => {
    assert.deepEqual(RECOMMENDED_VIEW_NAMES, ['new', 'best', 'hot', 'rising', 'controversial']);
  });

  it('ranked view names exclude "new" (which is chronological)', () => {
    assert.deepEqual(RECOMMENDED_RANKED_VIEW_NAMES, ['best', 'hot', 'rising', 'controversial']);
  });

  it('ranked is a subset of all', () => {
    for (const view of RECOMMENDED_RANKED_VIEW_NAMES) {
      assert.ok(RECOMMENDED_VIEW_NAMES.includes(view), `${view} missing from RECOMMENDED_VIEW_NAMES`);
    }
  });

  it('both arrays are frozen (immutable)', () => {
    assert.ok(Object.isFrozen(RECOMMENDED_VIEW_NAMES));
    assert.ok(Object.isFrozen(RECOMMENDED_RANKED_VIEW_NAMES));
  });
});

describe('CURATOR_PROFILE_FEED_NAME', () => {
  it('equals the versioned topic string', () => {
    assert.equal(CURATOR_PROFILE_FEED_NAME, 'curator-profile-v1');
  });

  it('is a non-empty string', () => {
    assert.equal(typeof CURATOR_PROFILE_FEED_NAME, 'string');
    assert.ok(CURATOR_PROFILE_FEED_NAME.length > 0);
  });
});

// ===========================================
// Builders
// ===========================================

describe('buildBoard', () => {
  it('produces correct protocol field', () => {
    const board = buildBoard({ slug: 'gen', title: 'Gen', description: 'd', governance: {} });
    assert.equal(board.protocol, TYPES.BOARD);
  });

  it('derives boardId from slug as keccak256 hash', () => {
    const board = buildBoard({ slug: 'gen', title: 'Gen', description: 'd', governance: {} });
    assert.equal(board.boardId, slugToBoardId('gen'));
  });

  it('throws on invalid slug', () => {
    assert.throws(
      () => buildBoard({ slug: 'NOT VALID', title: 'T', description: 'd', governance: {} }),
      /invalid board slug/,
    );
  });

  it('sets createdAt to a recent timestamp', () => {
    const before = Date.now();
    const board = buildBoard({ slug: 'x', title: 'x', description: 'x', governance: {} });
    assert.ok(board.createdAt >= before && board.createdAt <= Date.now());
  });
});

describe('buildPost', () => {
  it('produces correct protocol field', () => {
    const post = buildPost({ author: validAuthor(), title: 'T', body: validBody() });
    assert.equal(post.protocol, TYPES.POST);
  });

  it('sets createdAt', () => {
    const post = buildPost({ author: validAuthor(), title: 'T', body: validBody() });
    assert.equal(typeof post.createdAt, 'number');
  });
});

describe('buildReply', () => {
  it('produces correct protocol field', () => {
    const reply = buildReply({ author: validAuthor(), body: validBody() });
    assert.equal(reply.protocol, TYPES.REPLY);
  });

  it('sets createdAt', () => {
    const reply = buildReply({ author: validAuthor(), body: validBody() });
    assert.equal(typeof reply.createdAt, 'number');
  });
});

describe('buildSubmission', () => {
  it('produces correct protocol field', () => {
    const sub = buildSubmission({ boardId: 'gen', kind: 'post', contentRef: VALID_BZZ, author: validAuthor() });
    assert.equal(sub.protocol, TYPES.SUBMISSION);
  });

  it('kind: post excludes parent/root', () => {
    const sub = buildSubmission({ boardId: 'gen', kind: 'post', contentRef: VALID_BZZ, author: validAuthor() });
    assert.equal(sub.parentSubmissionId, undefined);
    assert.equal(sub.rootSubmissionId, undefined);
  });

  it('kind: reply includes parent/root', () => {
    const sub = buildSubmission({
      boardId: 'gen', kind: 'reply', contentRef: VALID_BZZ, author: validAuthor(),
      parentSubmissionId: VALID_BZZ_2, rootSubmissionId: VALID_BZZ_3,
    });
    assert.equal(sub.parentSubmissionId, VALID_BZZ_2);
    assert.equal(sub.rootSubmissionId, VALID_BZZ_3);
  });

  it('sets createdAt', () => {
    const sub = buildSubmission({ boardId: 'gen', kind: 'post', contentRef: VALID_BZZ, author: validAuthor() });
    assert.equal(typeof sub.createdAt, 'number');
  });
});

describe('buildUserFeedEntry', () => {
  it('produces correct protocol field', () => {
    const entry = buildUserFeedEntry({ submissionRef: VALID_BZZ, boardSlug: 'gen', kind: 'post' });
    assert.equal(entry.protocol, TYPES.USER_FEED_ENTRY);
  });

  it('sets createdAt', () => {
    const entry = buildUserFeedEntry({ submissionRef: VALID_BZZ, boardSlug: 'gen', kind: 'post' });
    assert.equal(typeof entry.createdAt, 'number');
  });
});

describe('buildBoardIndex', () => {
  it('produces correct protocol', () => {
    const bi = buildBoardIndex({ boardId: 'gen', curator: VALID_ADDRESS, entries: [] });
    assert.equal(bi.protocol, TYPES.BOARD_INDEX);
  });
});

describe('buildThreadIndex', () => {
  it('produces correct protocol', () => {
    const ti = buildThreadIndex({ rootSubmissionId: VALID_BZZ, curator: VALID_ADDRESS, nodes: [] });
    assert.equal(ti.protocol, TYPES.THREAD_INDEX);
  });
});

describe('buildGlobalIndex', () => {
  it('produces correct protocol', () => {
    const gi = buildGlobalIndex({ curator: VALID_ADDRESS, entries: [] });
    assert.equal(gi.protocol, TYPES.GLOBAL_INDEX);
  });
});

describe('buildCuratorProfile', () => {
  it('produces correct protocol', () => {
    const cp = buildCuratorProfile({
      curator: VALID_ADDRESS, name: 'Test', description: 'd', globalIndexFeed: VALID_BZZ,
    });
    assert.equal(cp.protocol, TYPES.CURATOR);
  });
});

// ===========================================
// Validators — valid fixtures pass with 0 errors
// ===========================================

describe('validators pass for valid fixtures', () => {
  it('validateBoard', () => {
    assert.deepEqual(validateBoard(validBoard()), []);
  });

  it('validatePost', () => {
    assert.deepEqual(validatePost(validPost()), []);
  });

  it('validateReply', () => {
    assert.deepEqual(validateReply(validReply()), []);
  });

  it('validateSubmission (post)', () => {
    assert.deepEqual(validateSubmission(validSubmissionPost()), []);
  });

  it('validateSubmission (reply)', () => {
    assert.deepEqual(validateSubmission(validSubmissionReply()), []);
  });

  it('validateUserFeedEntry', () => {
    assert.deepEqual(validateUserFeedEntry(validUserFeedEntry()), []);
  });

  it('validateBoardIndex', () => {
    assert.deepEqual(validateBoardIndex(validBoardIndex()), []);
  });

  it('validateThreadIndex', () => {
    assert.deepEqual(validateThreadIndex(validThreadIndex()), []);
  });

  it('validateGlobalIndex', () => {
    assert.deepEqual(validateGlobalIndex(validGlobalIndex()), []);
  });

  it('validateCuratorProfile', () => {
    assert.deepEqual(validateCuratorProfile(validCuratorProfile()), []);
  });
});

// ===========================================
// Validators — missing/wrong fields
// ===========================================

describe('validators catch missing/wrong fields', () => {
  it('wrong protocol field produces error', () => {
    const board = { ...validBoard(), protocol: 'wrong' };
    const errors = validateBoard(board);
    assert.ok(errors.length > 0);
    assert.ok(errors.some(e => e.includes('protocol')));
  });

  it('missing required fields on board', () => {
    const errors = validateBoard({ protocol: TYPES.BOARD });
    assert.ok(errors.some(e => e.includes('boardId')));
    assert.ok(errors.some(e => e.includes('slug')));
    assert.ok(errors.some(e => e.includes('title')));
  });

  it('missing required fields on post', () => {
    const errors = validatePost({ protocol: TYPES.POST });
    assert.ok(errors.some(e => e.includes('author')));
    assert.ok(errors.some(e => e.includes('title')));
    assert.ok(errors.some(e => e.includes('at least one of')));
  });

  it('missing required fields on reply', () => {
    const errors = validateReply({ protocol: TYPES.REPLY });
    assert.ok(errors.some(e => e.includes('author')));
    assert.ok(errors.some(e => e.includes('body')));
  });

  it('validates link-only post', () => {
    const post = buildPost({ author: validAuthor(), title: 'Link', link: { url: 'https://example.com' } });
    const errors = validatePost(post);
    assert.deepEqual(errors, []);
  });

  it('validates link+body post', () => {
    const post = buildPost({ author: validAuthor(), title: 'Link', link: { url: 'https://example.com' }, body: validBody() });
    const errors = validatePost(post);
    assert.deepEqual(errors, []);
  });

  it('validates attachment-only post', () => {
    const post = buildPost({ author: validAuthor(), title: 'Media', attachments: [{ reference: VALID_BZZ, contentType: 'image/png' }] });
    const errors = validatePost(post);
    assert.deepEqual(errors, []);
  });

  it('rejects post with none of body/link/attachments', () => {
    const post = buildPost({ author: validAuthor(), title: 'Empty' });
    const errors = validatePost(post);
    assert.ok(errors.some(e => e.includes('at least one of')));
  });

  it('rejects link post with unsupported scheme', () => {
    const post = buildPost({ author: validAuthor(), title: 'Bad', link: { url: 'ftp://bad' } });
    const errors = validatePost(post);
    assert.ok(errors.some(e => e.includes('supported scheme')));
  });

  it('validates bzz:// link post', () => {
    const post = buildPost({ author: validAuthor(), title: 'Swarm', link: { url: `bzz://${'a'.repeat(64)}` } });
    const errors = validatePost(post);
    assert.deepEqual(errors, []);
  });

  it('rejects link post with missing URL', () => {
    const post = buildPost({ author: validAuthor(), title: 'No URL', link: { title: 'X' } });
    const errors = validatePost(post);
    assert.ok(errors.some(e => e.includes('link.url')));
  });

  it('rejects link post with invalid thumbnailRef', () => {
    const post = buildPost({ author: validAuthor(), title: 'Bad thumb', link: { url: 'https://example.com', thumbnailRef: 'bad' } });
    const errors = validatePost(post);
    assert.ok(errors.some(e => e.includes('thumbnailRef')));
  });
});

// ===========================================
// validateSubmission specifics
// ===========================================

describe('validateSubmission specifics', () => {
  it('kind: post rejects parentSubmissionId', () => {
    const sub = { ...validSubmissionPost(), parentSubmissionId: VALID_BZZ_2 };
    const errors = validateSubmission(sub);
    assert.ok(errors.some(e => e.includes('parentSubmissionId')));
  });

  it('kind: post rejects rootSubmissionId', () => {
    const sub = { ...validSubmissionPost(), rootSubmissionId: VALID_BZZ_3 };
    const errors = validateSubmission(sub);
    assert.ok(errors.some(e => e.includes('rootSubmissionId')));
  });

  it('kind: reply requires parentSubmissionId as bzz://', () => {
    const sub = { ...validSubmissionReply(), parentSubmissionId: VALID_HEX };
    const errors = validateSubmission(sub);
    assert.ok(errors.some(e => e.includes('parentSubmissionId')));
  });

  it('kind: reply requires rootSubmissionId as bzz://', () => {
    const sub = { ...validSubmissionReply(), rootSubmissionId: VALID_HEX };
    const errors = validateSubmission(sub);
    assert.ok(errors.some(e => e.includes('rootSubmissionId')));
  });

  it('kind: reply rejects bare hex refs', () => {
    const sub = {
      ...validSubmissionReply(),
      parentSubmissionId: VALID_HEX,
      rootSubmissionId: VALID_HEX,
    };
    const errors = validateSubmission(sub);
    assert.ok(errors.some(e => e.includes('parentSubmissionId')));
    assert.ok(errors.some(e => e.includes('rootSubmissionId')));
  });

  it('unknown kind produces error', () => {
    const sub = { ...validSubmissionPost(), kind: 'unknown' };
    const errors = validateSubmission(sub);
    assert.ok(errors.some(e => e.includes('kind')));
  });
});

// ===========================================
// Index validators — nested entry checks
// ===========================================

describe('validateUserFeedEntry specifics', () => {
  it('rejects missing submissionRef', () => {
    const entry = { ...validUserFeedEntry(), submissionRef: undefined };
    const errors = validateUserFeedEntry(entry);
    assert.ok(errors.some(e => e.includes('submissionRef')));
  });

  it('rejects bare hex submissionRef', () => {
    const entry = { ...validUserFeedEntry(), submissionRef: VALID_HEX };
    const errors = validateUserFeedEntry(entry);
    assert.ok(errors.some(e => e.includes('submissionRef')));
  });

  it('rejects missing boardSlug', () => {
    const entry = { ...validUserFeedEntry(), boardSlug: undefined };
    const errors = validateUserFeedEntry(entry);
    assert.ok(errors.some(e => e.includes('boardSlug')));
  });

  it('rejects missing kind', () => {
    const entry = { ...validUserFeedEntry(), kind: undefined };
    const errors = validateUserFeedEntry(entry);
    assert.ok(errors.some(e => e.includes('kind')));
  });

  it('rejects non-canonical boardSlug', () => {
    const entry = { ...validUserFeedEntry(), boardSlug: 'NOT VALID' };
    const errors = validateUserFeedEntry(entry);
    assert.ok(errors.some(e => e.includes('canonical board slug')));
  });

  it('rejects invalid kind value', () => {
    const entry = { ...validUserFeedEntry(), kind: 'garbage' };
    const errors = validateUserFeedEntry(entry);
    assert.ok(errors.some(e => e.includes('kind must be')));
  });
});

describe('validateBoardIndex entries', () => {
  it('rejects entries missing submissionRef', () => {
    const bi = {
      ...validBoardIndex(),
      entries: [{ submissionId: VALID_BZZ }],
    };
    const errors = validateBoardIndex(bi);
    assert.ok(errors.some(e => e.includes('submissionRef')));
  });
});

describe('validateThreadIndex nodes', () => {
  it('rejects nodes missing depth', () => {
    const ti = {
      ...validThreadIndex(),
      nodes: [{ submissionId: VALID_BZZ, parentSubmissionId: null }],
    };
    const errors = validateThreadIndex(ti);
    assert.ok(errors.some(e => e.includes('depth')));
  });

  it('rejects nodes with invalid parentSubmissionId (bare hex)', () => {
    const ti = {
      ...validThreadIndex(),
      nodes: [{ submissionId: VALID_BZZ, parentSubmissionId: VALID_HEX, depth: 1 }],
    };
    const errors = validateThreadIndex(ti);
    assert.ok(errors.some(e => e.includes('parentSubmissionId')));
  });
});

describe('validateGlobalIndex entries', () => {
  it('rejects entries missing boardId', () => {
    const gi = {
      ...validGlobalIndex(),
      entries: [{ submissionId: VALID_BZZ, submissionRef: VALID_BZZ }],
    };
    const errors = validateGlobalIndex(gi);
    assert.ok(errors.some(e => e.includes('boardId')));
  });
});

// ===========================================
// Generic validate()
// ===========================================

describe('validate()', () => {
  it('dispatches to correct validator based on protocol', () => {
    const result = validate(validBoard());
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('unknown protocol returns error', () => {
    const result = validate({ protocol: 'unknown/type' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('unknown protocol')));
  });

  it('missing protocol returns error', () => {
    const result = validate({ foo: 'bar' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('protocol')));
  });

  it('non-object input returns error', () => {
    const result = validate(null);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('object is required')));
  });

  it('string input returns error', () => {
    const result = validate('not an object');
    assert.equal(result.valid, false);
  });
});
