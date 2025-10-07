import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { encodePath, formatTime } from '@yuants/utils';
import { defer, filter, groupBy, mergeMap, scan, Subject, tap } from 'rxjs';
import { ICThostFtdcDepthMarketDataField } from './assets/ctp-types';

const terminal = Terminal.fromNodeEnv();
const BROKER_ID = process.env.BROKER_ID!;
const INVESTOR_ID = process.env.USER_ID!;
const ACCOUNT_ID = encodePath(BROKER_ID, INVESTOR_ID);
const DATASOURCE_ID = ACCOUNT_ID;

// const SUBSCRIBE_INSTRUMENT_IDS = ['au2512', 'ag2512'];

// defer(() =>
//   terminal.client
//     .requestService<
//       { account_id: string; instrument_ids: string[] },
//       void,
//       IBridgeMessage<{ instrument_ids: string[] }, ICThostFtdcSpecificInstrumentField>
//     >('CTP/SubscribeMarketData', {
//       account_id: ACCOUNT_ID,
//       instrument_ids: SUBSCRIBE_INSTRUMENT_IDS,
//     })
//     .pipe(
//       retry({ delay: 1000 }),
//       tap({
//         subscribe: () =>
//           console.info(
//             formatTime(Date.now()),
//             'Subscribe_MarketData',
//             JSON.stringify({ instrument_ids: SUBSCRIBE_INSTRUMENT_IDS }),
//           ),
//         next: (frame) => {
//           console.info(formatTime(Date.now()), 'Subscribe_MarketData frame', JSON.stringify(frame));
//         },
//         error: (err) => console.warn(formatTime(Date.now()), 'Subscribe_MarketData_Error', err),
//         complete: () => console.info(formatTime(Date.now()), 'Subscribe_MarketData stream completed'),
//       }),
//     ),
// ).subscribe();

defer(() =>
  terminal.channel.subscribeChannel<ICThostFtdcDepthMarketDataField>('CTP/DepthMarketData', ACCOUNT_ID),
)
  .pipe(
    //
    filter((frame): frame is ICThostFtdcDepthMarketDataField => !!frame),
    tap((frame) => {
      console.info(formatTime(Date.now()), 'MarketData', JSON.stringify(frame));
      quoteToWrite$.next({
        datasource_id: DATASOURCE_ID,
        product_id: `${frame.ExchangeID}-${frame.InstrumentID}`,
        last_price: `${frame.LastPrice}`,
        ask_price: `${frame.AskPrice1}`,
        bid_price: `${frame.BidPrice1}`,
        ask_volume: `${frame.AskVolume1}`,
        bid_volume: `${frame.BidVolume1}`,
        updated_at: new Date().toISOString(),
      });
    }),
  )
  .subscribe((frame) => {
    console.info(formatTime(Date.now()), 'MarketData frame', JSON.stringify(frame));
  });

export const quoteToWrite$ = new Subject<Partial<IQuote> & Pick<IQuote, 'datasource_id' | 'product_id'>>();

quoteToWrite$
  .pipe(
    groupBy((x) => encodePath(x.datasource_id, x.product_id)),
    mergeMap((group$) => {
      return group$.pipe(
        //
        scan((acc, cur) => Object.assign(acc, cur), {} as Partial<IQuote>),
      );
    }),
    writeToSQL({
      terminal: Terminal.fromNodeEnv(),
      writeInterval: 1000,
      tableName: 'quote',
      conflictKeys: ['datasource_id', 'product_id'],
    }),
  )
  .subscribe();
