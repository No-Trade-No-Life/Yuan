import { provideInterestRateService } from '@yuants/exchange';
import { IInterestRate } from '@yuants/data-interest-rate';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getFApiV1FundingRate } from '../api/public-api';

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

const fetchFundingRateForward = async (req: {
  product_id: string;
  time: number;
  series_id: string;
}): Promise<IInterestRate[]> => {
  const [, instType, symbol] = decodePath(req.product_id);
  if (instType !== 'PERP' || !symbol) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const startTime = req.time;
  const res = await getFApiV1FundingRate({
    symbol,
    startTime,
    endTime: startTime + WINDOW_MS,
    limit: 1000,
  });

  return (res ?? [])
    .map((item): IInterestRate => {
      const rate = Number(item.fundingRate);
      return {
        series_id: req.series_id,
        product_id: req.product_id,
        datasource_id: 'ASTER',
        created_at: formatTime(item.fundingTime),
        long_rate: `${-rate}`,
        short_rate: `${rate}`,
        settlement_price: '',
      };
    })
    .filter((x) => Date.parse(x.created_at) >= startTime);
};

provideInterestRateService(
  terminal,
  {
    product_id_prefix: 'ASTER/PERP/',
    direction: 'forward',
  },
  fetchFundingRateForward,
  INGEST_SERVICE_OPTIONS,
);
