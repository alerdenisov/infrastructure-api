import * as r from 'rethinkdb';
import { IBlock } from '../types';
import { Context } from './app';
import { IEthBlock, IEthTransaction } from './eth-types';

export async function run(ctx: Context) {
  const latestInDb = await r
    .branch(
      ctx.tables.blocks.isEmpty(),
      0,
      ctx.tables.blocks
        .max({ index: 'height' })('height')
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
    // export interface BlockHeader {
    // 	number: number;
    // 	hash: string;
    // 	parentHash: string;
    // 	nonce: string;
    // 	sha3Uncles: string;
    // 	logsBloom: string;
    // 	transactionRoot: string;
    // 	stateRoot: string;
    // 	receiptRoot: string;
    // 	miner: string;
    // 	extraData: string;
    // 	gasLimit: number;
    // 	gasUsed: number;
    // 	timestamp: number;
    // }
    // export interface Block extends BlockHeader {
    // 	transactions: Transaction[];
    // 	size: number;
    // 	difficulty: number;
    // 	totalDifficulty: number;
    // 	uncles: string[];
    // }
    const nonTrxBlocks = blocks.map<IEthBlock>(block => ({
      version: 1,

      author: block.miner.toLowerCase(),
      difficulty: block.difficulty.toString(),
      gasLimit: block.gasLimit,
      gasUsed: block.gasUsed,
      hash: block.hash,
      height: block.number,
      logsBloom: block.logsBloom,
      parentHash: block.parentHash,
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

    const transactions = blocks
      .map(block => block.transactions)
      .reduce((flat, map) => flat.concat(map), [])
      .map<IEthTransaction>(trx => ({
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
        timestamp: 0,
      }));

    if (transactions.length) {
      console.log(`Insert ${transactions.length} new transactions`);
      await ctx.tables.trx
        .insert(<any>transactions, { conflict: 'update' })
        .run(ctx.connection);
    }

    await ctx.tables.blocks
      .insert(<any>nonTrxBlocks, {
        conflict: 'error',
      })
      .run(ctx.connection);
  }
}
