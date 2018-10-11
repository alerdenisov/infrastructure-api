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

  async getChain(chain: string) {
    console.log(this.ready);
    await waitFor(() => this.ready);
    console.log('ready to call');

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

    return latest.toString();
  }
}
