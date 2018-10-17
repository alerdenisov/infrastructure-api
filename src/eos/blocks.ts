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

  await ctx.tables.blocks
    .insert(<any>eosBlocks, {
      conflict: 'replace',
    })
    .run(ctx.connection);
}
