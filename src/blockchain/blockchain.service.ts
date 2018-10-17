import * as r from 'rethinkdb';
import config from '../config';
import { Injectable } from '@nestjs/common';
import { waitFor } from 'utils';

@Injectable()
export class BlockchainService {
  connection: r.Connection;
  ready: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    this.connection = await r.connect({
      host: config.rethinkdb.host,
      port: config.rethinkdb.port,
    });
    this.ready = true;
  }

  async chains() {
    return ['eth', 'eos'];
  }

  async getState(chain: string) {
    if ((await this.chains()).indexOf(chain) === -1) {
      throw new Error('Unkown chain');
    }
    await waitFor(() => this.ready);

    const latest = await r
      .branch(
        r
          .db(chain)
          .table('blocks')
          .isEmpty(),
        0,
        r
          .db(chain)
          .table('blocks')
          .max({ index: 'height' })('height')
          .coerceTo('number'),
      )
      .run(this.connection);

    return {
      height: latest,
    };
  }

  async getBlocks(
    chain: string,
    filled: boolean = false,
    populateTx: boolean = false,
  ) {
    if ((await this.chains()).indexOf(chain) === -1) {
      throw new Error('Unkown chain');
    }
    await waitFor(() => this.ready);

    let request: any = r
      .db(chain)
      .table('blocks')
      .orderBy({ index: r.desc('height') })
      .limit(20);

    if (populateTx) {
      request = request.merge(block => ({
        transactions: block('transactions').map(hash =>
          r
            .db(chain)
            .table('transactions')
            .get(hash)
            .merge(doc => ({
              logs: doc('meta')
                .default({ logs: [] })('logs')
                .map(id =>
                  r
                    .db(chain)
                    .table('logs')
                    .get(id),
                )
                .coerceTo('array'),
              traces: r
                .db(chain)
                .table('traces')
                .getAll(doc('txHash').coerceTo('string'), { index: 'txHash' })
                .coerceTo('array'),
            })),
        ),
      }));
    }

    return request.run(this.connection).then(cursor => cursor.toArray());
  }

  async getTraces(chain: string, address: string) {
    if ((await this.chains()).indexOf(chain) === -1) {
      throw new Error('Unkown chain');
    }
    await waitFor(() => this.ready);

    return (r
      .db(chain)
      .table('traces')
      .getAll(address.toLowerCase(), { index: 'from' })
      .union(
        r
          .db(chain)
          .table('traces')
          .getAll(address.toLowerCase(), { index: 'to' }),
      )
      .union(
        r
          .db(chain)
          .table('logs')
          .getAll(address.toLowerCase(), { index: 'involved' }),
      )
      .orderBy('timestamp')('txHash') as any)
      .distinct()
      .eqJoin(doc => doc, r.db(chain).table('transactions'))('right')
      .merge(doc => ({
        logs: doc('meta')('logs')
          .map(id =>
            r
              .db(chain)
              .table('logs')
              .get(id),
          )
          .coerceTo('array'),
        traces: r
          .db(chain)
          .table('traces')
          .getAll(doc('txHash').coerceTo('string'), { index: 'txHash' })
          .coerceTo('array'),
      }))
      .limit(100)
      .run(this.connection)
      .then(cursor => cursor.toArray());
  }
}
