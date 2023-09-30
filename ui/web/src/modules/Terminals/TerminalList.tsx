import { List } from '@douyinfe/semi-ui';
import { ITerminalInfo } from '@yuants/protocol';
import { useObservableState } from 'observable-hooks';
import { defer, repeat, retry, shareReplay, switchMap, toArray } from 'rxjs';
import { terminal$ } from '../../common/create-connection';
import { registerPage } from '../Pages';
import { TerminalListItem } from './TerminalListItem';

export const terminalList$ = terminal$.pipe(
  switchMap((terminal) =>
    defer(() =>
      terminal.queryDataRecords<ITerminalInfo>(
        { type: 'terminal_info', options: { sort: [['tags.terminal_id', 1]] } },
        'MongoDB',
      ),
    ).pipe(
      //
      toArray(),
      retry({ delay: 5000 }),
      repeat({ delay: 5000 }),
    ),
  ),
  shareReplay(1),
);

registerPage('TerminalList', () => {
  const terminals = useObservableState(terminalList$, []);

  return (
    <List>
      {terminals.map((term) => (
        <TerminalListItem key={term.id} terminalInfo={term} />
      ))}
    </List>
  );
});
