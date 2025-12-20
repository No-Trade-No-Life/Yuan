import { IOHLC } from '@yuants/data-ohlc';
import { provideOHLCService } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { getSpotHistoryKline, getSwapHistoryKline } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const DURATION_TO_HTX_PERIOD: Record<string, string> = {
  PT1M: '1min',
  PT5M: '5min',
  PT15M: '15min',
  PT30M: '30min',
  PT1H: '60min',
  PT4H: '4hour',
  P1D: '1day',
  P1W: '1week',
};

const DEFAULT_BAR_COUNT = 500;

const fetchSpotOHLCPageBackward = async (req: {
  product_id: string;
  duration: string;
  time: number;
  series_id: string;
}): Promise<IOHLC[]> => {
  const [, instType, symbol] = decodePath(req.product_id);
  if (instType !== 'SPOT' || !symbol) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const period = DURATION_TO_HTX_PERIOD[req.duration];
  if (!period) throw new Error(`Unsupported duration: ${req.duration}`);

  const offset = convertDurationToOffset(req.duration);
  const endedAtMs = req.time;

  const to = Math.floor(endedAtMs / 1000);
  const from = Math.max(0, Math.floor((endedAtMs - DEFAULT_BAR_COUNT * offset) / 1000));

  const res = await getSpotHistoryKline({
    symbol: symbol.toLowerCase(),
    period,
    size: DEFAULT_BAR_COUNT,
    from,
    to,
  });
  if (res.status !== 'ok') {
    throw new Error(`HTX getSpotHistoryKline failed: ${res.status}`);
  }

  return (res.data ?? [])
    .map((k): IOHLC => {
      const createdAtMs = k.id * 1000;
      return {
        series_id: req.series_id,
        datasource_id: 'HTX',
        product_id: req.product_id,
        duration: req.duration,
        created_at: formatTime(createdAtMs),
        closed_at: formatTime(createdAtMs + offset),
        open: `${k.open}`,
        high: `${k.high}`,
        low: `${k.low}`,
        close: `${k.close}`,
        volume: `${k.vol}`,
        open_interest: '0',
      };
    })
    .filter((x) => Date.parse(x.created_at) < endedAtMs);
};

const fetchOHLCPageBackward = async (req: {
  product_id: string;
  duration: string;
  time: number;
  series_id: string;
}): Promise<IOHLC[]> => {
  const [, instType, contract_code] = decodePath(req.product_id);
  if (instType !== 'SWAP' || !contract_code) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const period = DURATION_TO_HTX_PERIOD[req.duration];
  if (!period) throw new Error(`Unsupported duration: ${req.duration}`);

  const offset = convertDurationToOffset(req.duration);
  const endedAtMs = req.time;

  const to = Math.floor(endedAtMs / 1000);
  const from = Math.max(0, Math.floor((endedAtMs - DEFAULT_BAR_COUNT * offset) / 1000));

  const res = await getSwapHistoryKline({
    contract_code,
    period,
    size: DEFAULT_BAR_COUNT,
    from,
    to,
  });
  if (res.status !== 'ok') {
    throw new Error(`HTX getSwapHistoryKline failed: ${res.status}`);
  }

  return (res.data ?? [])
    .map((k): IOHLC => {
      const createdAtMs = k.id * 1000;
      return {
        series_id: req.series_id,
        datasource_id: 'HTX',
        product_id: req.product_id,
        duration: req.duration,
        created_at: formatTime(createdAtMs),
        closed_at: formatTime(createdAtMs + offset),
        open: `${k.open}`,
        high: `${k.high}`,
        low: `${k.low}`,
        close: `${k.close}`,
        volume: `${k.vol}`,
        open_interest: '0',
      };
    })
    .filter((x) => Date.parse(x.created_at) < endedAtMs);
};

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'HTX/SWAP/',
    duration_list: Object.keys(DURATION_TO_HTX_PERIOD),
    direction: 'backward',
  },
  fetchOHLCPageBackward,
);

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'HTX/SPOT/',
    duration_list: Object.keys(DURATION_TO_HTX_PERIOD),
    direction: 'backward',
  },
  fetchSpotOHLCPageBackward,
);
