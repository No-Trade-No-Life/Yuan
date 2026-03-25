import { IOHLC } from '@yuants/data-ohlc';
import { provideOHLCService } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { getFutureKlines, getSpotKlines } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const DURATION_TO_BINANCE_INTERVAL: Record<string, string> = {
  PT1M: '1m',
  PT3M: '3m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',
  PT1H: '1h',
  PT2H: '2h',
  PT4H: '4h',
  PT6H: '6h',
  PT8H: '8h',
  PT12H: '12h',
  P1D: '1d',
  P3D: '3d',
  P1W: '1w',
  P1M: '1M',
};

const fetchOHLCPageBackward = async (req: {
  product_id: string;
  duration: string;
  time: number;
  series_id: string;
}): Promise<IOHLC[]> => {
  const [, instType, symbol] = decodePath(req.product_id);
  if (!instType || !symbol) throw new Error(`Invalid product_id: ${req.product_id}`);

  const interval = DURATION_TO_BINANCE_INTERVAL[req.duration];
  if (!interval) throw new Error(`Unsupported duration: ${req.duration}`);

  const offset = convertDurationToOffset(req.duration);
  const endedAtMs = req.time;

  const params = {
    symbol,
    interval,
    endTime: endedAtMs,
    limit: 1000,
  };

  const res =
    instType === 'USDT-FUTURE'
      ? await getFutureKlines(params)
      : instType === 'SPOT' || instType === 'MARGIN'
      ? await getSpotKlines(params)
      : (() => {
          throw new Error(`Unsupported instType for OHLC: ${instType}`);
        })();

  return (res ?? [])
    .map(
      (k): IOHLC => ({
        series_id: req.series_id,
        datasource_id: 'BINANCE',
        product_id: req.product_id,
        duration: req.duration,
        created_at: formatTime(k[0]),
        closed_at: formatTime(k[0] + offset),
        open: `${k[1]}`,
        high: `${k[2]}`,
        low: `${k[3]}`,
        close: `${k[4]}`,
        volume: `${k[5]}`,
        open_interest: '0',
      }),
    )
    .filter((x) => Date.parse(x.created_at) < endedAtMs);
};

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'BINANCE/USDT-FUTURE/',
    duration_list: Object.keys(DURATION_TO_BINANCE_INTERVAL),
    direction: 'backward',
  },
  fetchOHLCPageBackward,
);

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'BINANCE/SPOT/',
    duration_list: Object.keys(DURATION_TO_BINANCE_INTERVAL),
    direction: 'backward',
  },
  fetchOHLCPageBackward,
);

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'BINANCE/MARGIN/',
    duration_list: Object.keys(DURATION_TO_BINANCE_INTERVAL),
    direction: 'backward',
  },
  fetchOHLCPageBackward,
);
