import * as r from 'rethinkdb';
import { Context } from './app';
import { IEthBlock, IEthTransaction } from './eth-types';

const abis = [
  require('./schemas/FixedSupplyToken.json'),
  require('./schemas/Foo.json'),
  require('./schemas/Bar.json'),
  require('./schemas/Feez.json'),
];

let events = abis
  .map(abi => abi.abi)
  .reduce((flat, arr) => flat.concat(arr), [])
  .filter(abi => abi.type === 'event');

let eventsDict: {
  [key: string]: {
    inputs: any[];
    name: string;
    type: 'event';
  };
};

let stream: r.CursorResult<any>;
let cachedConnection: r.Connection;

export async function run(ctx: Context) {
  if (!eventsDict) {
    eventsDict = events.reduce(
      (dict, event) => (
        (dict[ctx.web3.eth.abi.encodeEventSignature(event)] = event), dict
      ),
      {},
    );
  }

  if (!stream || cachedConnection != ctx.connection) {
    stream = await ctx.tables.logs
      .filter(doc =>
        doc('parsedVersion')
          .default(0)
          .lt(1),
      )
      .changes({ includeInitial: true, squash: 1 })
      .map(x => <any>x('new_val'))
      .run(ctx.connection);
    cachedConnection = ctx.connection;
    stream.each(async (_, log) => {
      const signature = log.topics[0];
      console.log('unparsed log: ', signature);

      if (eventsDict[signature]) {
        console.log(eventsDict[signature], log);
        console.log(
          ctx.web3.eth.abi.decodeLog(
            eventsDict[signature].inputs,
            log.data === '0x' ? '' : log.data,
            log.topics.slice(1),
          ),
        );
      }
    });
  }
}
