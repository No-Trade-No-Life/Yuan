import { IDataRecord, IPeriod } from '@yuants/data-model';

/**
 * Map Period to data record
 * Use the start time of the Period as the creation time of the data record, use the end time of the Period as the update time, and use the end time of the K-line as the freeze time
 * Can be safely cached
 *
 * @public
 */
export const wrapPeriod = (period: IPeriod): IDataRecord<IPeriod> => {
  const period_end_time = period.timestamp_in_us / 1000 + period.period_in_sec * 1000;
  return {
    id: `${period.datasource_id}/${period.product_id}/${period.period_in_sec}/${period.timestamp_in_us}`,
    type: `period`,
    created_at: period.timestamp_in_us / 1000,
    updated_at: Date.now(),
    frozen_at: period_end_time < Date.now() ? period_end_time : null,
    tags: {
      datasource_id: period.datasource_id,
      product_id: period.product_id,
      period_in_sec: '' + period.period_in_sec,
    },
    origin: period,
  };
};
