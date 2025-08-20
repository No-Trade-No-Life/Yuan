import { IDeployment } from '@yuants/deploy';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { defer, Observable, repeat, retry, tap } from 'rxjs';

// 如果没有制定主机地址，则创建一个默认的主机管理器
// 如果设置了数据库地址，则创建一个数据库连接服务
// 不能既不设置主机地址又不设置数据库地址
if (!process.env.POSTGRES_URI && !process.env.HOST_URL) {
  throw new Error('Either POSTGRES_URI or HOST_URL must be set');
}

defer(async () => {
  const deployments: IDeployment[] = [];
  if (!process.env.HOST_URL) {
    deployments.push({
      id: 'local-host',
      command: 'npx',
      args: ['@yuants/app-host'],
      env: {},
      enabled: true,
      created_at: formatTime(Date.now()),
      updated_at: formatTime(Date.now()),
    });
  } else {
    const terminal = Terminal.fromNodeEnv();
    await requestSQL<IDeployment[]>(terminal, `select * from deployment`).then((list) => {
      list.forEach((x) => deployments.push(x));
    });
  }
  if (process.env.POSTGRES_URI) {
    deployments.push({
      id: 'local-postgres-storage',
      command: 'npx',
      args: ['@yuants/app-postgres-storage'],
      env: {
        HOST_URL: process.env.HOST_URL || 'ws://localhost:8888',
      },
      enabled: true,
      created_at: formatTime(Date.now()),
      updated_at: formatTime(Date.now()),
    });
  }
  return deployments.filter((x) => x.enabled);
})
  .pipe(
    //
    listWatch(
      (item) => item.id,
      (deployment) =>
        defer(
          () =>
            new Observable<void>((subscriber) => {
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
              const child = spawn(executable, deployment.args, {
                env: Object.assign({}, process.env, deployment.env),
                stdio: 'inherit',
              });

              child.on('error', (err) => {
                subscriber.error(err);
              });

              child.on('exit', () => {
                subscriber.complete();
              });

              return () => {
                child.kill();
              };
            }),
        ).pipe(
          tap({
            subscribe: () => {
              console.info(
                formatTime(Date.now()),
                `Starting deployment: ${deployment.command} ${deployment.args.join(' ')}`,
              );
            },
            error: (err) => {
              console.info(
                formatTime(Date.now()),
                `Deployment failed: ${deployment.command} ${deployment.args.join(' ')}, Error: ${
                  err.message || err
                }`,
              );
            },
            finalize: () => {
              console.info(
                formatTime(Date.now()),
                `Deployment finished: ${deployment.command} ${deployment.args.join(' ')}`,
              );
            },
          }),
          //
          repeat({ delay: 1000 }),
          retry({ delay: 1000 }),
        ),
    ),

    repeat({ delay: 10000 }),
    retry({ delay: 1000 }),
  )
  .subscribe();
