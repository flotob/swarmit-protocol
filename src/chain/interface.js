/**
 * ethers Interface instance + event topic hashes.
 * Consumers use `iface.parseLog(log)` for decoding and `TOPICS[eventName]` for filtering.
 */

import { Interface, ZeroHash } from 'ethers';
import { ABI } from './abi.js';

export const iface = new Interface(ABI);

export const TOPICS = {
  BoardRegistered: iface.getEvent('BoardRegistered').topicHash,
  BoardMetadataUpdated: iface.getEvent('BoardMetadataUpdated').topicHash,
  SubmissionAnnounced: iface.getEvent('SubmissionAnnounced').topicHash,
  CuratorDeclared: iface.getEvent('CuratorDeclared').topicHash,
  VoteSet: iface.getEvent('VoteSet').topicHash,
};

export { ZeroHash as BYTES32_ZERO };
