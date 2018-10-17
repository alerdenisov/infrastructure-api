import * as r from 'rethinkdb';
import { Context } from './app';
import { IEthBlock, IEthTransaction, IEthLog } from './eth-types';

const VERSION = 4;

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
  // await new Promise(resolve => setTimeout(resolve, 1000));
  if (!eventsDict) {
    eventsDict = events.reduce(
      (dict, event) => (
        (dict[ctx.web3.eth.abi.encodeEventSignature(event)] = event), dict
      ),
      {},
    );
  }

  if (!stream || cachedConnection != ctx.connection) {
    ctx.logger.log(`Recreate parser stream`);
    stream = await ctx.tables.logs
      .filter(doc =>
        doc('parsedVersion')
          .default(0)
          .lt(VERSION),
      )
      .changes({ includeInitial: true })
      .run(ctx.connection);
    cachedConnection = ctx.connection;
    stream.each(async (_, change) => {
      try {
        const log = change.new_val || change.old_val;
        ctx.logger.log(`Parse log at ${log.txHash}`);
        const signature = log.topics[0];
        const parseLog: IEthLog = {
          ...log,
          parsedVersion: VERSION,
          parsed: {} as {
            values: any;
            inputs: any[];
            name: string;
          },
          involved: [] as string[],
        };

        if (eventsDict[signature]) {
          let values: any;
          try {
            values = ctx.web3.eth.abi.decodeLog(
              eventsDict[signature].inputs,
              log.data === '0x' ? '' : log.data,
              log.topics.slice(1),
            );
          } catch (e) {
            values = {};
          }
          parseLog.parsed = {
            ...eventsDict[signature],
            values,
          };

          parseLog.involved = eventsDict[signature].inputs
            .filter(input => input.type === 'address')
            .map((_, index) => parseLog.parsed.values[index]);
        }
        await ctx.tables.logs
          .insert(parseLog, {
            conflict: 'update',
          })
          .run(ctx.connection);
      } catch (e) {
        console.log(change);
        console.log(e);
      }
    });
  }
}
