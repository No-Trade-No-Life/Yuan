import { IDeployment } from '@yuants/deploy';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { encodePath, formatTime, listWatch, UUID } from '@yuants/utils';
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { defer, fromEvent, merge, Observable, repeat, retry, takeUntil, tap } from 'rxjs';

// 如果没有制定主机地址，则创建一个默认的主机管理器
// 如果设置了数据库地址，则创建一个数据库连接服务
// 不能既不设置主机地址又不设置数据库地址
if (!process.env.POSTGRES_URI && !process.env.HOST_URL) {
  throw new Error('Either POSTGRES_URI or HOST_URL must be set');
}

const localHostDeployment: IDeployment | null = !process.env.HOST_URL
  ? {
      id: 'local-host',
      command: 'npx',
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
      command: 'npx',
      args: ['@yuants/app-postgres-storage'],
      env: {},
      enabled: true,
      created_at: formatTime(Date.now()),
      updated_at: formatTime(Date.now()),
    }
  : null;

const NODE_UNIT_ID = process.env.NODE_UNIT_ID || UUID();

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
        const nodePath = process.argv[0];
        const nodeBinDir = dirname(nodePath);
        const command = deployment.command;
        const executable =
          command === 'npx'
            ? join(nodeBinDir, 'npx')
            : command === 'node'
            ? nodePath
            : command === 'npm'
            ? join(nodeBinDir, 'npm')
            : command;
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
                `Deployment started: ${deployment.command} ${args.join(' ')}`,
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
                defer(async () => {
                  while (child.pid && isProcessRunning(child.pid)) {
                    console.info(formatTime(Date.now()), `DeploymentKilling`, deployment.id);
                    process.kill(child.pid, 'SIGKILL');
                    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for a second before checking again (IMPORTANT)
                  }
                  console.info(formatTime(Date.now()), `DeploymentTerminated`, deployment.id);
                }).subscribe();
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
