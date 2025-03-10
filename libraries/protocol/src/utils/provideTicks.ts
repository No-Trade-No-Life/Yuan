import { ITick, decodePath, encodePath } from '@yuants/data-model';
import { EMPTY, ObservableInput } from 'rxjs';
import { Terminal } from '../terminal';
import { escapeRegExp } from './escapeRegExp';

/**
 * Provide a Tick data stream, push to all subscriber terminals
 *
 * @public
 */
export const provideTicks = (
  terminal: Terminal,
  datasource_id: string,
  useTicks: (product_id: string) => ObservableInput<ITick>,
) => {
  terminal.provideChannel<ITick>(
    { pattern: `^Tick/${escapeRegExp(encodePath(datasource_id))}/.+$` },
    (channel_id) => {
      const [, datasourceId, product_id] = decodePath(channel_id);
      if (datasourceId !== datasource_id || !product_id) return EMPTY;
      return useTicks(product_id);
    },
  );
  terminal.channel.publishChannel(
    'Tick',
    { pattern: `^${escapeRegExp(encodePath(datasource_id))}/` },
    (channel_id) => {
      const [datasourceId, product_id] = decodePath(channel_id);
      if (datasourceId !== datasource_id || !product_id) return EMPTY;
      return useTicks(product_id);
    },
  );
};

/**
 * use tick data stream
 * @public
 */
export const useTick = (terminal: Terminal, datasource_id: string, product_id: string) =>
  terminal.channel.subscribeChannel<ITick>('Tick', encodePath(datasource_id, product_id));
