import * as r from 'rethinkdb';
import { rpcCall } from './raw-rpc';
import { Context } from './app';
import { IEthTrace, IEthBlock } from './eth-types';

const getInput = (r: any): string => {
  switch (r.type) {
    case 'call':
      return r.action.input;
    case 'create':
      return r.action.init;
    case 'suicide':
      return '0x0';
  }
  throw new Error(`unknown trace type ${r.type}`);
};
const getTo = (r: any, tx?: any): string[] => {
  switch (r.type) {
    case 'call':
      return [r.action.to];
    case 'suicide':
      return [r.action.refundAddress];
    case 'create':
      return ['0x0'];
  }
  throw new Error(`unknown trace type ${r.type}`);
};
const getFrom = (r: any): string[] => {
  switch (r.type) {
    case 'call':
    case 'create':
      return [r.action.from];
    case 'suicide':
      return [r.action.address];
  }
  throw new Error(`unknown trace type ${r.type}`);
};

export async function run(ctx: Context) {
  const untracedBlocks = await ctx.tables.trx
    .between(1, r.maxval, { index: 'blockHeight' })
    .filter(tx =>
      ctx.tables.traces
        .getAll(tx<string>('txHash'), { index: 'txHash' })
        .isEmpty(),
    )
    .map(tx => ctx.tables.blocks.get(tx('blockHeight')))
    .limit(10)
    .distinct()
    .run(ctx.connection)
    .then(cursor => cursor.toArray());

  if (untracedBlocks.length > 0) {
    const traces = await Promise.all(
      untracedBlocks.map(block =>
        rpcCall('trace_block', ctx.web3.utils.toHex(block.height)).then(r =>
          r.result.map(r => ((r.block = block), r)),
        ),
      ),
    )
      .then((results: Array<{ block: IEthBlock; [key: string]: any }>) =>
        results.reduce((flat, current) => flat.concat(current), []),
      )
      .then((flat: any[]) =>
        flat.filter(el => el.transactionHash && el.type !== 'reward'),
      )
      .then((flat: any[]) =>
        flat.map<IEthTrace>(r => ({
          raw: {
            ...r,
            block: null,
          },
          meta: {},
          version: 2,
          from: getFrom(r),
          to: getTo(r),
          input: getInput(r),
          timestamp: r.block.timestamp,
          result: r.result || {},
          type: r.type,
          txHash: r.transactionHash,
          trace: r.traceAddress,
          parsed: {},
          id: r.transactionHash + r.traceAddress,
          blockHash: r.block.hash,
          blockHeight: r.block.height,
        })),
      );

    if (traces.length > 0) {
      ctx.logger.log(
        `New traces for ${traces.length} transactions (${new Date(
          traces[0].timestamp * 1000,
        )}) `,
      );
      try {
        await ctx.tables.traces.insert(<any>traces).run(ctx.connection);
      } catch (e) {
        console.log(
          JSON.stringify(traces.filter(t => t.type === 'suicide'), null, 2),
        );
        console.log(e);
      }
    }
  }
}
