import { IOHLC } from '@yuants/data-ohlc';
import { provideOHLCService } from '@yuants/exchange';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { convertDurationToOffset, decodePath, formatTime } from '@yuants/utils';
import { getHistoryCandles } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const INGEST_SERVICE_OPTIONS: IServiceOptions = {
  egress_token_capacity: 20,
  egress_token_refill_interval: 2000,
};

const DURATION_TO_OKX_BAR_TYPE: Record<string, string> = {
  PT1M: '1m',
  PT3M: '3m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',

  PT1H: '1H',
  PT2H: '2H',
  PT4H: '4H',
  PT6H: '6H',
  PT12H: '12H',

  P1D: '1D',
  P1W: '1W',
  P1M: '1M',
};

const fetchOHLCPageBackward = async (req: {
  product_id: string;
  duration: string;
  time: number;
  series_id: string;
}): Promise<IOHLC[]> => {
  const [, instType, instId] = decodePath(req.product_id);
  if (!instType || !instId) throw new Error(`Invalid product_id: ${req.product_id}`);

  const bar = DURATION_TO_OKX_BAR_TYPE[req.duration];
  if (!bar) throw new Error(`Unsupported duration: ${req.duration}`);

  const offset = convertDurationToOffset(req.duration);
  const endedAtMs = req.time;

  const res = await getHistoryCandles({
    instId,
    bar,
    after: `${endedAtMs}`,
    limit: '300',
  });
  if (res.code !== '0') {
    throw new Error(`OKX getHistoryCandles failed: ${res.code} ${res.msg}`);
  }

  return res.data
    .map(
      (x): IOHLC => ({
        series_id: req.series_id,
        datasource_id: 'OKX',
        product_id: req.product_id,
        duration: req.duration,
        created_at: formatTime(+x[0]),
        closed_at: formatTime(+x[0] + offset),
        open: x[1],
        high: x[2],
        low: x[3],
        close: x[4],
        volume: x[5],
        open_interest: '0',
      }),
    )
    .filter((x) => Date.parse(x.created_at) < endedAtMs);
};

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'OKX/SWAP/',
    duration_list: Object.keys(DURATION_TO_OKX_BAR_TYPE),
    direction: 'backward',
  },
  fetchOHLCPageBackward,
  INGEST_SERVICE_OPTIONS,
);

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'OKX/SPOT/',
    duration_list: Object.keys(DURATION_TO_OKX_BAR_TYPE),
    direction: 'backward',
  },
  fetchOHLCPageBackward,
  INGEST_SERVICE_OPTIONS,
);

provideOHLCService(
  terminal,
  {
    product_id_prefix: 'OKX/MARGIN/',
    duration_list: Object.keys(DURATION_TO_OKX_BAR_TYPE),
    direction: 'backward',
  },
  fetchOHLCPageBackward,
  INGEST_SERVICE_OPTIONS,
);
