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
            const variant = process.env.CTP_ENV ?? 'prod';
            const binaryMapping: Record<string, string> = {
              prod: '../ctp/build/prod/main_linux',
              cp: '../ctp/build/cp/main_linux_cp',
              demo: '../ctp/build/demo/main_linux_demo',
            };
            const binaryPath = binaryMapping[variant] ?? binaryMapping.prod;
            if (!binaryMapping[variant]) {
              console.warn(formatTime(Date.now()), `Unknown CTP_ENV "${variant}". Falling back to prod.`);
            }
            const child = spawn(join(__dirname, binaryPath), {
              stdio: 'inherit',
            });
            child.on('error', (e) => {
              console.error(formatTime(Date.now()), 'ctp_process$ error', e);
              sub.error(e);
            });
            child.on('exit', (code) => {
              console.info(formatTime(Date.now()), `CTP Bridge Exited: ${code}`);
              sub.complete();
            });

            {
              const callback = () => {
                child.kill();
              };
              process.addListener('exit', callback);
              sub.add(() => {
                process.removeListener('exit', callback);
              });
            }

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
