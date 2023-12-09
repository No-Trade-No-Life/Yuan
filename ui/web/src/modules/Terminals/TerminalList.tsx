import { List } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import { of, shareReplay, switchMap } from 'rxjs';
import { registerPage } from '../Pages';
import { TerminalListItem } from './TerminalListItem';
import { terminal$ } from './create-connection';

export const terminalList$ = terminal$.pipe(
  switchMap((terminal) => terminal?.terminalInfos$ ?? of([])),
  shareReplay(1),
);

registerPage('TerminalList', () => {
  const terminals = useObservableState(terminalList$, []);

  return (
    <List>
      {terminals.map((term) => (
        <TerminalListItem key={term.terminal_id} terminalInfo={term} />
      ))}
    </List>
  );
});
