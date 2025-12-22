import { IInterestRate } from '@yuants/data-interest-rate';
import { provideInterestRateService } from '@yuants/exchange';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getHistoricalFundingRates } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const INGEST_SERVICE_OPTIONS: IServiceOptions = {
  concurrent: 1,
  max_pending_requests: 20,
  ingress_token_capacity: 2,
  ingress_token_refill_interval: 1000,
  egress_token_capacity: 1,
  egress_token_refill_interval: 1000,
};

const WINDOW_MS = 30 * 24 * 3600_000;

const fetchInterestRateBackward = async (req: {
  product_id: string;
  time: number;
  series_id: string;
}): Promise<IInterestRate[]> => {
  const [, marketType, symbol] = decodePath(req.product_id);
  if (marketType !== 'PERPETUAL' || !symbol) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const coin = symbol.split('-')[0];
  if (!coin) throw new Error(`Invalid symbol: ${symbol}`);

  const endTime = req.time;
  const startTime = Math.max(0, endTime - WINDOW_MS);

  const res = await getHistoricalFundingRates({ coin, startTime, endTime });

  return (res ?? [])
    .map((v): IInterestRate => {
      const ms = v.time;
      const rate = Number(v.fundingRate);
      return {
        series_id: req.series_id,
        product_id: req.product_id,
        datasource_id: 'HYPERLIQUID',
        created_at: formatTime(ms),
        long_rate: `${-rate}`,
        short_rate: `${rate}`,
        settlement_price: '',
      };
    })
    .filter((x) => Date.parse(x.created_at) < endTime);
};

provideInterestRateService(
  terminal,
  {
    product_id_prefix: 'HYPERLIQUID/PERPETUAL/',
    direction: 'backward',
  },
  fetchInterestRateBackward,
  INGEST_SERVICE_OPTIONS,
);
