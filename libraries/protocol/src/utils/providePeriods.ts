import { IPeriod, decodePath, encodePath } from '@yuants/data-model';
import { EMPTY, ObservableInput } from 'rxjs';
import { Terminal } from '../terminal';
import { escapeRegExp } from './escapeRegExp';

/**
 * Provide a Period data stream, push to all subscriber terminals
 *
 * @public
 */
export const providePeriods = (
  terminal: Terminal,
  datasource_id: string,
  usePeriods: (product_id: string, period_in_sec: number) => ObservableInput<IPeriod[]>,
) => {
  terminal.provideChannel<IPeriod[]>(
    { pattern: `^Period/${escapeRegExp(encodePath(datasource_id))}/.+/.+$` },
    (channel_id) => {
      const [, datasourceId, product_id, period_in_sec] = decodePath(channel_id);
      if (datasourceId !== datasource_id || !product_id || !period_in_sec) return EMPTY;
      return usePeriods(product_id, +period_in_sec);
    },
  );
  terminal.channel.publishChannel(
    'Periods',
    { pattern: `^${escapeRegExp(encodePath(datasource_id))}/` },
    (channel_id) => {
      const [datasourceId, product_id, period_in_sec] = decodePath(channel_id);
      if (datasourceId !== datasource_id || !product_id || !period_in_sec) return EMPTY;
      return usePeriods(product_id, +period_in_sec);
    },
  );
};

/**
 * use period data stream
 * @public
 */
export const usePeriod = (
  terminal: Terminal,
  datasource_id: string,
  product_id: string,
  period_in_sec: number,
) =>
  terminal.channel.subscribeChannel<IPeriod[]>(
    'Periods',
    encodePath(datasource_id, product_id, period_in_sec),
  );
