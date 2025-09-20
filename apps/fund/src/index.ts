import { useAccountInfo } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import { EMPTY, catchError, defer, firstValueFrom, interval, repeat, retry, switchMap, tap } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

interface IFundEvent {
  account_id: string;
  events: any[];
}

// Automatically record equity every 10 minutes
defer(() => requestSQL<IFundEvent[]>(terminal, `select * from fund_event`))
  .pipe(
    retry({ delay: 5_000 }),
    repeat({ delay: 5_000 }),
    listWatch(
      (x) => x.account_id,
      (x) =>
        interval(60_000 * 10) // 10 minutes
          .pipe(
            switchMap(() =>
              defer(async () => {
                const accountInfo = await firstValueFrom(useAccountInfo(terminal, x.account_id));
                await requestSQL(
                  terminal,
                  `update fund_event set events = events || ${escapeSQL({
                    type: 'equity',
                    updated_at: formatTime(accountInfo.updated_at),
                    fund_equity: { equity: accountInfo.money.equity },
                  })} where account_id = ${escapeSQL(x.account_id)}`,
                );
              }).pipe(
                tap({
                  error: (err) =>
                    console.info(formatTime(Date.now()), 'EquityRecordError', x.account_id, err),
                }),
                catchError(() => EMPTY),
              ),
            ),
          )
          .pipe(
            tap({
              subscribe: () =>
                console.info(formatTime(Date.now()), 'FundMonitorStart', `account_id=${x.account_id}`),
              finalize: () =>
                console.info(formatTime(Date.now()), 'FundMonitorStop', `account_id=${x.account_id}`),
            }),
          ),
      () => true,
    ),
  )
  .subscribe();
