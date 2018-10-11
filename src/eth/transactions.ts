import * as r from 'rethinkdb';
import { Context } from './app';
import { IEthBlock, IEthTransaction } from './eth-types';

let stream: r.CursorResult<any>;
let cachedConnection: r.Connection;

export async function run(ctx: Context) {
  if (!stream || cachedConnection != ctx.connection) {
    stream = await ctx.tables.blocks
      .changes({ includeInitial: true, squash: 1 })
      .map(x => <any>x('new_val'))
      .concatMap(x => <any>x('transactions'))
      .filter(doc => ctx.tables.trx.getAll(doc).isEmpty())
      .run(ctx.connection);
    cachedConnection = ctx.connection;
    stream.each(async (_, el) => {
      console.log('unknown tx: ', el);
      const tx = await ctx.web3.eth
        .getTransaction(el)
        .then(
          trx =>
            ({
              blockHash: trx.blockHash,
              blockHeight: trx.blockNumber,
              gas: trx.gas,
              gasPrice: trx.gasPrice,
              txHash: trx.hash,
              txIndex: trx.transactionIndex,
              input: trx.input,
              nonce: trx.nonce,
              recipient: trx.to,
              sender: trx.from,
              signature: trx.s + trx.r + trx.v,
              timestamp: 0,
            } as IEthTransaction),
        )
        .then(ethTx =>
          ctx.tables.trx
            .insert(ethTx, { conflict: 'replace' })
            .run(ctx.connection),
        );
    });
  }
}
