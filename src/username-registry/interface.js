/**
 * ethers Interface instance + event topic hashes for the username registry.
 */

import { Interface } from 'ethers';
import { ABI } from './abi.js';

export const iface = new Interface(ABI);

export const TOPICS = {
  UsernameClaimed: iface.getEvent('UsernameClaimed').topicHash,
  PrimaryNameSet: iface.getEvent('PrimaryNameSet').topicHash,
  Transfer: iface.getEvent('Transfer').topicHash,
};
