import * as r from 'rethinkdb';
import Web3 = require('web3');

export type Address = string;
export type Hash = string;
export type StringNumber = string;
export type Binary = string;

export interface TransactionModel {
  hash: string;
  nonce: number;
  blockHash: string;
  blockNumber: number;
  transactionIndex: number;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gas: number;
  input: string;
  v?: string;
  r?: string;
  s?: string;
}

export interface BlockModel {
  author: Address;
  difficulty: StringNumber;
  extraData: Binary;
  gasLimit: number;
  gasUsed: number;
  hash: Hash;
  logsBloom: Binary;
  number: number;
  parentHash: Hash;
  receiptsRoot: Hash;
  sha3Uncles: Hash;
  signature: Binary;
  size: number;
  stateRoot: Hash;
  timestamp: Number;
  totalDifficulty: StringNumber;
  transactions: Array<Hash>;
  transactionsRoot: Hash;
  uncles: Array<Hash>;
}

export type TraceModel = any & {
  transactionHash: Hash;
};

export interface Context {
  connection: r.Connection;
  tables: {
    trx: r.RTable<TransactionModel>;
    blocks: r.RTable<BlockModel>;
    traces: r.RTable<TraceModel>;
  };
  db: r.RDb;
  web3: Web3;
}
