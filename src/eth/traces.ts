import { rpcCall } from './raw-rpc';
import { Context } from '../types';

function toTraceTree(traces: any[]) {
  const tree = {} as any;
  traces.forEach(trace => {
    const path = trace.traceAddress;
    const branch = path.length
      ? path.reduce((b, index) => {
          if (typeof b.children === 'undefined') {
            b.children = [];
          }

          if (typeof b.children[index] === 'undefined') {
            b.children[index] = {};
          }

          return b.children[index];
        }, tree)
      : tree;
    branch.data = {
      action: { ...trace.action },
      result: { ...trace.result },
      type: trace.type,
    };
  });

  return tree;
}

export async function run(ctx: Context) {
  const untracedBlocks = await ctx.tables.trx
    .filter(transaction => transaction.hasFields('blockNumber'))
    .filter(transactions =>
      ctx.tables.traces.getAll(transactions<string>('hash')).isEmpty(),
    )
    .limit(10)<string>('blockNumber')
    .distinct()
    .run(ctx.connection)
    .then(cursor => cursor.toArray());

  if (untracedBlocks.length > 0) {
    console.log(`Untraces blocks ${untracedBlocks.length}`);
  }

  const traces = await Promise.all(
    untracedBlocks.map(
      hash =>
        rpcCall('trace_block', ctx.web3.utils.toHex(hash)).then(r => r.result), //, ['trace', 'vmTrace']),
    ),
  )
    .then(results =>
      results.reduce((flat, current) => flat.concat(current), []),
    )
    .then(flat => flat.filter(el => el.transactionHash && el.type !== 'reward'))
    .then(flat =>
      flat.reduce((dictionary, element) => {
        const arr = dictionary[element.transactionHash] || [];
        arr.push(element);
        dictionary[element.transactionHash] = arr;
        return dictionary;
      }, {}),
    )
    .then(dict => {
      return Object.keys(dict).map(hash => {
        const traces = dict[hash];
        const { blockHash, transactionHash, blockNumber } = traces[0];
        const tree = toTraceTree(dict[hash]);
        return {
          blockHash,
          transactionHash,
          blockNumber,
          tree,
        };
      });
    });

  if (traces.length > 0) {
    console.log(`New traces for ${traces.length} transactions`);
    console.log(JSON.stringify(traces, null, 2));

    await ctx.tables.traces.insert(<any>traces).run(ctx.connection);
  }
}
