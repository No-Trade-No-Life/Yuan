import { defer, filter, map, retry, shareReplay, switchMap } from 'rxjs';
import { terminal$ } from '../Network';
import { requestSQL } from '@yuants/sql';

export const seriesIdList$ = terminal$.pipe(
  filter((x): x is Exclude<typeof x, null> => !!x),
  switchMap((terminal) =>
    defer(() =>
      requestSQL<{ series_id: string }[]>(
        terminal,
        `select distinct series_id from series_data_range where table_name = 'ohlc_v2'`,
      ),
    ).pipe(
      retry({ delay: 10_000 }),
      map((x) => x.map((v) => v.series_id)),
    ),
  ),
  shareReplay(1),
);
