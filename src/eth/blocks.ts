import * as r from 'rethinkdb';
import { IBlock } from '../types';
import { Context } from './app';
import { IEthBlock, IEthTransaction } from './eth-types';
import { or, important } from 'utils';

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

  ctx.logger.log(
    `ETH outdated on ${latestInChain - latestInDb} blocks (${latestInDb})`,
  );

  // TODO: backward check hashes
  // Syncing unkown blocks:
  await syncBlocks(ctx, latestInDb, latestInChain);
}

async function syncBlocks(ctx: Context, since: number, to: number) {
  // TODO: configure batch size with configuration
  const numOfBlocks = Math.min(
    to - since,
    parseInt(process.env.ETH_MAX_BLOCKS || '20'),
  );
  if (numOfBlocks) {
    const tasks = Array(numOfBlocks)
      .fill(0)
      .map((_, offset) => ctx.web3.eth.getBlock(since + 1 + offset, true));
    const blocks = await Promise.all(tasks);

    const nonTrxBlocks = blocks.map<IEthBlock>(block => ({
      version: 1,

      author: important(block.miner.toLowerCase(), 'miner is important'),
      difficulty: or(block.difficulty.toString(), '0'),
      gasLimit: or(block.gasLimit, 0),
      gasUsed: or(block.gasUsed, 0),
      hash: important(block.hash),
      height: important(block.number),
      logsBloom: or(
        block.logsBloom,
        '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        () => ctx.logger.war(`logsBloom not found in block ${block.number}`),
      ),
      parentHash: important(block.parentHash),
      receiptsRoot: or(
        block['receiptsRoot'],
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        () => ctx.logger.war(`receiptsRoot not found in block ${block.number}`),
      ),
      sha3Uncles: or(
        block.sha3Uncles,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        () => ctx.logger.war(`sha3uncles not found in block ${block.number}`),
      ),
      signature: or(
        block['signature'],
        '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        // () => ctx.logger.war(`signature not found in block ${block.number}`),
      ),
      size: or(block.size, 0),
      stateRoot: or(
        block.stateRoot,
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        () => ctx.logger.war(`stateRoot not found in block ${block.number}`),
      ),
      timestamp: important(block.timestamp),
      totalDifficulty: or(block.totalDifficulty.toString(), '0'),
      transactions: important(block.transactions).map(trx => trx.hash),
      transactionsRoot: or(
        block['transactionsRoot'],
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        () =>
          ctx.logger.war(`transactionsRoot not found in block ${block.number}`),
      ),
      uncles: or(block.uncles, []),
    }));

    const transactions = blocks
      .map(block => block.transactions.map(tx => ({ ...tx, block })))
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
        signature: trx.s + trx.r + trx.v || '',
        timestamp: trx.block.timestamp,
      }));

    if (transactions.length) {
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
