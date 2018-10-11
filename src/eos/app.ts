import * as mongoose from 'mongoose';
import * as r from 'rethinkdb';
import {
  getOrCreateDatabase,
  checkOrCreateSimpleIndex,
  getOrCreateTable,
} from 'utils';
import config from '../config';
import { IEosTrace, IEosTransaction, IEosBlock } from './types';
import { run as blocksRun } from './blocks';
import { run as transactionsRun } from './transactions';
import { run as tracesRun } from './traces';

export interface Context {
  connection: r.Connection;
  tables: {
    trx: r.RTable<IEosTransaction>;
    blocks: r.RTable<IEosBlock>;
    traces: r.RTable<IEosTrace>;
  };
  db: r.RDb;
}

async function setup(): Promise<Context> {
  await mongoose.connect(`mongodb://localhost:27017/EOS`);
  const connection = await r.connect({
    host: config.rethinkdb.host,
    port: config.rethinkdb.port,
  });
  const db = await getOrCreateDatabase('eos', connection);
  const blocks = await getOrCreateTable<IEosBlock>(connection, db, 'blocks', {
    primaryKey: 'height',
  });
  const trx = await getOrCreateTable<IEosTransaction>(
    connection,
    db,
    'transactions',
    {
      primaryKey: 'txHash',
    },
  );

  const traces = await getOrCreateTable<IEosTrace>(
    connection,
    db,
    'traces',
    {},
  );

  await checkOrCreateSimpleIndex(connection, trx, 'blockHash');
  await checkOrCreateSimpleIndex(connection, trx, 'blockHeight');
  await checkOrCreateSimpleIndex(connection, trx, 'sender');
  await checkOrCreateSimpleIndex(connection, trx, 'recipient');
  await checkOrCreateSimpleIndex(connection, trx, 'timestamp');

  await checkOrCreateSimpleIndex(connection, blocks, 'parentHash');
  await checkOrCreateSimpleIndex(connection, blocks, 'timestamp');
  await checkOrCreateSimpleIndex(connection, blocks, 'author');
  await checkOrCreateSimpleIndex(connection, blocks, 'hash');

  await checkOrCreateSimpleIndex(connection, traces, 'txHash');

  return {
    connection,
    tables: {
      blocks,
      trx,
      traces,
    },
    db,
  };
}

const tasks = {
  blocksRun,
  transactionsRun,
  tracesRun,
};

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
      ctx = await setup();
    }
  } // console.log(await web3.eth.getBlock(1));
}
