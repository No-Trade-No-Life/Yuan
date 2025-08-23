import { IDeployment } from '@yuants/deploy';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { encodePath, formatTime, listWatch, UUID } from '@yuants/utils';
import { execSync, spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { defer, fromEvent, merge, Observable, repeat, retry, takeUntil, tap } from 'rxjs';
import treeKill from 'tree-kill';

// 如果没有制定主机地址，则创建一个默认的主机管理器
// 如果设置了数据库地址，则创建一个数据库连接服务
// 不能既不设置主机地址又不设置数据库地址
if (!process.env.POSTGRES_URI && !process.env.HOST_URL) {
  throw new Error('Either POSTGRES_URI or HOST_URL must be set');
}

const NODE_UNIT_ID = process.env.NODE_UNIT_ID || UUID();

const NODE_PATH = execSync('which node || echo ""', { encoding: 'utf-8' }).trim();
const NPM_PATH = execSync('which npm || echo ""', { encoding: 'utf-8' }).trim();
const NPX_PATH = execSync('which npx || echo ""', { encoding: 'utf-8' }).trim();
const PNPM_PATH = execSync('which pnpm || echo ""', { encoding: 'utf-8' }).trim();
const PNPX_PATH = execSync('which pnpx || echo ""', { encoding: 'utf-8' }).trim();

const mapCommandToExecutable: Record<string, string> = {
  node: NODE_PATH,
  npm: NPM_PATH,
  npx: NPX_PATH,
  pnpm: PNPM_PATH,
  pnpx: PNPX_PATH,
};

const localHostDeployment: IDeployment | null = !process.env.HOST_URL
  ? {
      id: 'local-host',
      command: PNPX_PATH ? 'pnpx' : 'npx',
      args: ['@yuants/app-host'],
      env: {},
      enabled: true,
      created_at: formatTime(Date.now()),
      updated_at: formatTime(Date.now()),
    }
  : null;

if (localHostDeployment) {
  process.env.HOST_URL = `ws://localhost:8888`;
}

const localPgDeployment: IDeployment | null = process.env.POSTGRES_URI
  ? {
      id: 'local-postgres-storage',
      command: PNPX_PATH ? 'pnpx' : 'npx',
      args: ['@yuants/app-postgres-storage'],
      env: {
        TERMINAL_ID: encodePath('PG', NODE_UNIT_ID),
      },
      enabled: true,
      created_at: formatTime(Date.now()),
      updated_at: formatTime(Date.now()),
    }
  : null;

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: encodePath('NodeUnit', NODE_UNIT_ID),
  name: '@yuants/node-unit',
});

const kill$ = merge(fromEvent(process, 'SIGINT'), fromEvent(process, 'SIGTERM'));

kill$.subscribe(() => {
  process.exit();
});

defer(async () => {
  const deployments: IDeployment[] = [];
  if (localHostDeployment) {
    deployments.push(localHostDeployment);
  }
  if (localPgDeployment) {
    deployments.push(localPgDeployment);
  }
  await requestSQL<IDeployment[]>(terminal, `select * from deployment where enabled = true`).then((list) => {
    list.forEach((x) => deployments.push(x));
  });
  return deployments;
})
  .pipe(
    repeat({ delay: 10000 }),
    retry({ delay: 1000 }),
    tap((deployments) => {
      console.info(formatTime(Date.now()), 'Deployments', deployments.length);
      console.table(deployments);
    }),
    takeUntil(kill$),
    //
    listWatch(
      (item) => item.id,
      (deployment) => {
        const command = deployment.command;
        const executable = mapCommandToExecutable[command] || command;
        const args = deployment.args.slice();
        if (command === 'npx') {
          args.unshift('-y');
        }
        const terminalName = `${command} ${args.join(' ')}`;
        return defer(
          () =>
            new Observable<void>((subscriber) => {
              const child = spawn(executable, args, {
                env: Object.assign(
                  {},
                  process.env,
                  {
                    HOST_URL: process.env.HOST_URL,
                    TERMINAL_ID: encodePath('Deployment', deployment.id),
                    TERMINAL_NAME: terminalName,
                  },
                  deployment.env,
                ),
              });

              const logHome = join(tmpdir(), 'yuants', 'node-unit', 'logs');

              mkdirSync(logHome, { recursive: true });

              const stdoutFilename = join(logHome, `${deployment.id}.log`);
              child.stdout.pipe(createWriteStream(stdoutFilename, { flags: 'a' }));
              const stderrFilename = join(logHome, `${deployment.id}.err.log`);
              child.stderr.pipe(createWriteStream(stderrFilename, { flags: 'a' }));

              console.info(
                formatTime(Date.now()),
                `Deployment started: ${terminalName}`,
                `stdout: ${stdoutFilename}`,
                `stderr: ${stderrFilename}`,
              );

              child.on('error', (err) => {
                subscriber.error(err);
              });

              child.on('exit', () => {
                subscriber.complete();
              });

              function isProcessRunning(pid: number): boolean {
                try {
                  process.kill(pid, 0);
                  return true; // Process exists
                } catch (e) {
                  console.info(deployment.id, 'Process check failed', e);
                  return e.code === 'ESRCH' ? false : true; // ESRCH means no such process
                }
              }

              return () => {
                defer(
                  () =>
                    new Observable((sub) => {
                      treeKill(child.pid!, 'SIGKILL', (err) => {
                        if (err) {
                          sub.error(err);
                        } else {
                          sub.complete();
                        }
                      });
                    }),
                )
                  .pipe(
                    tap({
                      subscribe: () => {
                        console.info(formatTime(Date.now()), `DeploymentKilling`, deployment.id);
                      },
                      error: (err) => {
                        console.error(formatTime(Date.now()), 'DeploymentKillFailed', deployment.id, err);
                      },
                      complete: () => {
                        console.info(formatTime(Date.now()), `DeploymentTerminated`, deployment.id);
                      },
                    }),
                    retry({ delay: 5000 }),
                  )
                  .subscribe();
              };
            }),
        ).pipe(
          tap({
            subscribe: () => {
              console.info(formatTime(Date.now()), 'DeploymentStart', deployment.id, terminalName);
            },
            error: (err) => {
              console.info(
                formatTime(Date.now()),
                'DeploymentFailed',
                deployment.id,
                terminalName,
                `Error: ${err.message || err}`,
              );
            },
            finalize: () => {
              console.info(formatTime(Date.now()), `DeploymentComplete`, deployment.id, terminalName);
            },
          }),
          //
          retry({ delay: 1000 }),
          repeat({ delay: 1000 }),
        );
      },
      (a, b) => a.updated_at === b.updated_at,
    ),
  )
  .subscribe();
