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

export interface IEosBlock extends IBlock {}

export interface IEosTransaction extends ITransaction {}

export interface IEosTrace extends ITrace {
  authorization: Array<{ actor: Address; permission: string }>;
  // elapsed: number;
  // cpu_usage: number;
  console: string;
  // totalcpu_usage: number;
}
