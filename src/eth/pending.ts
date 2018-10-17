import { rpcCall } from './raw-rpc';
import { Context } from './app';
import { InsertResult } from 'rethinkdb';
import { IEthTransaction } from './eth-types';

export async function run(ctx: Context) {
  const { result: transactions } = (await rpcCall(
    'parity_pendingTransactions',
  )) as {
    result: any[];
  };

  if (transactions.length > 0) {
    ctx.logger.log(`Pending trx ${transactions.length}`);
    await ctx.tables.trx
      .insert(
        <any>transactions.map<IEthTransaction>(trx => ({
          version: 1,

          blockHash: trx.blockHash,
          blockHeight: trx.blockNumber,
          gas: trx.gas,
          gasPrice: trx.gasPrice,
          txHash: trx.hash,
          txIndex: trx.transactionIndex,
          input: trx.input,
          nonce: trx.nonce,
          to: [trx.to],
          from: [trx.from],
          signature: trx.s + trx.r + trx.v,
          timestamp: -1,
        })),
        { conflict: 'error' },
      )
      .run(ctx.connection);
  }
}
