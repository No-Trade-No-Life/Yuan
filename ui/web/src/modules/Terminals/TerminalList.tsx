import { List } from '@douyinfe/semi-ui';
import { ITerminalInfo } from '@yuants/protocol';
import { useObservableState } from 'observable-hooks';
import { EMPTY, defer, map, repeat, retry, shareReplay, switchMap, toArray } from 'rxjs';
import { registerPage } from '../Pages';
import { TerminalListItem } from './TerminalListItem';
import { terminal$ } from './create-connection';

export const terminalList$ = terminal$.pipe(
  switchMap((terminal) =>
    terminal
      ? defer(() => terminal.request('ListTerminals', '@host', {})).pipe(
          //
          map((msg) => msg.res?.data ?? []),
          // toArray(),
          retry({ delay: 5000 }),
          repeat({ delay: 5000 }),
        )
      : EMPTY,
  ),
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
