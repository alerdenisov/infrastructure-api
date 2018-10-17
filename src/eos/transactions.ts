import * as r from 'rethinkdb';
import { Context } from './app';
import {
  TransactionTrace,
  TransactionTraceModel,
  BlockModel,
  TransactionModel,
} from './models';
import { IEosTransaction } from './types';
import { unique } from 'utils';

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
    stream.each(async (_, hash) => {
      const trace = await TransactionTraceModel.findOne({ id: hash }).exec();
      const tx = await TransactionModel.findOne({ trx_id: hash }).exec();
      const block = await BlockModel.findOne({
        block_num: trace.block_num,
      }).exec();

      const eosTx: IEosTransaction = {
        version: 1,

        txHash: trace.id,
        txIndex: 0, // TODO: find proper index in block
        blockHeight: trace.block_num,
        blockHash: block.block_id,
        from: unique(
          trace.action_traces
            .map(x => x.act.authorization.map(y => y.actor))
            .reduce((flat, arr) => flat.concat(arr), []),
        ),
        to: unique(trace.action_traces.map(x => x.act.account)),
        signature: tx.signatures[0],
        timestamp: block.createdAt.getTime() / 1000,
        input: tx.actions[0].data,
      };

      await ctx.tables.trx
        .insert(<any>eosTx, { conflict: 'update' })
        .run(ctx.connection);
    });
  }
}
