import { encodePath } from '@yuants/utils';
import { addDataRecordWrapper } from './DataRecord';

declare module './DataRecord' {
  export interface IDataRecordTypes {
    funding_rate: IFundingRate;
  }
}

/**
 * Funding Rate
 * @public
 */
interface IFundingRate {
  series_id: string;
  datasource_id: string;
  product_id: string;
  funding_at: number;
  funding_rate: number;
}

addDataRecordWrapper('funding_rate', (v) => ({
  id: encodePath(v.series_id, v.funding_at),
  type: 'funding_rate',
  created_at: v.funding_at,
  updated_at: v.funding_at,
  frozen_at: v.funding_at,
  tags: {
    series_id: v.series_id,
    datasource_id: v.datasource_id,
    product_id: v.product_id,
  },
  origin: v,
}));
