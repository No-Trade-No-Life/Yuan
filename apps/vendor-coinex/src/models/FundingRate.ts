import { IDataRecord, encodePath } from '@yuants/data-model';

declare module '@yuants/protocol' {
  export interface IDataRecordTypes {
    funding_rate: IFundingRate;
  }
}

export interface IFundingRate {
  series_id: string;
  datasource_id: string;
  product_id: string;
  base_currency: string;
  quote_currency: string;
  funding_at: number;
  funding_rate: number;
}

export const wrapFundingRateRecord = (v: IFundingRate): IDataRecord<IFundingRate> => ({
  id: encodePath(v.datasource_id, v.product_id, v.funding_at),
  type: 'funding_rate',
  created_at: v.funding_at,
  updated_at: v.funding_at,
  frozen_at: v.funding_at,
  tags: {
    series_id: encodePath(v.datasource_id, v.product_id),
    datasource_id: v.datasource_id,
    product_id: v.product_id,
    base_currency: v.base_currency,
    quote_currency: v.quote_currency,
  },
  origin: {
    series_id: encodePath(v.datasource_id, v.product_id),
    datasource_id: v.datasource_id,
    product_id: v.product_id,
    base_currency: v.base_currency,
    quote_currency: v.quote_currency,
    funding_rate: v.funding_rate,
    funding_at: v.funding_at,
  },
});
