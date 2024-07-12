import { IPeriod, formatTime } from '@yuants/data-model';
import { observableToAsyncIterable } from '@yuants/utils';
import { defer, filter, map, toArray } from 'rxjs';
import { IQueryPeriodsRequest } from '../services/pull';
import { Terminal } from '../terminal';
import { queryDataRecords } from './DataRecord';

/**
 * @public
 */
export const queryPeriods = (terminal: Terminal, req: IQueryPeriodsRequest) =>
  observableToAsyncIterable(
    defer(() =>
      queryDataRecords<IPeriod>(terminal, {
        type: 'period',
        time_range: [(req.start_time_in_us ?? 0) / 1000, (req.end_time_in_us ?? Date.now() * 1000) / 1000],
        tags: {
          datasource_id: req.datasource_id,
          product_id: req.product_id,
          period_in_sec: '' + req.period_in_sec,
        },
      }),
    ).pipe(
      // ISSUE: unknown reason, sometimes the data will be out of range, but frozen_at is null.
      filter((dataRecord) => {
        if (
          dataRecord.origin.timestamp_in_us + dataRecord.origin.period_in_sec * 1e6 <
          req.start_time_in_us
        ) {
          console.warn(formatTime(Date.now()), 'QueryPeriods', 'Dirty Data', JSON.stringify(dataRecord));
          return false;
        }
        return true;
      }),
      map((dataRecord) => dataRecord.origin),
      toArray(),
    ),
  );
