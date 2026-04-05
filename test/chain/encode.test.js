import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ABI, iface, TOPICS, BYTES32_ZERO, encode } from '../../src/chain/index.js';
import { slugToBoardId, refToBytes32 } from '../../src/references.js';
import { VALID_BZZ, VALID_BZZ_2, VALID_BZZ_3 } from '../helpers/fixtures.js';

// ===========================================
// ABI / interface / TOPICS
// ===========================================

describe('ABI + Interface', () => {
  it('has 17 fragments (5 events + 5 writes + 7 getters)', () => {
    assert.equal(iface.fragments.length, 17);
  });

  it('raw ABI array length matches iface fragment count', () => {
    assert.equal(ABI.length, 17);
  });

  it('iface can look up all 5 write methods', () => {
    const writeNames = [
      'registerBoard',
      'updateBoardMetadata',
      'announceSubmission',
      'setVote',
      'declareCurator',
    ];
    for (const name of writeNames) {
      const fn = iface.getFunction(name);
      assert.ok(fn, `iface.getFunction("${name}") should not be null`);
    }
  });

  it('iface can look up all 7 public state getters', () => {
    const readNames = [
      'boardGovernance',
      'submissionExists',
      'submissionBoard',
      'submissionRoot',
      'voteOf',
      'upvoteCount',
      'downvoteCount',
    ];
    for (const name of readNames) {
      const fn = iface.getFunction(name);
      assert.ok(fn, `iface.getFunction("${name}") should not be null`);
    }
  });

  it('iface can look up all 5 events', () => {
    const eventNames = [
      'BoardRegistered',
      'BoardMetadataUpdated',
      'SubmissionAnnounced',
      'CuratorDeclared',
      'VoteSet',
    ];
    for (const name of eventNames) {
      const ev = iface.getEvent(name);
      assert.ok(ev, `iface.getEvent("${name}") should not be null`);
    }
  });
});

describe('TOPICS', () => {
  it('has 5 topic hashes, all 0x-prefixed 32-byte', () => {
    const names = ['BoardRegistered', 'BoardMetadataUpdated', 'SubmissionAnnounced', 'CuratorDeclared', 'VoteSet'];
    for (const name of names) {
      const topic = TOPICS[name];
      assert.ok(topic, `TOPICS.${name} should be set`);
      assert.ok(topic.startsWith('0x'), `TOPICS.${name} should start with 0x`);
      assert.equal(topic.length, 66, `TOPICS.${name} should be 0x + 64 hex chars`);
    }
  });

  it('all topics are distinct', () => {
    const topics = Object.values(TOPICS);
    const unique = new Set(topics);
    assert.equal(unique.size, topics.length);
  });
});

describe('BYTES32_ZERO', () => {
  it('is 0x followed by 64 zeros', () => {
    assert.equal(BYTES32_ZERO, '0x' + '0'.repeat(64));
  });
});

// ===========================================
// encode.registerBoard
// ===========================================

describe('encode.registerBoard', () => {
  it('returns 0x-prefixed calldata', () => {
    const data = encode.registerBoard({ slug: 'hn', boardRef: VALID_BZZ });
    assert.ok(data.startsWith('0x'));
  });

  it('decoded args match inputs (boardId from slug hash, slug, boardRef)', () => {
    const data = encode.registerBoard({ slug: 'hn', boardRef: VALID_BZZ });
    const decoded = iface.decodeFunctionData('registerBoard', data);
    assert.equal(decoded[0], slugToBoardId('hn'));
    assert.equal(decoded[1], 'hn');
    assert.equal(decoded[2], VALID_BZZ);
  });
});

// ===========================================
// encode.updateBoardMetadata
// ===========================================

describe('encode.updateBoardMetadata', () => {
  it('decoded args match inputs (boardId from slug hash, boardRef)', () => {
    const data = encode.updateBoardMetadata({ slug: 'hn', boardRef: VALID_BZZ_2 });
    const decoded = iface.decodeFunctionData('updateBoardMetadata', data);
    assert.equal(decoded[0], slugToBoardId('hn'));
    assert.equal(decoded[1], VALID_BZZ_2);
  });
});

// ===========================================
// encode.announceSubmission — the critical one
// ===========================================

describe('encode.announceSubmission — top-level post', () => {
  it('parent = BYTES32_ZERO, root = submissionId (contract invariant)', () => {
    const data = encode.announceSubmission({
      boardSlug: 'hn',
      submissionRef: VALID_BZZ,
      parentSubmissionRef: null,
      rootSubmissionRef: null,
    });
    const [boardId, submissionId, parent, root] = iface.decodeFunctionData('announceSubmission', data);
    assert.equal(boardId, slugToBoardId('hn'));
    assert.equal(submissionId, refToBytes32(VALID_BZZ));
    assert.equal(parent, BYTES32_ZERO);
    assert.equal(root, submissionId, 'root must equal submissionId for top-level posts');
  });

  it('returns 0x-prefixed calldata', () => {
    const data = encode.announceSubmission({
      boardSlug: 'hn',
      submissionRef: VALID_BZZ,
      parentSubmissionRef: null,
      rootSubmissionRef: null,
    });
    assert.ok(data.startsWith('0x'));
  });
});

describe('encode.announceSubmission — reply', () => {
  it('parent and root both encoded from their bzz refs', () => {
    const data = encode.announceSubmission({
      boardSlug: 'hn',
      submissionRef: VALID_BZZ,
      parentSubmissionRef: VALID_BZZ_2,
      rootSubmissionRef: VALID_BZZ_3,
    });
    const [, submissionId, parent, root] = iface.decodeFunctionData('announceSubmission', data);
    assert.equal(submissionId, refToBytes32(VALID_BZZ));
    assert.equal(parent, refToBytes32(VALID_BZZ_2));
    assert.equal(root, refToBytes32(VALID_BZZ_3));
  });
});

describe('encode.announceSubmission — XOR invariant', () => {
  it('throws if parentSubmissionRef is null but rootSubmissionRef is not', () => {
    assert.throws(
      () => encode.announceSubmission({
        boardSlug: 'hn',
        submissionRef: VALID_BZZ,
        parentSubmissionRef: null,
        rootSubmissionRef: VALID_BZZ_2,
      }),
      /both be null.*or both be non-null/,
    );
  });

  it('throws if rootSubmissionRef is null but parentSubmissionRef is not', () => {
    assert.throws(
      () => encode.announceSubmission({
        boardSlug: 'hn',
        submissionRef: VALID_BZZ,
        parentSubmissionRef: VALID_BZZ_2,
        rootSubmissionRef: null,
      }),
      /both be null.*or both be non-null/,
    );
  });

  it('throws on invalid submissionRef', () => {
    assert.throws(() => encode.announceSubmission({
      boardSlug: 'hn',
      submissionRef: 'garbage',
      parentSubmissionRef: null,
      rootSubmissionRef: null,
    }));
  });

  it('throws on invalid parentSubmissionRef (reply case)', () => {
    assert.throws(() => encode.announceSubmission({
      boardSlug: 'hn',
      submissionRef: VALID_BZZ,
      parentSubmissionRef: 'garbage',
      rootSubmissionRef: VALID_BZZ_3,
    }));
  });
});

// ===========================================
// encode.setVote
// ===========================================

describe('encode.setVote', () => {
  it('upvote (direction=1)', () => {
    const data = encode.setVote({ submissionRef: VALID_BZZ, direction: 1 });
    const [submissionId, direction] = iface.decodeFunctionData('setVote', data);
    assert.equal(submissionId, refToBytes32(VALID_BZZ));
    assert.equal(Number(direction), 1);
  });

  it('downvote (direction=-1)', () => {
    const data = encode.setVote({ submissionRef: VALID_BZZ, direction: -1 });
    const [, direction] = iface.decodeFunctionData('setVote', data);
    assert.equal(Number(direction), -1);
  });

  it('clear (direction=0)', () => {
    const data = encode.setVote({ submissionRef: VALID_BZZ, direction: 0 });
    const [, direction] = iface.decodeFunctionData('setVote', data);
    assert.equal(Number(direction), 0);
  });

  it('throws on direction=2', () => {
    assert.throws(() => encode.setVote({ submissionRef: VALID_BZZ, direction: 2 }));
  });

  it('throws on direction=null', () => {
    assert.throws(() => encode.setVote({ submissionRef: VALID_BZZ, direction: null }));
  });

  it('throws on direction=undefined', () => {
    assert.throws(() => encode.setVote({ submissionRef: VALID_BZZ }));
  });

  it('throws on invalid submissionRef', () => {
    assert.throws(() => encode.setVote({ submissionRef: 'garbage', direction: 1 }));
  });
});

// ===========================================
// encode.declareCurator
// ===========================================

describe('encode.declareCurator', () => {
  it('encodes the curatorProfileRef as a string', () => {
    const data = encode.declareCurator({ curatorProfileRef: VALID_BZZ });
    const [ref] = iface.decodeFunctionData('declareCurator', data);
    assert.equal(ref, VALID_BZZ);
  });

  it('throws on empty string', () => {
    assert.throws(() => encode.declareCurator({ curatorProfileRef: '' }));
  });

  it('throws on missing arg', () => {
    assert.throws(() => encode.declareCurator({}));
  });
});
