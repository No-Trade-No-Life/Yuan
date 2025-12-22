import { IInterestRate } from '@yuants/data-interest-rate';
import { provideInterestRateService } from '@yuants/exchange';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getHistoryFundingRate, IUtaHistoricalFundingRate } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const INGEST_SERVICE_OPTIONS: IServiceOptions = {
  concurrent: 1,
  max_pending_requests: 20,
  ingress_token_capacity: 2,
  ingress_token_refill_interval: 1000,
  egress_token_capacity: 1,
  egress_token_refill_interval: 1000,
};

const PAGE_SIZE = 100;

type IPageRange = { minMs: number; maxMs: number };

const computePageRangeMs = (items: IUtaHistoricalFundingRate[]): IPageRange | undefined => {
  if (items.length === 0) return undefined;
  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const item of items) {
    const ms = Number(item.fundingRateTimestamp);
    if (isNaN(ms)) continue;
    if (ms < minMs) minMs = ms;
    if (ms > maxMs) maxMs = ms;
  }
  if (!isFinite(minMs) || !isFinite(maxMs)) return undefined;
  return { minMs, maxMs };
};

const fetchFundingRatePage = async (params: {
  category: string;
  symbol: string;
  page: number;
}): Promise<IUtaHistoricalFundingRate[]> => {
  const res = await getHistoryFundingRate({
    category: params.category,
    symbol: params.symbol,
    cursor: `${params.page}`,
    limit: `${PAGE_SIZE}`,
  });
  if (res.msg !== 'success') {
    throw new Error(`Bitget getHistoryFundingRate failed: ${res.code} ${res.msg}`);
  }
  return res.data?.resultList ?? [];
};

const locatePageByTimeBackward = async (params: {
  category: string;
  symbol: string;
  targetMs: number;
}): Promise<number> => {
  const rangeCache = new Map<number, IPageRange | undefined>();

  const getRange = async (page: number): Promise<IPageRange | undefined> => {
    if (rangeCache.has(page)) return rangeCache.get(page);
    const items = await fetchFundingRatePage({ category: params.category, symbol: params.symbol, page });
    const range = computePageRangeMs(items);
    rangeCache.set(page, range);
    return range;
  };

  const page1 = await getRange(1);
  if (!page1) return 1;
  if (params.targetMs >= page1.maxMs) return 1;

  let upper = 1;
  while (true) {
    const range = await getRange(upper);
    if (!range) break;
    if (params.targetMs >= range.minMs) break;
    upper *= 2;
  }

  let right = upper;
  if (!(await getRange(right))) {
    let lo = Math.floor(upper / 2);
    let hi = upper - 1;
    let lastExisting = lo;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const r = await getRange(mid);
      if (r) {
        lastExisting = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    right = Math.max(1, lastExisting);
  }

  const rightBound = right;

  let left = 1;
  let rightSearch = rightBound;
  while (left <= rightSearch) {
    const mid = Math.floor((left + rightSearch) / 2);
    const range = await getRange(mid);
    if (!range) {
      rightSearch = mid - 1;
      continue;
    }
    if (params.targetMs > range.maxMs) {
      rightSearch = mid - 1;
      continue;
    }
    if (params.targetMs < range.minMs) {
      left = mid + 1;
      continue;
    }
    return mid;
  }

  return Math.min(Math.max(1, left), rightBound);
};

const fetchInterestRateHistoryBackward = async (req: {
  product_id: string;
  time: number;
  series_id: string;
}): Promise<IInterestRate[]> => {
  const [, category, symbol] = decodePath(req.product_id);
  if (!category || !symbol) throw new Error(`Invalid product_id: ${req.product_id}`);

  const targetMs = req.time;
  const page = await locatePageByTimeBackward({ category, symbol, targetMs });
  const items = await fetchFundingRatePage({ category, symbol, page });

  return items
    .map((x): IInterestRate => {
      const ms = Number(x.fundingRateTimestamp);
      const rate = Number(x.fundingRate);
      return {
        series_id: req.series_id,
        datasource_id: 'BITGET',
        product_id: req.product_id,
        created_at: formatTime(ms),
        long_rate: `${-rate}`,
        short_rate: `${rate}`,
        settlement_price: '',
      };
    })
    .filter((x) => Date.parse(x.created_at) < targetMs);
};

provideInterestRateService(
  terminal,
  {
    product_id_prefix: 'BITGET/USDT-FUTURES/',
    direction: 'backward',
  },
  fetchInterestRateHistoryBackward,
  INGEST_SERVICE_OPTIONS,
);

provideInterestRateService(
  terminal,
  {
    product_id_prefix: 'BITGET/COIN-FUTURES/',
    direction: 'backward',
  },
  fetchInterestRateHistoryBackward,
  INGEST_SERVICE_OPTIONS,
);
