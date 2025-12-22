import { IInterestRate } from '@yuants/data-interest-rate';
import { provideInterestRateService } from '@yuants/exchange';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getMarginInterestRateHistory } from '../api/private-api';
import { getFutureFundingRate } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const INGEST_SERVICE_OPTIONS: IServiceOptions = {
  concurrent: 1,
  max_pending_requests: 20,
  ingress_token_capacity: 2,
  ingress_token_refill_interval: 1000,
  egress_token_capacity: 1,
  egress_token_refill_interval: 1000,
};

const WINDOW_MS = 365 * 24 * 3600_000;

const fetchUsdtFutureFundingRateForward = async (req: {
  product_id: string;
  time: number;
  series_id: string;
}): Promise<IInterestRate[]> => {
  const [, instType, symbol] = decodePath(req.product_id);
  if (instType !== 'USDT-FUTURE' || !symbol) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const startTime = req.time;
  const res = await getFutureFundingRate({
    symbol,
    startTime,
    endTime: startTime + WINDOW_MS,
    limit: 1000,
  });

  return (res ?? [])
    .map((v): IInterestRate => {
      const ms = Number(v.fundingTime);
      const rate = Number(v.fundingRate);
      return {
        series_id: req.series_id,
        product_id: req.product_id,
        datasource_id: 'BINANCE',
        created_at: formatTime(ms),
        long_rate: `${-rate}`,
        short_rate: `${rate}`,
        settlement_price: '',
      };
    })
    .filter((x) => Date.parse(x.created_at) >= startTime);
};

const fetchMarginBorrowRateForward = async (req: {
  product_id: string;
  time: number;
  series_id: string;
}): Promise<IInterestRate[]> => {
  const [, instType, asset] = decodePath(req.product_id);
  if (instType !== 'MARGIN' || !asset) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const startTime = req.time;
  const res = await getMarginInterestRateHistory({
    asset,
    startTime,
    endTime: startTime + WINDOW_MS,
    limit: 100,
  });

  return (res ?? [])
    .map((v): IInterestRate => {
      return {
        series_id: req.series_id,
        product_id: req.product_id,
        datasource_id: 'BINANCE',
        created_at: formatTime(v.timestamp),
        long_rate: v.dailyInterestRate,
        short_rate: '0',
        settlement_price: '',
      };
    })
    .filter((x) => Date.parse(x.created_at) >= startTime);
};

provideInterestRateService(
  terminal,
  {
    product_id_prefix: 'BINANCE/USDT-FUTURE/',
    direction: 'forward',
  },
  fetchUsdtFutureFundingRateForward,
  INGEST_SERVICE_OPTIONS,
);

provideInterestRateService(
  terminal,
  {
    product_id_prefix: 'BINANCE/MARGIN/',
    direction: 'forward',
  },
  fetchMarginBorrowRateForward,
  INGEST_SERVICE_OPTIONS,
);
