import { IOHLC } from '@yuants/data-ohlc';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { Observable, firstValueFrom } from 'rxjs';
//@ts-ignore
import TradingView from '@mathieuc/tradingview';

const terminal = Terminal.fromNodeEnv();

const DURATION_TO_TRADINGVIEW_PERIOD: Record<string, string> = {
  PT1M: '1',
  PT3M: '3',
  PT5M: '5',
  PT15M: '15',
  PT30M: '30',
  PT45M: '45',
  PT1H: '60',
  PT2H: '120',
  PT3H: '180',
  PT4H: '240',
  P1D: '1D',
  P1W: '1W',
  P1M: '1M',
  P3M: '3M',
  P6M: '6M',
  P1Y: '12M',
};

createSeriesProvider(terminal, {
  tableName: 'ohlc',
  series_id_prefix_parts: ['TradingView'],
  reversed: false,
  serviceOptions: { concurrent: +(process.env.CONCURRENCY || 2) },
  queryFn: async ({ series_id, started_at, ended_at }) => {
    const [datasource_id, product_id, duration] = decodePath(series_id);
    const offset = convertDurationToOffset(duration);
    if (!offset) throw new Error(`Unsupported duration: ${duration}`);

    const timeframe = DURATION_TO_TRADINGVIEW_PERIOD[duration];
    if (!timeframe) throw new Error(`Unsupported timeframe: ${duration}`);

    const range = Math.ceil((ended_at - started_at) / offset);
    if (range <= 0) {
      throw `range=${range} is invalid`;
    }

    console.info(
      formatTime(Date.now()),
      'queryChartRequest',
      JSON.stringify({ series_id, product_id, duration, range }),
    );

    const data = await firstValueFrom(
      new Observable<IOHLC[]>((subscriber) => {
        const client = new TradingView.Client();
        const chart = new client.Session.Chart();
        chart.setMarket(product_id, {
          timeframe,
          range,
          to: ended_at,
        });
        chart.onError((e: any) => {
          subscriber.error(e);
        });
        chart.onUpdate(() => {
          const rawPeriods: any[] = chart.periods;
          if (rawPeriods.length !== 0) {
            const periods = rawPeriods.map(
              (v): IOHLC => ({
                series_id,
                created_at: formatTime(v.time * 1000),
                datasource_id,
                product_id,
                duration,
                closed_at: formatTime(v.time * 1000 + offset),
                open: `${v.open}`,
                high: `${v.max}`,
                low: `${v.min}`,
                close: `${v.close}`,
                volume: `${v.volume}`,
                open_interest: '0',
              }),
            );
            subscriber.next(periods);
            subscriber.complete();
          }
        });
        return () => {
          client.end();
        };
      }),
    );

    console.info(
      formatTime(Date.now()),
      'queryChartResponse',
      JSON.stringify({
        series_id,
        product_id,
        duration,
        data_length: data.length,
      }),
    );

    return data;
  },
});
