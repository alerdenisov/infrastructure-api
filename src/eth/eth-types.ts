import {
  IBlock,
  StringNumber,
  HexNumber,
  Address,
  Binary,
  Hash,
  ITransaction,
  ITrace,
  IMeta,
} from 'types';

export interface IEthLog extends IMeta {
  id: string;
  address: Address;
  blockHash: Hash;
  blockHeight: number;
  data: Binary;
  logIndex: number;
  topics: Binary[];
  txHash: Hash;
  txIndex: number;
  txLogIndex: HexNumber;
  type: string;
}

export interface IEthBlock extends IBlock {
  difficulty: StringNumber;
  totalDifficulty: StringNumber;
  gasLimit: number;
  gasUsed: number;
  logsBloom: Binary;
  receiptsRoot: Hash;
  sha3Uncles: Hash;
  size: number;
  stateRoot: Hash;
  uncles: Array<Hash>;
}

export interface IEthTransaction extends ITransaction {
  nonce: number;
  gasPrice: string;
  gas: number;
}

export interface CallResult {
  gasUsed: HexNumber;
  output: Binary;
}

export interface CreateResult {
  address: Address;
  code: Binary;
  gasUsed: HexNumber;
}

export interface IEthTrace extends ITrace {
  type: string;
  result: CallResult | CreateResult;
}
