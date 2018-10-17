import Web3 = require('web3');
import * as r from 'rethinkdb';
import chalk from 'chalk';
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
  blk: blocksRun,
  trx: transactionsRun,
  pen: pendingRun,
  trc: tracesRun,
  rec: receiptsRun,
  par: parseRun,
};

export interface Context {
  app: string;
  connection: r.Connection;
  tables: {
    trx: r.RTable<IEthTransaction>;
    blocks: r.RTable<IEthBlock>;
    traces: r.RTable<IEthTrace>;
    logs: r.RTable<IEthLog>;
  };
  logger: {
    ver: (message?: any, ...optionalParams: any[]) => void;
    log: (message?: any, ...optionalParams: any[]) => void;
    err: (message?: any, ...optionalParams: any[]) => void;
    war: (message?: any, ...optionalParams: any[]) => void;
    success: (message?: any, ...optionalParams: any[]) => void;
  };
  db: r.RDb;
  web3: Web3;
}

async function setup(...args: string[]): Promise<Context> {
  const app = Array.isArray(args) && args.length ? args[0] : 'all';
  const provider = new Web3.providers.WebsocketProvider(
    process.env.ETH_WEBSOCKET_URI,
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
  await checkOrCreateSimpleIndex(
    connection,
    trx,
    'hasReceipts',
    r
      .row('receipts')
      .default(0)
      .coerceTo('number'),
  );

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
  await checkOrCreateSimpleIndex(
    connection,
    logs,
    'involvedCount',
    r.row('involved').count(),
    { multi: true },
  );

  return {
    app,
    connection,
    tables: {
      blocks,
      trx,
      traces,
      logs,
    },
    db,
    web3,
    logger: {
      ver: (message?: any, ...optionalParams: any[]) => {
        console.log(
          chalk.gray(
            `[ETH][${app.toUpperCase()}][VER]:`,
            message,
            ...optionalParams,
          ),
        );
      },
      log: (message?: any, ...optionalParams: any[]) => {
        console.log(
          chalk.white(
            `[ETH][${app.toUpperCase()}][LOG]:`,
            message,
            ...optionalParams,
          ),
        );
      },
      err: (message?: any, ...optionalParams: any[]) => {
        console.log(
          chalk.red(
            `[ETH][${app.toUpperCase()}][ERR]:`,
            message,
            ...optionalParams,
          ),
        );
      },
      war: (message?: any, ...optionalParams: any[]) => {
        console.log(
          chalk.yellow(
            `[ETH][${app.toUpperCase()}][WAR]:`,
            message,
            ...optionalParams,
          ),
        );
      },
      success: (message?: any, ...optionalParams: any[]) => {
        console.log(
          chalk.bgGreen.whiteBright(
            `[ETH][${app.toUpperCase()}][SUC]:`,
            message,
            ...optionalParams,
          ),
        );
      },
    },
  };
}
export async function run(...args: string[]) {
  // TODO: setup provider from providen configuration
  let ctx: Context | null = await setup(...args);

  if (ctx.app !== 'setup') {
    while (true) {
      try {
        if (!ctx) {
          ctx = await setup(...args);
        }

        if (ctx.app === 'all') {
          await Promise.all(Object.values(tasks).map(f => f(ctx)));
        } else if (ctx.app === 'setup') {
          ctx.logger.success('Done!');
        } else {
          await tasks[ctx.app](ctx);
        }
      } catch (e) {
        ctx.logger.err(e.message);
        // ctx.logger.ver(JSON.stringify(e, null, 2));
        console.log(e);
        await ctx.connection.close();
        await (<any>(
          (ctx.web3.currentProvider as WebsocketProvider).connection
        )).close();

        ctx = null;
      }
    }
  } else {
    ctx.connection.close();
    (<any>(ctx.web3.currentProvider as WebsocketProvider).connection).close();
  }
}
