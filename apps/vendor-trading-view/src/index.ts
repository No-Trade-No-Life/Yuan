import { IPeriod, UUID, formatTime, getDataRecordWrapper } from '@yuants/data-model';
import { Terminal, writeDataRecords } from '@yuants/protocol';
//@ts-ignore
import TradingView from '@mathieuc/tradingview';
import { Observable, delayWhen, from, map, of, tap, timeout } from 'rxjs';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `NeoTradingView/${UUID()}`,
  name: 'NEO Trading View',
  status: 'OK',
});
const datasource_id = 'TradingView';
const CONCURRENCY = +(process.env.CONCURRENCY || 10);

const PERIODS: Record<string, string> = {
  60: '1',
  180: '3',
  300: '5',
  900: '15',
  1800: '30',
  2700: '45',
  3600: '60',
  7200: '120',
  10800: '180',
  14400: '240',
  86400: '1D',
  [7 * 86400]: '1W',
  [30 * 86400]: '1M',
  [3 * 30 * 86400]: '3M',
  [6 * 30 * 86400]: '6M',
  [12 * 30 * 86400]: '12M',
};

const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';

terminal.provideService(
  'CopyDataRecords',
  {
    required: ['tags'],
    properties: {
      tags: {
        type: 'object',
        required: ['datasource_id'],
        properties: {
          datasource_id: {
            const: datasource_id,
          },
        },
      },
    },
  },
  (msg) => {
    if (msg.req.tags?.product_id === undefined || msg.req.tags?.period_in_sec === undefined) {
      return of({ res: { code: 400, message: 'product_id or period_in_sec is required' } });
    }

    const { product_id, period_in_sec } = msg.req.tags;
    const [start, end] = msg.req.time_range || [0, Date.now()];

    const range = ~~((end - start) / 1000 / +period_in_sec);
    console.info(
      formatTime(Date.now()),
      `CopyDataRecords ${product_id}-${period_in_sec} Started`,
      `parsed parameters: ${JSON.stringify({
        timeframe: PERIODS[period_in_sec],
        range,
        to: end,
      })}`,
    );
    if (range <= 0) {
      return of({ res: { code: 400, message: 'time_range is invalid' } });
    }

    const client = new TradingView.Client();
    const chart = new client.Session.Chart();
    chart.setMarket(product_id, {
      timeframe: PERIODS[period_in_sec],
      range,
      to: end,
    });

    return new Observable<IPeriod[]>((subscriber) => {
      chart.onUpdate(() => {
        const rawPeriods: any[] = chart.periods;
        if (rawPeriods.length !== 0) {
          console.info(
            formatTime(Date.now()),
            `QueryChart ${product_id}-${period_in_sec} success, ${rawPeriods.length} records`,
          );
          const periods = rawPeriods.map(
            (v): IPeriod => ({
              datasource_id,
              product_id,
              period_in_sec: +period_in_sec,
              timestamp_in_us: v.time * 1000_000,
              start_at: v.time * 1000,
              open: v.open,
              high: v.max,
              low: v.min,
              close: v.close,
              volume: v.volume,
            }),
          );
          subscriber.next(periods);
          subscriber.complete();
        }
      });
    }).pipe(
      //
      delayWhen((periods) => from(writeDataRecords(terminal, periods.map(getDataRecordWrapper('period')!)))),
      tap(() => {
        console.info(formatTime(Date.now()), `UpdatePeriods ${product_id}-${period_in_sec} success`);
      }),
      timeout({ each: 10_000, meta: `CopyDataRecords ${product_id}-${period_in_sec} timeout` }),
      tap({
        finalize: () => {
          client.end();
        },
      }),
      map(() => ({
        res: { code: 0, message: 'OK' },
      })),
    );
  },
  {
    concurrent: CONCURRENCY,
  },
);
