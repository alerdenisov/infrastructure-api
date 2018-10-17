import * as r from 'rethinkdb';
import { IBlock, ITransaction, ITrace, ILog } from 'types';

export async function defaultRethink<
  TBlock extends IBlock,
  TTransaction extends ITransaction,
  TTrace extends ITrace,
  TLog extends ILog
>(connection: r.Connection, dbName: string) {
  const db = await getOrCreateDatabase(dbName, connection);
  const blocks = await getOrCreateTable<TBlock>(connection, db, 'blocks', {
    primaryKey: 'height',
  });
  const trx = await getOrCreateTable<TTransaction>(
    connection,
    db,
    'transactions',
    {
      primaryKey: 'txHash',
    },
  );

  const traces = await getOrCreateTable<TTrace>(connection, db, 'traces', {});

  const logs = await getOrCreateTable<TLog>(connection, db, 'logs', {
    primaryKey: 'id',
  });

  await checkOrCreateSimpleIndex(
    connection,
    blocks,
    'txCount',
    r.row('transactions').count(),
  );
}

export function important<T>(from: T | null | undefined, message?: string): T {
  if (from) {
    return from;
  } else {
    throw new Error(message || 'Undefined variable error');
  }
}
export function or<T>(
  original: T | null | undefined,
  def: T,
  onDef?: () => void,
): T {
  if (!original) {
    if (typeof onDef === 'function') {
      onDef();
    }
    return def;
  }
  return original;
}

export const getOrCreateDatabase = async (
  database: string,
  connection: r.Connection,
) => {
  const databases = await r.dbList().run(connection);
  if (databases.indexOf(database) === -1) {
    await r.dbCreate(database).run(connection);
  }

  return r.db(database);
};

export const getOrCreateTable = async <T>(
  connection: r.Connection,
  db: r.RDb,
  table: string,
  opts?: r.TableCreateOptions,
): Promise<r.RTable<T>> => {
  const tables = await db.tableList().run(connection);
  if (tables.indexOf(table) === -1) {
    await db.tableCreate(table, opts).run(connection);
  }

  return db.table<T>(table);
};

export const checkOrCreateSimpleIndex = async <T>(
  connection: r.Connection,
  table: r.RTable<T>,
  indexName: keyof T | string,
  indexFunc?: r.IndexCreateOptions | r.IndexFunction<T>,
  indexOptions?: r.IndexCreateOptions,
): Promise<string> => {
  const indexKey = `${table.name}_${indexName}`;
  let indexes = await table.indexList().run(connection);
  if (indexes.indexOf(<any>indexName) == -1) {
    if (typeof indexOptions !== 'undefined') {
      await table
        .indexCreate(
          <string>indexName,
          indexFunc as r.IndexFunction<T>,
          indexOptions,
        )
        .run(connection);
    } else {
      await table
        .indexCreate(<string>indexName, indexFunc as r.IndexCreateOptions)
        .run(connection);
    }
    await table.indexWait(<string>indexName).run(connection);
  }

  return indexKey;
};

export const unique = <T>(input: Array<T>): Array<T> => {
  return Array.from(new Set(input));
};

export const waitFor = async (predicate: () => boolean): Promise<void> => {
  while (!predicate()) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};
