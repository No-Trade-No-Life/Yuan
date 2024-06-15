import { IPeriod, decodePath, encodePath } from '@yuants/data-model';
import { EMPTY, Observable } from 'rxjs';
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
  usePeriods: (product_id: string, period_in_sec: number) => Observable<IPeriod[]>,
) => {
  terminal.provideChannel<IPeriod[]>(
    { pattern: `^Period/${escapeRegExp(encodePath(datasource_id))}/.+/.+$` },
    (channel_id) => {
      const [, datasourceId, product_id, period_in_sec] = decodePath(channel_id);
      if (datasourceId !== datasource_id || !product_id || !period_in_sec) return EMPTY;
      return usePeriods(product_id, +period_in_sec);
    },
  );
};
