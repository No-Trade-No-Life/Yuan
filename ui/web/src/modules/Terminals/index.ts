import { useTick as _useTick } from '@yuants/protocol';
import { EMPTY, switchMap } from 'rxjs';
import './TerminalList';
import { terminal$ } from './create-connection';
export { terminal$ } from './create-connection';

export const useTick = (datasource_id: string, product_id: string) =>
  terminal$.pipe(switchMap((terminal) => (terminal ? _useTick(terminal, datasource_id, product_id) : EMPTY)));
