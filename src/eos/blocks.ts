import * as r from 'rethinkdb';
import { Context } from './app';
import { BlockStateModel, BlockModel } from './models';
import { IEosBlock, IEosTransaction } from './types';

export async function run(ctx: Context) {
  const latestKnown = await r
    .branch(
      ctx.tables.blocks.isEmpty(),
      0,
      ctx.tables.blocks
        .max({ index: 'height' })('height')
        .coerceTo('number'),
    )
    .run(ctx.connection);

  const blocks = await BlockModel.find({ block_num: { $gt: latestKnown } })
    .limit(100)
    .exec();

  const eosBlocks = blocks.map<IEosBlock>(block => ({
    version: 1,

    author: block.block.producer,
    hash: block.block_id,
    height: block.block_num,
    parentHash: block.block.previous,
    timestamp: block.createdAt.getTime() / 1000,
    signature: block.block.producer_signature,
    transactions: block.block.transactions.map(tx => tx.trx.id),
    transactionsRoot: block.block.transaction_mroot,
  }));

  // const eosTrx = blocks
  //   .filter(block => block.block.transactions.length > 0)
  //   .map(block =>
  //     block.block.transactions.map(
  //       (trx, index) => ((trx.block = block), (trx.index = index), trx),
  //     ),
  //   )
  //   .reduce((flat, arr) => flat.concat(arr), [])
  //   .map<IEosTransaction>(trx => ({
  //     txHash: trx.trx.id,
  //     blockHash: trx.block.block_id,
  //     blockHeight: trx.block.block_num,
  //     input: trx.trx.packed_trx,
  //     recipient: trx.trx.transaction.actions[0].account,
  //     sender: trx.trx.transaction.actions[0].authorization[0].actor,
  //     signature: trx.trx.signatures.join(','),
  //     timestamp: trx.block.createdAt.getTime() / 1000,
  //     txIndex: trx.index,
  //   }));
  // console.log(eosTrx);

  // console.log(`EOS Blocks ${eosBlocks.length}`);

  await ctx.tables.blocks
    .insert(<any>eosBlocks, {
      conflict: 'replace',
    })
    .run(ctx.connection);

  // await ctx.tables.trx
  //   .insert(<any>eosTrx, {
  //     conflict: 'error',
  //   })
  // .run(ctx.connection);

  // console.log(
  //   blocks.reduce(
  //     (sum, block) => ((sum += block.block.transactions.length), sum),
  //     0,
  //   ),
  // );

  // console.log(
  //   blocks
  //     .filter(block => block.block.transactions.length)
  //     .map(block => block.block.transactions)
  //     .reduce((flat, arr) => flat.concat(arr), []),
  // );
}
