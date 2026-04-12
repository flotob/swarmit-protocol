import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ABI, iface, TOPICS, BYTES32_ZERO, encode, VOTE } from '../../src/chain/index.js';
import { slugToBoardId, refToBytes32 } from '../../src/references.js';
import { VALID_BZZ, VALID_BZZ_2, VALID_BZZ_3, VALID_ADDRESS } from '../helpers/fixtures.js';

describe('VOTE constants', () => {
  it('exports UP/CLEAR/DOWN as 1/0/-1', () => {
    assert.equal(VOTE.UP, 1);
    assert.equal(VOTE.CLEAR, 0);
    assert.equal(VOTE.DOWN, -1);
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(VOTE));
  });

  it('can be used interchangeably with numeric literals in encode.setVote', () => {
    const withConst = encode.setVote({ submissionRef: VALID_BZZ, direction: VOTE.UP });
    const withLiteral = encode.setVote({ submissionRef: VALID_BZZ, direction: 1 });
    assert.equal(withConst, withLiteral);
  });
});

describe('BYTES32_ZERO (re-exported from ethers.ZeroHash)', () => {
  it('matches 0x + 64 zeros', () => {
    assert.equal(BYTES32_ZERO, '0x' + '0'.repeat(64));
  });
});

// ===========================================
// ABI / interface / TOPICS
// ===========================================

describe('ABI + Interface', () => {
  it('has 28 fragments (7 events + 7 writes + 7 mapping getters + 7 view helpers)', () => {
    assert.equal(iface.fragments.length, 28);
  });

  it('raw ABI array length matches iface fragment count', () => {
    assert.equal(ABI.length, 28);
  });

  it('iface can look up all 7 write methods', () => {
    const writeNames = [
      'registerBoard',
      'updateBoardMetadata',
      'announceSubmission',
      'setVote',
      'declareCurator',
      'declareUserFeed',
      'revokeUserFeed',
    ];
    for (const name of writeNames) {
      assert.ok(iface.getFunction(name), `iface.getFunction("${name}") should not be null`);
    }
  });

  it('iface can look up all 7 events', () => {
    const eventNames = [
      'BoardRegistered',
      'BoardMetadataUpdated',
      'SubmissionAnnounced',
      'CuratorDeclared',
      'VoteSet',
      'UserFeedDeclared',
      'UserFeedRevoked',
    ];
    for (const name of eventNames) {
      assert.ok(iface.getEvent(name), `iface.getEvent("${name}") should not be null`);
    }
  });
});

describe('TOPICS', () => {
  it('has 7 topic hashes, all 0x-prefixed 32-byte', () => {
    const names = [
      'BoardRegistered', 'BoardMetadataUpdated', 'SubmissionAnnounced',
      'CuratorDeclared', 'VoteSet', 'UserFeedDeclared', 'UserFeedRevoked',
    ];
    for (const name of names) {
      const topic = TOPICS[name];
      assert.ok(topic, `TOPICS.${name} should be set`);
      assert.ok(topic.startsWith('0x'), `TOPICS.${name} should start with 0x`);
      assert.equal(topic.length, 66, `TOPICS.${name} should be 0x + 64 hex chars`);
    }
  });

  it('all topics are distinct', () => {
    const topics = Object.values(TOPICS);
    assert.equal(new Set(topics).size, topics.length);
  });
});

// ===========================================
// encode.registerBoard — V3: no boardId param
// ===========================================

describe('encode.registerBoard', () => {
  it('returns 0x-prefixed calldata', () => {
    const data = encode.registerBoard({ slug: 'hn', boardRef: VALID_BZZ });
    assert.ok(data.startsWith('0x'));
  });

  it('decoded args are slug and boardRef (no boardId)', () => {
    const data = encode.registerBoard({ slug: 'hn', boardRef: VALID_BZZ });
    const decoded = iface.decodeFunctionData('registerBoard', data);
    assert.equal(decoded[0], 'hn');
    assert.equal(decoded[1], VALID_BZZ);
  });

  // Golden calldata verified against `cast calldata 'registerBoard(string,string)' 'hn' 'bzz://aaa...a'`
  it('golden calldata', () => {
    const data = encode.registerBoard({ slug: 'hn', boardRef: VALID_BZZ });
    assert.equal(
      data,
      '0x64874b98000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000002686e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000046627a7a3a2f2f616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161610000000000000000000000000000000000000000000000000000',
    );
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
// encode.announceSubmission
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

  it('throws on direction=2', () => {
    assert.throws(() => encode.setVote({ submissionRef: VALID_BZZ, direction: 2 }));
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

// ===========================================
// encode.declareUserFeed
// ===========================================

describe('encode.declareUserFeed', () => {
  const prefixedTopic = '0x' + 'aa'.repeat(32);
  const rawTopic = 'aa'.repeat(32); // Freedom Browser format
  const owner = VALID_ADDRESS;

  it('returns 0x-prefixed hex calldata', () => {
    const data = encode.declareUserFeed({ feedTopic: prefixedTopic, feedOwner: owner });
    assert.ok(data.startsWith('0x'));
  });

  it('can be decoded back via iface', () => {
    const data = encode.declareUserFeed({ feedTopic: prefixedTopic, feedOwner: owner });
    const decoded = iface.decodeFunctionData('declareUserFeed', data);
    assert.equal(decoded[0], prefixedTopic);
    assert.equal(decoded[1].toLowerCase(), owner.toLowerCase());
  });

  it('accepts raw 64-char hex topic (Freedom Browser format)', () => {
    const fromRaw = encode.declareUserFeed({ feedTopic: rawTopic, feedOwner: owner });
    const fromPrefixed = encode.declareUserFeed({ feedTopic: prefixedTopic, feedOwner: owner });
    assert.equal(fromRaw, fromPrefixed);
  });

  // Golden calldata verified against `cast calldata 'declareUserFeed(bytes32,address)' 0xaa...aa 0x7E5F...`
  it('golden calldata', () => {
    const data = encode.declareUserFeed({ feedTopic: prefixedTopic, feedOwner: owner });
    assert.equal(
      data,
      '0x79e80d8faaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000000000000000000000007e5f4552091a69125d5dfcb7b8c2659029395bdf',
    );
  });

  it('throws if feedTopic is missing', () => {
    assert.throws(() => encode.declareUserFeed({ feedOwner: owner }), /topic is required/);
  });

  it('throws if feedOwner is missing', () => {
    assert.throws(() => encode.declareUserFeed({ feedTopic: prefixedTopic }), /feedOwner is required/);
  });
});

// ===========================================
// encode.revokeUserFeed
// ===========================================

describe('encode.revokeUserFeed', () => {
  const feedId = '0x' + 'dd'.repeat(32);

  it('returns 0x-prefixed hex calldata', () => {
    const data = encode.revokeUserFeed({ feedId });
    assert.ok(data.startsWith('0x'));
  });

  it('can be decoded back via iface', () => {
    const data = encode.revokeUserFeed({ feedId });
    const decoded = iface.decodeFunctionData('revokeUserFeed', data);
    assert.equal(decoded[0], feedId);
  });

  // Golden calldata verified against `cast calldata 'revokeUserFeed(bytes32)' 0xdd...dd`
  it('golden calldata', () => {
    const data = encode.revokeUserFeed({ feedId });
    assert.equal(
      data,
      '0x74cbc378dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    );
  });

  it('throws if feedId is missing', () => {
    assert.throws(() => encode.revokeUserFeed({}), /feedId is required/);
  });
});
