import { IOHLC } from '@yuants/data-ohlc';
import { provideOHLCService } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { getHistoryCandles } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const DURATION_TO_GRANULARITY: Record<string, string> = {
  PT1M: '1m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',
  PT1H: '1H',
  PT4H: '4H',
  PT12H: '12H',
  P1D: '1D',
  P1W: '1W',
};

const fetchOHLCPage = async (req: {
  product_id: string;
  duration: string;
  time: number;
  series_id: string;
}): Promise<IOHLC[]> => {
  const [, category, symbol] = decodePath(req.product_id);
  if (!category || !symbol) throw new Error(`Invalid product_id: ${req.product_id}`);

  const interval = DURATION_TO_GRANULARITY[req.duration];
  if (!interval) throw new Error(`Unsupported duration: ${req.duration}`);

  const offset = convertDurationToOffset(req.duration);
  const endedAtMs = req.time;

  const res = await getHistoryCandles({
    category,
    symbol,
    interval,
    endTime: `${endedAtMs}`,
    limit: '100',
  });
  if (res.msg !== 'success') {
    throw new Error(`Bitget getHistoryCandles failed: ${res.code} ${res.msg}`);
  }

  const rows = res.data ?? [];
  return rows
    .map((row): IOHLC => {
      const createdAtMs = Number(row[0]);
      return {
        series_id: req.series_id,
        datasource_id: 'BITGET',
        product_id: req.product_id,
        duration: req.duration,
        created_at: formatTime(createdAtMs),
        closed_at: formatTime(createdAtMs + offset),
        open: row[1],
        high: row[2],
        low: row[3],
        close: row[4],
        volume: row[5],
        open_interest: '0',
      };
    })
    .filter((x) => Date.parse(x.created_at) < endedAtMs);
};

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'BITGET/USDT-FUTURES/',
    duration_list: Object.keys(DURATION_TO_GRANULARITY),
    direction: 'backward',
  },
  fetchOHLCPage,
);

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'BITGET/COIN-FUTURES/',
    duration_list: Object.keys(DURATION_TO_GRANULARITY),
    direction: 'backward',
  },
  fetchOHLCPage,
);

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'BITGET/SPOT/',
    duration_list: Object.keys(DURATION_TO_GRANULARITY),
    direction: 'backward',
  },
  fetchOHLCPage,
);
