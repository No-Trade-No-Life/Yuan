import { Terminal } from '@yuants/protocol';
import { loadSecrets } from '@yuants/secret';
import { formatTime, listWatch } from '@yuants/utils';
import cluster from 'cluster';
import { bufferTime, defer, filter, map, Observable, repeat, retry, Subject, tap } from 'rxjs';
import { overrideConsole } from './logger';

overrideConsole();

if (cluster.isPrimary) {
  console.info(`[Primary] ${formatTime(Date.now())} This is the primary process`);

  const logBuffer = new Subject<string>();

  logBuffer
    .pipe(
      //
      bufferTime(100),
      map((v) => v.join('\n')),
      filter((v) => v.trim() !== ''),
    )
    .subscribe((message) => {
      console.info(message);
    });

  defer(() =>
    loadSecrets<{ access_key: string; secret_key: string; passphrase: string }>({
      terminal: Terminal.fromNodeEnv(),
      encryption_key_base58: process.env.ENCRYPTION_KEY_BASE58!,
    }),
  )
    .pipe(
      //
      tap({
        error: (e) => {
          console.error(`[Primary] ${formatTime(Date.now())} Failed to load secrets`, e);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 5000 }),
    )
    .pipe(
      listWatch(
        (x) => x.secret.id,
        (account) =>
          defer(
            () =>
              new Observable((subscriber) => {
                console.info(
                  formatTime(Date.now()),
                  `[Primary] ${formatTime(Date.now())} Starting worker for account ${
                    account.secret.public_data.name
                  } (${account.secret.id})`,
                );
                if (account.secret.public_data.type !== 'api_key_okx') return;
                if (!account.secret.public_data.name) return;
                if (!account.decrypted_data) return;
                if (!account.decrypted_data.access_key) return;
                if (!account.decrypted_data.secret_key) return;
                if (!account.decrypted_data.passphrase) return;

                const worker = cluster.fork({
                  ENCRYPTION_KEY_BASE58: '',
                  ACCESS_KEY: account.decrypted_data.access_key,
                  SECRET_KEY: account.decrypted_data.secret_key,
                  PASSPHRASE: account.decrypted_data.passphrase,
                  WRITE_QUOTE_TO_SQL: account.secret.public_data.write_quote_to_sql ? 'true' : 'false',
                  TERMINAL_ID: `@yuants/vendor-okx/worker/${account.secret.public_data.name}`,
                  WORKER_LABEL: account.secret.public_data.name,
                });

                // ignore the worker's stdout and stderr by default
                // if (worker.process.stdout) {
                //   worker.process.stdout.pipe(process.stdout);
                // }
                // if (worker.process.stderr) {
                //   worker.process.stderr.pipe(process.stderr);
                // }

                worker.on('message', (message: any) => {
                  if (message.type === 'log') {
                    logBuffer.next(
                      `[Worker ${worker.process.pid} ${message.label}] ${message.level}: ${message.message}`,
                    );
                  }
                });

                worker.on('exit', (code, signal) => {
                  if (code === 0) {
                    console.info(
                      `[Primary] ${formatTime(Date.now())} Worker ${worker.process.pid} exited gracefully`,
                    );
                    subscriber.complete();
                  } else {
                    console.error(
                      `[Primary] ${formatTime(Date.now())} Worker ${
                        worker.process.pid
                      } exited with code ${code} and signal ${signal}`,
                    );
                    subscriber.error(
                      new Error(`Worker ${worker.process.pid} exited with code ${code} and signal ${signal}`),
                    );
                  }
                });
                return () => {
                  worker.kill();
                  console.info(`[Primary] ${formatTime(Date.now())} Worker ${worker.process.pid} killed`);
                };
              }),
          ).pipe(
            //
            retry({ delay: 1000 }),
            repeat({ delay: 1000 }), // 重试间隔为 1 秒
          ),
        (a, b) => a.secret.updated_at === b.secret.updated_at,
      ),
    )
    .subscribe();
} else {
  console.info(`${formatTime(Date.now())} This is the worker process`, process.pid, process.env);
  // import('./logger').then(({ overrideConsole }) => {
  //   overrideConsole();
  //   import('./index');
  // });
  import('./index');
}
