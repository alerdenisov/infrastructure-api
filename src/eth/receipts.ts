import { Context, TransactionModel } from './types';
import * as r from 'rethinkdb';

export async function run(ctx: Context) {
  const timedTransactions = await ctx.tables.trx
    .filter(doc =>
      r.and(
        doc('timestamp')
          .default(0)
          .eq(0),
        doc('blockNumber')
          .default(0)
          .gt(0),
      ),
    )
    .map<TransactionModel & { timestamp: number }>(doc =>
      doc.merge<TransactionModel & { timestamp: number }>({
        timestamp: ctx.tables.blocks.get(doc('blockNumber'))('timestamp'),
      } as any),
    )
    .limit(10)
    .run(ctx.connection)
    .then(cursor => cursor.toArray());

  const timedAndReceiptTransactions = await Promise.all(
    timedTransactions.map(tx =>
      ctx.web3.eth.getTransactionReceipt(tx.hash).then(receipt => ({
        ...tx,
        ...receipt,
      })),
    ),
  );

  await ctx.tables.trx
    .insert(<any>timedAndReceiptTransactions, { conflict: 'update' })
    .run(ctx.connection);
}
