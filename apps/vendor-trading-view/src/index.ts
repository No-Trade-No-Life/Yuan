import { IPeriod, UUID, decodePath } from '@yuants/data-model';
import { provideDataSeries } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { Observable, firstValueFrom } from 'rxjs';
//@ts-ignore
import TradingView from '@mathieuc/tradingview';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `TradingView/${UUID()}`,
  name: '@yuants/vendor-trading-view',
});

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

provideDataSeries(terminal, {
  type: 'period',
  series_id_prefix_parts: ['TradingView'],
  reversed: false,
  serviceOptions: { concurrent: +(process.env.CONCURRENCY || 10) },
  queryFn: async ({ series_id, started_at, ended_at }) => {
    const [datasource_id, product_id, _period_in_sec] = decodePath(series_id);
    const period_in_sec = +_period_in_sec;
    const range = ~~((ended_at - started_at) / 1000 / +period_in_sec);
    if (range <= 0) {
      throw `range=${range} is invalid`;
    }

    return firstValueFrom(
      new Observable<IPeriod[]>((subscriber) => {
        const client = new TradingView.Client();
        const chart = new client.Session.Chart();
        chart.setMarket(product_id, {
          timeframe: PERIODS[period_in_sec],
          range,
          to: ended_at,
        });
        chart.onUpdate(() => {
          const rawPeriods: any[] = chart.periods;
          if (rawPeriods.length !== 0) {
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
      }),
    );
  },
});
