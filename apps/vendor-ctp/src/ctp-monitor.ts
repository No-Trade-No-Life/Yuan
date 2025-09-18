import { formatTime } from '@yuants/utils';
import { spawn } from 'child_process';
import { join } from 'path';
import { BehaviorSubject, defer, Observable, repeat, retry, switchMap, timer } from 'rxjs';

export const restartCtpAction$ = new BehaviorSubject<void>(undefined);

restartCtpAction$
  .pipe(
    switchMap(() =>
      defer(
        () =>
          new Observable((sub) => {
            const child = spawn(join(__dirname, '../ctp/build/main_linux'), {
              detached: false,
              stdio: 'pipe', // 不能用 'inherit', 否则会成为僵尸进程
            });
            child.on('error', (e) => {
              console.error(formatTime(Date.now()), 'ctp_process$ error', e);
              sub.error(e);
            });
            child.on('exit', (code) => {
              console.info(formatTime(Date.now()), `CTP Bridge Exited: ${code}`);
              sub.complete();
            });
            sub.next(child);
            return () => {
              child.kill();
            };
          }),
      ).pipe(
        retry({ delay: (error, retryCount) => timer(Math.min(1000 * 2 ** retryCount, 300_000)) }),
        repeat({ delay: 1000 }),
      ),
    ),
  )
  .subscribe();
