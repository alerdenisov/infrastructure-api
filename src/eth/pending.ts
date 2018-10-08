import { rpcCall } from './raw-rpc';
import { Context, TransactionModel } from './types';
import { InsertResult } from 'rethinkdb';

export async function run(ctx: Context) {
  const { result: transactions } = (await rpcCall(
    'parity_pendingTransactions',
  )) as {
    result: TransactionModel[];
  };

  if (transactions.length > 0) {
    const result = (await ctx.tables.trx
      .insert(<any>transactions, { conflict: 'error' })
      .run(ctx.connection)) as InsertResult<TransactionModel>;

    if (result.inserted > 0) {
      console.log(`New ${result.inserted} pending transactions`);
    }
  }
}
