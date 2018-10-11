import * as r from 'rethinkdb';
import Web3 = require('web3');

export type Address = string;
export type Hash = string;
export type StringNumber = string;
export type HexNumber = string;
export type Binary = string;

export interface IMeta {
  version: number;
  meta?: any;
}

export interface IBlock extends IMeta {
  hash: Hash;
  parentHash: Hash;
  height: number;
  signature: Binary;
  timestamp: number;
  author: Address;
  transactionsRoot: Hash;
  transactions: Array<Hash>;
}

export interface ITransaction extends IMeta {
  txHash: Hash;
  blockHash: Hash;
  blockHeight: number;
  txIndex: number;
  signature: Binary;
  input: Binary;
  from: Address[];
  to: Address[];
  timestamp: number;
}

export interface ITrace extends IMeta {
  id: Hash;
  type: string;
  txHash: Hash;
  from: Address[];
  to: Address[];
  input: Binary;
  trace: number[];
  timestamp: number;
  parsed: any;
}

// export interface TransactionModel {
//   hash: string;
//   nonce: number;
//   blockHash: string;
//   blockNumber: number;
//   transactionIndex: number;
//   from: string;
//   to: string;
//   value: string;
//   gasPrice: string;
//   gas: number;
//   input: string;
//   v?: string;
//   r?: string;
//   s?: string;
// }

// export interface BlockModel {
//   author: Address;
//   difficulty: StringNumber;
//   extraData: Binary;
//   gasLimit: number;
//   gasUsed: number;
//   hash: Hash;
//   logsBloom: Binary;
//   number: number;
//   parentHash: Hash;
//   receiptsRoot: Hash;
//   sha3Uncles: Hash;
//   signature: Binary;
//   size: number;
//   stateRoot: Hash;
//   timestamp: Number;
//   totalDifficulty: StringNumber;
//   transactions: Array<Hash>;
//   transactionsRoot: Hash;
//   uncles: Array<Hash>;
// }

// export type TraceModel = any & {
//   transactionHash: Hash;
// };
