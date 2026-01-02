import { IOHLC, provideOHLCDurationService } from '@yuants/data-ohlc';
import { Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { Observable, firstValueFrom } from 'rxjs';
//@ts-ignore
import TradingView from '@mathieuc/tradingview';
import { provideOHLCService } from '@yuants/exchange';

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

provideOHLCDurationService(
  terminal,
  'TradingView', // datasource_id
  () => Object.keys(DURATION_TO_TRADINGVIEW_PERIOD),
);

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'TradingView/',
    direction: 'backward',
    duration_list: Object.keys(DURATION_TO_TRADINGVIEW_PERIOD),
  },
  async ({ product_id, duration, series_id, time }) => {
    const [datasource_id, symbol] = decodePath(product_id);
    const offset = convertDurationToOffset(duration);
    if (!offset) throw new Error(`Unsupported duration: ${duration}`);

    const timeframe = DURATION_TO_TRADINGVIEW_PERIOD[duration];
    if (!timeframe) throw new Error(`Unsupported timeframe: ${duration}`);

    const range = 5000;

    console.info(
      formatTime(Date.now()),
      'queryChartRequest',
      JSON.stringify({ series_id, product_id, duration, range }),
    );

    const data = await firstValueFrom(
      new Observable<IOHLC[]>((subscriber) => {
        const client = new TradingView.Client();
        const chart = new client.Session.Chart();
        chart.setMarket(symbol, {
          timeframe,
          range,
          to: time,
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
  { concurrent: +(process.env.CONCURRENCY || 2) },
);
