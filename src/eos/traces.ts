import * as r from 'rethinkdb';
import { Context } from './app';
import { TransactionTraceModel } from './models';
import { IEosTransaction, IEosTrace } from './types';
import { TransactionActionTrace } from './models/transaction-trace';

let stream: r.CursorResult<any>;
let cachedConnection: r.Connection;

function flatRecursive(
  path: number[],
  branch: TransactionActionTrace,
): IEosTrace[] {
  let result: IEosTrace[] = [];
  if (Array.isArray(branch.inline_traces) && branch.inline_traces.length) {
    branch.inline_traces.map((b, index) => {});
    result = result.concat(
      branch.inline_traces
        .map((b, index) => flatRecursive(path.concat([index]), b))
        .reduce((flat, arr) => flat.concat(arr), []),
    );
  }

  result.push({
    from: branch.act.authorization.map(auth => auth.actor),
    to: [branch.act.account],
    timestamp: new Date(branch.block_time).getTime() / 1000,
    txHash: branch.trx_id,
    trace: path,
    parsed: branch.act,
    input: branch.receipt.act_digest,
    type: 'call',
    id: branch.trx_id + path.join(''),
    authorization: branch.act.authorization,
    console: branch.console,

    version: 1,
  });
  return result;
}

export async function run(ctx: Context) {
  if (!stream || cachedConnection != ctx.connection) {
    stream = await ctx.tables.trx
      .changes({ includeInitial: true, squash: 1 })
      .map(x => <any>x('new_val')('txHash'))
      .filter(doc =>
        ctx.tables.traces.getAll(doc, { index: 'txHash' }).isEmpty(),
      )
      .run(ctx.connection);

    cachedConnection = ctx.connection;
    stream.each(async (_, hash) => {
      console.log(`New transaction ${hash}`);
      const trace = await TransactionTraceModel.findOne({ id: hash }).exec();
      // const root = trace.action_traces;
      const traces = trace.action_traces.map((t, index) =>
        flatRecursive([index], t),
      );
      // console.log(JSON.stringify(traces, null, 2));

      //   const tx = await TransactionModel.findOne({ trx_id: hash }).exec();
      //   const block = await BlockModel.findOne({
      //     block_num: trace.block_num,
      //   }).exec();

      //   const eosTx: IEosTransaction = {
      //     txHash: trace.id,
      //     txIndex: 0, // TODO: find proper index in block
      //     blockHeight: trace.block_num,
      //     blockHash: block.block_id,
      //     sender: trace.action_traces[0].act.authorization[0].actor,
      //     recipient: trace.action_traces[0].act.account,
      //     signature: tx.signatures[0],
      //     timestamp: block.createdAt.getTime() / 1000,
      //     input: tx.actions[0].data,
      //   };

      //   await ctx.tables.trx
      //     .insert(<any>eosTx, { conflict: 'update' })
      //     .run(ctx.connection);
    });
  }
}
