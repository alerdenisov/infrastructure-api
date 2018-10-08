import * as r from 'rethinkdb';

export function important<T>(from: T | null | undefined, message?: string): T {
  if (from) {
    return from;
  } else {
    throw new Error(message || 'Undefined variable error');
  }
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
  indexName: keyof T,
  indexFunc?: r.IndexCreateOptions,
): Promise<string> => {
  const indexKey = `${table.name}_${indexName}`;
  let indexes = await table.indexList().run(connection);
  if (indexes.indexOf(<any>indexName) == -1) {
    await table.indexCreate(<string>indexName, indexFunc).run(connection);
    await table.indexWait(<string>indexName).run(connection);
  }

  return indexKey;
};
