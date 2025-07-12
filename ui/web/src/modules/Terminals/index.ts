import { ITick } from '@yuants/data-model';
import { encodePath } from '@yuants/utils';
import { EMPTY, switchMap } from 'rxjs';
import './ServiceList';
import './TerminalDetail';
import './TerminalList';
import { terminal$ } from './create-connection';
export * from './InlineTerminalId';
export * from './create-connection';
export * from './is-connected';

export const useTick = (datasource_id: string, product_id: string) =>
  terminal$.pipe(
    switchMap((terminal) =>
      terminal
        ? terminal.channel.subscribeChannel<ITick>('Tick', encodePath(datasource_id, product_id))
        : EMPTY,
    ),
  );
