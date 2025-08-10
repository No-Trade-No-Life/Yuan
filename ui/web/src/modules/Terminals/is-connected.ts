import { EMPTY, shareReplay, switchMap } from 'rxjs';
import { terminal$ } from './create-connection';

export const isTerminalConnected$ = terminal$.pipe(
  switchMap((terminal) => terminal?.isConnected$ ?? EMPTY),
  shareReplay(1),
);
