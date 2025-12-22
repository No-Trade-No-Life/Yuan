import { IOHLC } from '@yuants/data-ohlc';
import { provideOHLCService } from '@yuants/exchange';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { getCandleSnapshot } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const INGEST_SERVICE_OPTIONS: IServiceOptions = {
  concurrent: 1,
  max_pending_requests: 20,
  ingress_token_capacity: 2,
  ingress_token_refill_interval: 1000,
  egress_token_capacity: 1,
  egress_token_refill_interval: 1000,
};

const DURATION_TO_HYPERLIQUID_INTERVAL: Record<string, string> = {
  PT1M: '1m',
  PT3M: '3m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',
  PT1H: '1h',
  PT2H: '2h',
  PT4H: '4h',
  PT8H: '8h',
  PT12H: '12h',
  P1D: '1d',
  P3D: '3d',
  P1W: '1w',
  P1M: '1M',
};

const DEFAULT_BAR_COUNT = 1000;

const fetchOHLCPageBackward = async (req: {
  product_id: string;
  duration: string;
  time: number;
  series_id: string;
}): Promise<IOHLC[]> => {
  const [, marketType, symbol] = decodePath(req.product_id);
  if (!symbol) throw new Error(`Unsupported product_id: ${req.product_id}`);
  if (marketType !== 'PERPETUAL' && marketType !== 'SPOT') {
    throw new Error(`Unsupported product_id: ${req.product_id}`);
  }

  const coin = symbol.split('-')[0];
  if (!coin) throw new Error(`Invalid symbol: ${symbol}`);

  const interval = DURATION_TO_HYPERLIQUID_INTERVAL[req.duration];
  if (!interval) throw new Error(`Unsupported duration: ${req.duration}`);

  const periodMs = convertDurationToOffset(req.duration);
  const endTime = req.time;
  const startTime = Math.max(0, endTime - DEFAULT_BAR_COUNT * periodMs);

  const res = await getCandleSnapshot({
    req: { coin, interval, startTime, endTime },
  });

  return (res ?? [])
    .map((x): IOHLC => {
      const createdAtMs = x.t;
      return {
        series_id: req.series_id,
        datasource_id: 'HYPERLIQUID',
        product_id: req.product_id,
        duration: req.duration,
        created_at: formatTime(createdAtMs),
        closed_at: formatTime(createdAtMs + periodMs),
        open: x.o,
        high: x.h,
        low: x.l,
        close: x.c,
        volume: x.v,
        open_interest: '0',
      };
    })
    .filter((x) => Date.parse(x.created_at) < endTime);
};

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'HYPERLIQUID/PERPETUAL/',
    duration_list: Object.keys(DURATION_TO_HYPERLIQUID_INTERVAL),
    direction: 'backward',
  },
  fetchOHLCPageBackward,
  INGEST_SERVICE_OPTIONS,
);

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'HYPERLIQUID/SPOT/',
    duration_list: Object.keys(DURATION_TO_HYPERLIQUID_INTERVAL),
    direction: 'backward',
  },
  fetchOHLCPageBackward,
  INGEST_SERVICE_OPTIONS,
);
