import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import { EMPTY, catchError, defer, exhaustMap, interval, repeat, retry, tap } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

interface IRequestEmitter {
  id: string;
  interval: number;
  method: string;
  enabled: boolean;
  request: any;
  created_at: string;
  updated_at: string;
}

defer(() => requestSQL<IRequestEmitter[]>(terminal, `select * from request_emitter where enabled = true`))
  .pipe(
    retry({ delay: 5_000 }),
    repeat({ delay: 5_000 }),
    listWatch(
      (x) => x.id,
      (x) =>
        interval(x.interval)
          .pipe(
            exhaustMap(() =>
              defer(() => terminal.client.requestService(x.method, x.request)).pipe(
                tap({
                  error: (err) =>
                    console.info(formatTime(Date.now()), 'RequestEmitterRequestError', x.id, err),
                }),
                catchError(() => EMPTY),
              ),
            ),
          )
          .pipe(
            tap({
              subscribe: () =>
                console.info(
                  formatTime(Date.now()),
                  'RequestEmitterInit',
                  `Started request emitter ${x.id} (${x.method}) with interval ${x.interval} ms`,
                ),
              finalize: () =>
                console.info(
                  formatTime(Date.now()),
                  'RequestEmitterStop',
                  `Stopped request emitter ${x.id} (${x.method})`,
                ),
            }),
          ),
      (a, b) => a.updated_at === b.updated_at,
    ),
  )
  .subscribe();
