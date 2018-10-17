import {
  IBlock,
  StringNumber,
  HexNumber,
  Address,
  Binary,
  Hash,
  ITransaction,
  ITrace,
  ILog,
  IMeta,
} from 'types';

export interface IEthLog extends ILog {
  address: Address;
  topics: Binary[];
  txLogIndex: HexNumber;
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
  receipts?: number;
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
  raw: any;
  type: string;
  result: CallResult | CreateResult;
}
