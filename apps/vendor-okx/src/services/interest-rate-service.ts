import { IInterestRate } from '@yuants/data-interest-rate';
import { provideInterestRateService } from '@yuants/exchange';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { getFundingRateHistory, getLendingRateHistory } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const INGEST_SERVICE_OPTIONS: IServiceOptions = {
  concurrent: 1,
  max_pending_requests: 20,
  ingress_token_capacity: 2,
  ingress_token_refill_interval: 1000,
  egress_token_capacity: 1,
  egress_token_refill_interval: 1000,
};

const fetchSwapFundingRateBackward = async (req: {
  product_id: string;
  time: number;
  series_id: string;
}): Promise<IInterestRate[]> => {
  const [, instType, instId] = decodePath(req.product_id);
  if (instType !== 'SWAP' || !instId) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const endedAtMs = req.time;
  const res = await getFundingRateHistory({ instId, after: `${endedAtMs}` });
  if (res.code !== '0') {
    throw new Error(`OKX getFundingRateHistory failed: ${res.code} ${res.msg}`);
  }

  return res.data
    .map((v): IInterestRate => {
      const ms = Number(v.fundingTime);
      const rate = Number(v.fundingRate);
      return {
        series_id: req.series_id,
        product_id: req.product_id,
        datasource_id: 'OKX',
        created_at: formatTime(ms),
        long_rate: `${-rate}`,
        short_rate: `${rate}`,
        settlement_price: '',
      };
    })
    .filter((x) => Date.parse(x.created_at) < endedAtMs);
};

const fetchMarginInterestRateBackward = async (req: {
  product_id: string;
  time: number;
  series_id: string;
}): Promise<IInterestRate[]> => {
  const [, instType, instId] = decodePath(req.product_id);
  if (instType !== 'MARGIN' || !instId) throw new Error(`Unsupported product_id: ${req.product_id}`);

  const [base, quote] = instId.split('-');
  if (!base || !quote) throw new Error(`Invalid MARGIN instId: ${instId}`);

  const endedAtMs = req.time;

  const [resBase, resQuote] = await Promise.all([
    getLendingRateHistory({ ccy: base, after: `${endedAtMs}` }),
    getLendingRateHistory({ ccy: quote, after: `${endedAtMs}` }),
  ]);

  if (resBase.code !== '0')
    throw new Error(`OKX getLendingRateHistory failed: ${resBase.code} ${resBase.msg}`);
  if (resQuote.code !== '0')
    throw new Error(`OKX getLendingRateHistory failed: ${resQuote.code} ${resQuote.msg}`);

  const mapTsToBaseRate = new Map<string, string>();
  resBase.data.forEach((v) => mapTsToBaseRate.set(v.ts, v.rate));

  const data: IInterestRate[] = [];
  resQuote.data.forEach((v) => {
    const baseRate = mapTsToBaseRate.get(v.ts);
    if (!baseRate) return;

    const longRate = Number(v.rate) / 365 / 24;
    const shortRate = Number(baseRate) / 365 / 24;

    data.push({
      series_id: req.series_id,
      product_id: req.product_id,
      datasource_id: 'OKX',
      created_at: formatTime(+v.ts),
      long_rate: `${-longRate}`,
      short_rate: `${-shortRate}`,
      settlement_price: '',
    });
  });

  return data.filter((x) => Date.parse(x.created_at) < endedAtMs);
};

provideInterestRateService(
  terminal,
  {
    product_id_prefix: 'OKX/SWAP/',
    direction: 'backward',
  },
  fetchSwapFundingRateBackward,
  INGEST_SERVICE_OPTIONS,
);

provideInterestRateService(
  terminal,
  {
    product_id_prefix: 'OKX/MARGIN/',
    direction: 'backward',
  },
  fetchMarginInterestRateBackward,
  INGEST_SERVICE_OPTIONS,
);
