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
    console.log('initialize blockchain service');
    this.connection = await r.connect({
      host: config.rethinkdb.host,
      port: config.rethinkdb.port,
    });
    console.log('connected...');
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

    console.log(latest);

    return {
      height: latest,
    };
  }

  async getTraces(chain: string, address: string) {
    if ((await this.chains()).indexOf(chain) === -1) {
      throw new Error('Unkown chain');
    }
    await waitFor(() => this.ready);

    console.log(chain, address);

    return (r
      .db(chain)
      .table('traces')
      .getAll(address, { index: 'from' })
      .union(
        r
          .db(chain)
          .table('traces')
          .getAll(address, { index: 'to' }),
      )
      .orderBy('timestamp')('txHash') as any)
      .distinct()
      .eqJoin(doc => doc, r.db(chain).table('transactions'))('right')
      .merge(doc => ({
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
