import * as r from 'rethinkdb';
import { Context, TransactionModel, BlockModel } from '../types';

export async function run(ctx: Context) {
  const latestInDb = await r
    .branch(
      ctx.tables.blocks.isEmpty(),
      0,
      ctx.tables.blocks
        .max({ index: 'number' })('number')
        .coerceTo('number'),
    )
    .run(ctx.connection);

  const latestInChain = await ctx.web3.eth.getBlockNumber();

  // TODO: backward check hashes
  // Syncing unkown blocks:
  await syncBlocks(ctx, latestInDb, latestInChain);
}

async function syncBlocks(ctx: Context, since: number, to: number) {
  // TODO: configure batch size with configuration
  const numOfBlocks = Math.min(to - since, 20);
  if (numOfBlocks) {
    const tasks = Array(numOfBlocks)
      .fill(0)
      .map((_, offset) => ctx.web3.eth.getBlock(since + 1 + offset, true));
    const blocks = await Promise.all(tasks);

    console.log(
      `Got ${blocks.length} new blocks (from height ${since} to ${since +
        numOfBlocks})`,
    );

    // TODO: DUXI IT
    const nonTrxBlocks = blocks.map<BlockModel>(block => ({
      author: block.miner.toLowerCase(),
      difficulty: block.difficulty.toString(),
      extraData: block.extraData,
      gasLimit: block.gasLimit,
      gasUsed: block.gasUsed,
      hash: block.hash,
      parentHash: block.parentHash,
      logsBloom: block.logsBloom,
      number: block.number,
      receiptsRoot: <any>block['receiptsRoot'],
      sha3Uncles: block.sha3Uncles,
      signature: <any>block['signature'],
      size: block.size,
      stateRoot: block.stateRoot,
      timestamp: block.timestamp,
      totalDifficulty: block.totalDifficulty.toString(),
      transactions: block.transactions.map(trx => trx.hash),
      transactionsRoot: <any>block['transactionsRoot'],
      uncles: block.uncles,
    }));

    await ctx.tables.blocks
      .insert(<any>nonTrxBlocks, {
        conflict: 'error',
      })
      .run(ctx.connection);

    const transactions = blocks
      .map(block => block.transactions)
      .reduce((flat, map) => flat.concat(map), [])
      .map<TransactionModel>(trx => ({
        ...trx,
      }));

    if (transactions.length) {
      console.log(`Insert ${transactions.length} new transactions`);
      await ctx.tables.trx
        .insert(<any>transactions, { conflict: 'update' })
        .run(ctx.connection);
    }
  }
}
