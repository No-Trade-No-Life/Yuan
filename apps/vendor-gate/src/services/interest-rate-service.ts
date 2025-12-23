import { IInterestRate } from '@yuants/data-interest-rate';
import { provideInterestRateService } from '@yuants/exchange';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getFutureFundingRate } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const INGEST_SERVICE_OPTIONS: IServiceOptions = {
  egress_token_capacity: 200,
  egress_token_refill_interval: 10000,
};

const WINDOW_SEC = 365 * 86400;

const fetchFundingRateBackward = async (req: {
  product_id: string;
  time: number;
  series_id: string;
}): Promise<IInterestRate[]> => {
  const [, instType, contract] = decodePath(req.product_id);
  if (instType !== 'FUTURE' || !contract) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const endedAtMs = req.time;
  const to = Math.floor(endedAtMs / 1000);
  const from = Math.max(0, to - WINDOW_SEC);

  const rows = await getFutureFundingRate('usdt', { contract, from, to, limit: 1000 });

  return (rows ?? [])
    .map((entry): IInterestRate => {
      const ms = entry.t * 1000;
      const rate = Number(entry.r);
      return {
        series_id: req.series_id,
        product_id: req.product_id,
        datasource_id: 'GATE',
        created_at: formatTime(ms),
        long_rate: `${-rate}`,
        short_rate: `${rate}`,
        settlement_price: '',
      };
    })
    .filter((x) => Date.parse(x.created_at) < endedAtMs);
};

provideInterestRateService(
  terminal,
  {
    product_id_prefix: 'GATE/FUTURE/',
    direction: 'backward',
  },
  fetchFundingRateBackward,
  INGEST_SERVICE_OPTIONS,
);
