import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { defer, filter, groupBy, mergeMap, retry, scan, share, Subject, tap } from 'rxjs';
import { ICThostFtdcDepthMarketDataField } from './assets/ctp-types';

const terminal = Terminal.fromNodeEnv();
const BROKER_ID = process.env.BROKER_ID!;
const INVESTOR_ID = process.env.USER_ID!;
const ACCOUNT_ID = encodePath(BROKER_ID, INVESTOR_ID);
const DATASOURCE_ID = 'CTP';
const subscribedProductIds = new Set<string>();
const instrumentIdToProductId = new Map<string, string>();

defer(() =>
  terminal.channel.subscribeChannel<ICThostFtdcDepthMarketDataField>('CTP/DepthMarketData', ACCOUNT_ID),
)
  .pipe(
    //
    filter((frame): frame is ICThostFtdcDepthMarketDataField => !!frame),
    tap((frame) => {
      const fallbackProductId = instrumentIdToProductId.get(frame.InstrumentID);
      const productId = fallbackProductId ?? `${frame.ExchangeID}-${frame.InstrumentID}`;
      quoteToWrite$.next({
        datasource_id: DATASOURCE_ID,
        product_id: productId,
        last_price: `${frame.LastPrice}`,
        ask_price: `${frame.AskPrice1}`,
        bid_price: `${frame.BidPrice1}`,
        ask_volume: `${frame.AskVolume1}`,
        bid_volume: `${frame.BidVolume1}`,
        updated_at: new Date().toISOString(),
      });
    }),
  )
  .subscribe();

export const quoteToWrite$ = new Subject<Partial<IQuote> & Pick<IQuote, 'datasource_id' | 'product_id'>>();

const quote$ = quoteToWrite$.pipe(
  groupBy((x) => encodePath(x.datasource_id, x.product_id)),
  mergeMap((group$) => {
    return group$.pipe(
      //
      scan(
        (acc, cur) => Object.assign(acc, cur),
        {} as Partial<IQuote> & Pick<IQuote, 'datasource_id' | 'product_id'>,
      ),
    );
  }),
  share(),
);

export const ensureMarketDataSubscription = (productId: string) => {
  if (subscribedProductIds.has(productId)) {
    return;
  }
  subscribedProductIds.add(productId);
  const [, instrumentId] = productId.split('-', 2);
  instrumentIdToProductId.set(instrumentId, productId);

  defer(() =>
    terminal.client.requestForResponse('CTP/SubscribeMarketData', {
      account_id: ACCOUNT_ID,
      instrument_ids: [instrumentId],
    }),
  )
    .pipe(
      retry({ delay: 1000 }),
      tap({
        subscribe: () =>
          console.info(
            formatTime(Date.now()),
            'SubscribeMarketData',
            JSON.stringify({ account_id: ACCOUNT_ID, instrument_ids: [instrumentId] }),
          ),
        error: (err) => {
          console.warn(formatTime(Date.now()), 'SubscribeMarketDataError', err);
        },
      }),
    )
    .subscribe();
};

terminal.channel.publishChannel<Partial<IQuote> & Pick<IQuote, 'datasource_id' | 'product_id'>>(
  'quote',
  { pattern: `^CTP/` },
  (channel_id) => {
    const [, productId] = decodePath(channel_id);
    ensureMarketDataSubscription(productId);
    return quote$.pipe(filter((quote) => quote.product_id === productId));
  },
);

quote$
  .pipe(
    writeToSQL({
      terminal,
      writeInterval: 1000,
      tableName: 'quote',
      conflictKeys: ['datasource_id', 'product_id'],
    }),
  )
  .subscribe();
