import Web3 = require('web3');
import * as r from 'rethinkdb';
import { run as blocksRun } from './blocks';
import { run as transactionsRun } from './transactions';
import { run as pendingRun } from './pending';
import { run as tracesRun } from './traces';
import { run as receiptsRun } from './receipts';
import { run as parseRun } from './parse';
import {
  getOrCreateDatabase,
  checkOrCreateSimpleIndex,
  getOrCreateTable,
} from 'utils';
import config from '../config';
import { WebsocketProvider } from 'web3/providers';
import { IEthTransaction, IEthBlock, IEthTrace, IEthLog } from './eth-types';

const tasks = {
  blocksRun,
  transactionsRun,
  pendingRun,
  tracesRun,
  receiptsRun,
  parseRun,
};

export interface Context {
  connection: r.Connection;
  tables: {
    trx: r.RTable<IEthTransaction>;
    blocks: r.RTable<IEthBlock>;
    traces: r.RTable<IEthTrace>;
    logs: r.RTable<IEthLog>;
  };
  db: r.RDb;
  web3: Web3;
}

async function setup(): Promise<Context> {
  const provider = new Web3.providers.WebsocketProvider(
    process.env.ETH_WEBSOCKER_URI,
  );
  const web3 = new Web3(provider);

  const connection = await r.connect({
    host: config.rethinkdb.host,
    port: config.rethinkdb.port,
  });
  const db = await getOrCreateDatabase('eth', connection);
  const blocks = await getOrCreateTable<IEthBlock>(connection, db, 'blocks', {
    primaryKey: 'height',
  });
  const trx = await getOrCreateTable<IEthTransaction>(
    connection,
    db,
    'transactions',
    {
      primaryKey: 'txHash',
    },
  );

  const traces = await getOrCreateTable<IEthTrace>(
    connection,
    db,
    'traces',
    {},
  );

  const logs = await getOrCreateTable<IEthLog>(connection, db, 'logs', {
    primaryKey: 'id',
  });

  await checkOrCreateSimpleIndex(
    connection,
    blocks,
    'txCount',
    r.row('transactions').count(),
  );

  await checkOrCreateSimpleIndex(connection, trx, 'blockHash');
  await checkOrCreateSimpleIndex(connection, trx, 'blockHeight');
  await checkOrCreateSimpleIndex(connection, trx, 'from', {
    multi: true,
  });
  await checkOrCreateSimpleIndex(connection, trx, 'to', {
    multi: true,
  });
  await checkOrCreateSimpleIndex(connection, trx, 'timestamp');

  await checkOrCreateSimpleIndex(connection, blocks, 'parentHash');
  await checkOrCreateSimpleIndex(connection, blocks, 'timestamp');
  await checkOrCreateSimpleIndex(connection, blocks, 'author');
  await checkOrCreateSimpleIndex(connection, blocks, 'hash');

  await checkOrCreateSimpleIndex(connection, traces, 'txHash');
  await checkOrCreateSimpleIndex(
    connection,
    traces,
    'from',
    r.row('from').downcase(),
    { multi: true },
  );

  await checkOrCreateSimpleIndex(
    connection,
    traces,
    'to',
    r.row('to').downcase(),
    { multi: true },
  );

  await checkOrCreateSimpleIndex(connection, logs, 'address');
  await checkOrCreateSimpleIndex(connection, logs, 'txHash');
  await checkOrCreateSimpleIndex(connection, logs, 'blockHash');
  await checkOrCreateSimpleIndex(
    connection,
    logs,
    'involved',
    r.row('involved').map(a => a.downcase()),
    { multi: true },
  );

  return {
    connection,
    tables: {
      blocks,
      trx,
      traces,
      logs,
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
}
