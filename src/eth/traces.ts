import { rpcCall } from './raw-rpc';
import { Context } from './app';
import { IEthTrace } from './eth-types';

export async function run(ctx: Context) {
  const untracedBlocks = await ctx.tables.trx
    .filter(transaction => transaction.hasFields('blockHeight'))
    .filter(transactions =>
      ctx.tables.traces
        .getAll(transactions<string>('txHash'), { index: 'txHash' })
        .isEmpty(),
    )
    .map(tx => ctx.tables.blocks.get(tx('blockHeight')))
    .limit(10)
    .distinct()
    .run(ctx.connection)
    .then(cursor => cursor.toArray());

  if (untracedBlocks.length > 0) {
    console.log(`Untraces blocks ${untracedBlocks.length}`);

    const traces = await Promise.all(
      untracedBlocks.map(block =>
        rpcCall('trace_block', ctx.web3.utils.toHex(block.height)).then(r =>
          r.result.map(r => ((r.block = block), r)),
        ),
      ),
    )
      .then(x => (console.log(x), x))
      .then(results =>
        results.reduce((flat, current) => flat.concat(current), []),
      )
      .then(flat =>
        flat.filter(el => el.transactionHash && el.type !== 'reward'),
      )
      .then(flat =>
        flat.map(
          r =>
            ({
              version: 1,

              from: [r.action.from],
              to: [r.type === 'call' ? r.action.to : '0x0'],
              input: r.type === 'call' ? r.action.input : r.action.init,
              timestamp: r.block.timestamp,
              result: r.result,
              type: r.type,
              txHash: r.transactionHash,
              trace: r.traceAddress,
              id: r.transactionHash + r.traceAddress,
            } as IEthTrace),
        ),
      );

    if (traces.length > 0) {
      console.log(`New traces for ${traces.length} transactions`);
      console.log(JSON.stringify(traces, null, 2));
      await ctx.tables.traces.insert(<any>traces).run(ctx.connection);
    }
  }
}
