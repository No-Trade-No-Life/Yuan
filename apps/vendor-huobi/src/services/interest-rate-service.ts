import { IInterestRate } from '@yuants/data-interest-rate';
import { provideInterestRateService } from '@yuants/exchange';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getSwapHistoricalFundingRate } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const INGEST_SERVICE_OPTIONS: IServiceOptions = {
  concurrent: 1,
  max_pending_requests: 20,
  ingress_token_capacity: 2,
  ingress_token_refill_interval: 1000,
  egress_token_capacity: 1,
  egress_token_refill_interval: 1000,
};

const PAGE_SIZE = 50;

type IPageRange = { minMs: number; maxMs: number };

const computePageRangeMs = (items: Array<{ funding_time: string }>): IPageRange | undefined => {
  if (items.length === 0) return undefined;
  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const item of items) {
    const ms = Number(item.funding_time);
    if (isNaN(ms)) continue;
    if (ms < minMs) minMs = ms;
    if (ms > maxMs) maxMs = ms;
  }
  if (!isFinite(minMs) || !isFinite(maxMs)) return undefined;
  return { minMs, maxMs };
};

const fetchFundingRatePage = async (params: {
  contract_code: string;
  pageIndex: number;
}): Promise<{
  items: Array<{ funding_rate: string; funding_time: string }>;
  totalPage: number;
}> => {
  const res = await getSwapHistoricalFundingRate({
    contract_code: params.contract_code,
    page_index: params.pageIndex,
    page_size: PAGE_SIZE,
  });
  if (res.status !== 'ok') {
    throw new Error(`HTX getSwapHistoricalFundingRate failed: ${res.status}`);
  }
  return {
    items: res.data.data ?? [],
    totalPage: res.data.total_page,
  };
};

const locatePageByTimeBackward = async (params: {
  contract_code: string;
  targetMs: number;
}): Promise<{ pageIndex: number; totalPage: number }> => {
  const first = await fetchFundingRatePage({ contract_code: params.contract_code, pageIndex: 0 });
  const totalPage = first.totalPage;
  if (!totalPage || totalPage <= 1) return { pageIndex: 0, totalPage: totalPage || 1 };

  const rangeCache = new Map<number, IPageRange | undefined>([[0, computePageRangeMs(first.items)]]);

  const getRange = async (pageIndex: number): Promise<IPageRange | undefined> => {
    if (rangeCache.has(pageIndex)) return rangeCache.get(pageIndex);
    const page = await fetchFundingRatePage({ contract_code: params.contract_code, pageIndex });
    const range = computePageRangeMs(page.items);
    rangeCache.set(pageIndex, range);
    return range;
  };

  let left = 0;
  let right = totalPage - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const range = await getRange(mid);
    if (!range) {
      right = mid - 1;
      continue;
    }
    if (params.targetMs > range.maxMs) {
      right = mid - 1;
      continue;
    }
    if (params.targetMs < range.minMs) {
      left = mid + 1;
      continue;
    }
    return { pageIndex: mid, totalPage };
  }

  return { pageIndex: Math.min(Math.max(0, left), totalPage - 1), totalPage };
};

const fetchFundingRateBackward = async (req: {
  product_id: string;
  time: number;
  series_id: string;
}): Promise<IInterestRate[]> => {
  const [, instType, contract_code] = decodePath(req.product_id);
  if (instType !== 'SWAP' || !contract_code) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const targetMs = req.time;
  const { pageIndex } = await locatePageByTimeBackward({ contract_code, targetMs });
  const page = await fetchFundingRatePage({ contract_code, pageIndex });

  return page.items
    .map((v): IInterestRate => {
      const ms = Number(v.funding_time);
      const rate = Number(v.funding_rate);
      return {
        series_id: req.series_id,
        product_id: req.product_id,
        datasource_id: 'HTX',
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
    product_id_prefix: 'HTX/SWAP/',
    direction: 'backward',
  },
  fetchFundingRateBackward,
  INGEST_SERVICE_OPTIONS,
);
