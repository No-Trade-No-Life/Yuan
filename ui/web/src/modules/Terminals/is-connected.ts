import { EMPTY, shareReplay, switchMap } from 'rxjs';
import { terminal$ } from './create-connection';

export const isTerminalConnnected$ = terminal$.pipe(
  switchMap((terminal) => terminal?.isConnected$ ?? EMPTY),
  shareReplay(1),
);
