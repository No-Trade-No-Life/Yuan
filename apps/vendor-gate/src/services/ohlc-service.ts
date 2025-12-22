import { IOHLC } from '@yuants/data-ohlc';
import { provideOHLCService } from '@yuants/exchange';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { getFuturesCandlesticks, getSpotCandlesticks } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const INGEST_SERVICE_OPTIONS: IServiceOptions = {
  concurrent: 1,
  max_pending_requests: 20,
  ingress_token_capacity: 2,
  ingress_token_refill_interval: 1000,
  egress_token_capacity: 1,
  egress_token_refill_interval: 1000,
};

const DURATION_TO_GATE_INTERVAL: Record<string, string> = {
  PT1M: '1m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',
  PT1H: '1h',
  PT4H: '4h',
  PT8H: '8h',
  P1D: '1d',
  P1W: '1w',
};

const normalizeCandle = (
  raw:
    | { t: number; o: string; h: string; l: string; c: string; v: string }
    | [string, string, string, string, string, string],
): { tMs: number; o: string; h: string; l: string; c: string; v: string } => {
  if (Array.isArray(raw)) {
    const t = Number(raw[0]);
    const tMs = t < 1e12 ? t * 1000 : t;
    const volume = raw[1];
    const close = raw[2];
    const high = raw[3];
    const low = raw[4];
    const open = raw[5];
    return { tMs, o: open, h: high, l: low, c: close, v: volume };
  }
  const t = Number(raw.t);
  const tMs = t < 1e12 ? t * 1000 : t;
  return { tMs, o: raw.o, h: raw.h, l: raw.l, c: raw.c, v: raw.v };
};

const fetchFuturesOHLCBackward = async (req: {
  product_id: string;
  duration: string;
  time: number;
  series_id: string;
}): Promise<IOHLC[]> => {
  const [, instType, contract] = decodePath(req.product_id);
  if (instType !== 'FUTURE' || !contract) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const interval = DURATION_TO_GATE_INTERVAL[req.duration];
  if (!interval) throw new Error(`Unsupported duration: ${req.duration}`);

  const offset = convertDurationToOffset(req.duration);
  const endedAtMs = req.time;
  const to = Math.floor(endedAtMs / 1000);

  const rows = await getFuturesCandlesticks('usdt', {
    contract,
    interval,
    to,
    limit: 1000,
  });

  return (rows ?? [])
    .map((raw): IOHLC => {
      const k = normalizeCandle(raw);
      return {
        series_id: req.series_id,
        datasource_id: 'GATE',
        product_id: req.product_id,
        duration: req.duration,
        created_at: formatTime(k.tMs),
        closed_at: formatTime(k.tMs + offset),
        open: k.o,
        high: k.h,
        low: k.l,
        close: k.c,
        volume: k.v,
        open_interest: '0',
      };
    })
    .filter((x) => Date.parse(x.created_at) < endedAtMs);
};

const fetchSpotOHLCBackward = async (req: {
  product_id: string;
  duration: string;
  time: number;
  series_id: string;
}): Promise<IOHLC[]> => {
  const [, instType, currency_pair] = decodePath(req.product_id);
  if (instType !== 'SPOT' || !currency_pair) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const interval = DURATION_TO_GATE_INTERVAL[req.duration];
  if (!interval) throw new Error(`Unsupported duration: ${req.duration}`);

  const offset = convertDurationToOffset(req.duration);
  const endedAtMs = req.time;
  const to = Math.floor(endedAtMs / 1000);

  const rows = await getSpotCandlesticks({
    currency_pair,
    interval,
    to,
    limit: 1000,
  });

  return (rows ?? [])
    .map((raw): IOHLC => {
      const k = normalizeCandle(raw);
      return {
        series_id: req.series_id,
        datasource_id: 'GATE',
        product_id: req.product_id,
        duration: req.duration,
        created_at: formatTime(k.tMs),
        closed_at: formatTime(k.tMs + offset),
        open: k.o,
        high: k.h,
        low: k.l,
        close: k.c,
        volume: k.v,
        open_interest: '0',
      };
    })
    .filter((x) => Date.parse(x.created_at) < endedAtMs);
};

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'GATE/FUTURE/',
    duration_list: Object.keys(DURATION_TO_GATE_INTERVAL),
    direction: 'backward',
  },
  fetchFuturesOHLCBackward,
  INGEST_SERVICE_OPTIONS,
);

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'GATE/SPOT/',
    duration_list: Object.keys(DURATION_TO_GATE_INTERVAL),
    direction: 'backward',
  },
  fetchSpotOHLCBackward,
  INGEST_SERVICE_OPTIONS,
);
