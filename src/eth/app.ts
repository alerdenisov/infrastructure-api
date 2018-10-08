import Web3 = require('web3');
import * as r from 'rethinkdb';
import { run as loadBlocks } from './blocks';
import { run as loadPending } from './pending';
import { run as loadTraces } from './traces';
import { run as loadReceipts } from './receipts';
import { TransactionModel, BlockModel, Context, TraceModel } from '../types';
import {
  getOrCreateDatabase,
  checkOrCreateSimpleIndex,
  getOrCreateTable,
} from 'utils';
import config from '../config';
import { WebsocketProvider } from 'web3/providers';

const tasks = {
  loadBlocks,
  loadPending,
  loadTraces,
  loadReceipts,
};

async function setup(): Promise<Context> {
  const provider = new Web3.providers.WebsocketProvider('ws://localhost:8546');
  const web3 = new Web3(provider);
  const connection = await r.connect({
    host: config.rethinkdb.host,
    port: config.rethinkdb.port,
  });
  const db = await getOrCreateDatabase(config.rethinkdb.database, connection);
  // TODO: parametrize table name
  const blocks = await getOrCreateTable<BlockModel>(connection, db, 'blocks', {
    primaryKey: 'number', // block height in Ethereum Network
  });
  const trx = await getOrCreateTable<TransactionModel>(
    connection,
    db,
    'transactions',
    {
      primaryKey: 'hash', // block height in Ethereum Network
    },
  );

  const traces = await getOrCreateTable<TraceModel>(connection, db, 'traces', {
    primaryKey: 'transactionHash',
  });

  await checkOrCreateSimpleIndex(connection, trx, 'blockHash');
  await checkOrCreateSimpleIndex(connection, trx, 'blockNumber');
  await checkOrCreateSimpleIndex(connection, trx, 'from');
  await checkOrCreateSimpleIndex(connection, trx, 'to');

  await checkOrCreateSimpleIndex(connection, blocks, 'parentHash');
  await checkOrCreateSimpleIndex(connection, blocks, 'timestamp');
  await checkOrCreateSimpleIndex(connection, blocks, 'author');
  await checkOrCreateSimpleIndex(connection, blocks, 'hash');

  return {
    connection,
    tables: {
      blocks,
      trx,
      traces,
    },
    db,
    web3,
  };
}
export async function run() {
  // TODO: setup provider from providen configuration

  let ctx = await setup();

  while (true) {
    try {
      await Promise.all(Object.values(tasks).map(f => f(ctx)));
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.log(e);
      await ctx.connection.close();
      await (<any>(
        (ctx.web3.currentProvider as WebsocketProvider).connection
      )).close();

      ctx = await setup();
    }
  }
  // console.log(await web3.eth.getBlock(1));
}
