import { Context } from './app';
import * as r from 'rethinkdb';
import { IEthTransaction } from './eth-types';

export async function run(ctx: Context) {
  const timedTransactions = await ctx.tables.trx
    .getAll(0, { index: 'timestamp' })
    .map<IEthTransaction>(doc =>
      doc.merge<IEthTransaction>({
        timestamp: ctx.tables.blocks.get(doc('blockHeight'))('timestamp'),
      } as any),
    )
    .limit(10)
    .run(ctx.connection)
    .then(cursor => cursor.toArray());

  const timedAndReceiptTransactions = await Promise.all(
    timedTransactions.map(tx =>
      ctx.web3.eth
        .getTransactionReceipt(tx.txHash)
        .then(receipt =>
          ctx.tables.logs
            .insert(
              <any>receipt.logs.map(log => ({
                version: 1,

                id: <any>log['id'],
                address: log.address,
                blockHash: log.blockHash,
                blockHeight: log.blockNumber,
                data: log.data,
                logIndex: log.logIndex,
                topics: log.topics,
                txHash: log.transactionHash,
                txIndex: log.transactionIndex,
                txLogIndex: <any>log['transactionLogIndex'],
                type: <any>log['type'],
              })),
              {
                conflict: 'error',
              },
            )
            .run(ctx.connection)
            .then(_ => receipt),
        )
        .then(receipt => {
          tx.meta = tx.meta || {};
          tx.meta.gasUsed = receipt.gasUsed;
          tx.meta.cumulativeGasUsed = receipt.cumulativeGasUsed;
          tx.meta.logs = receipt.logs.map(log => <any>log['id']);
          tx.meta.status = receipt.status;
          return tx;
        }),
    ),
  );

  await ctx.tables.trx
    .insert(<any>timedAndReceiptTransactions, { conflict: 'update' })
    .run(ctx.connection);
}
