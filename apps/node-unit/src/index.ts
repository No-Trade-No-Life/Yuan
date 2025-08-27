import { IDeployment } from '@yuants/deploy';
import { Terminal } from '@yuants/protocol';
import { ExecuteMigrations, requestSQL } from '@yuants/sql';
import { encodePath, formatTime, listWatch, UUID } from '@yuants/utils';
import { execSync, spawn } from 'child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { concat, defer, EMPTY, fromEvent, merge, Observable, repeat, retry, takeUntil, tap } from 'rxjs';
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

const WORKSPACE_DIR = join(tmpdir(), 'yuants', 'node-unit');
console.info('Workspace Dir:', WORKSPACE_DIR);

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
      package_name: '@yuants/app-host',
      package_version: 'latest',
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
      package_name: '@yuants/app-postgres-storage',
      package_version: 'latest',
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

ExecuteMigrations(terminal);

const kill$ = merge(fromEvent(process, 'SIGINT'), fromEvent(process, 'SIGTERM'));

kill$.subscribe(() => {
  process.exit();
});

const spawnChild = (ctx: {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  stdoutFilename: string;
  stderrFilename: string;
}) => {
  return new Observable<void>((sub) => {
    // console.info(formatTime(Date.now()), 'Spawn', JSON.stringify(ctx));
    const child = spawn(ctx.command, ctx.args, {
      env: ctx.env,
      cwd: ctx.cwd,
    });

    child.stdout.pipe(createWriteStream(ctx.stdoutFilename, { flags: 'a' }));
    child.stderr.pipe(createWriteStream(ctx.stderrFilename, { flags: 'a' }));

    child.on('error', (err) => {
      console.error(formatTime(Date.now()), 'Error', err);
      sub.error(err);
    });

    child.on('exit', () => {
      console.info(formatTime(Date.now()), 'Exit');
      sub.complete();
    });

    return () => {
      treeKill(child.pid!, 'SIGKILL');
    };
  });
};

defer(async () => {
  const deployments: IDeployment[] = [];
  if (localHostDeployment) {
    deployments.push(localHostDeployment);
  }
  if (localPgDeployment) {
    deployments.push(localPgDeployment);
  }
  await requestSQL<IDeployment[]>(terminal, `select * from deployment where enabled = true`).then((list) => {
    list.forEach((x) => {
      deployments.push(x);
    });
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

        const deploymentDir = join(WORKSPACE_DIR, 'deployments', deployment.id);
        const logHome = join(WORKSPACE_DIR, 'logs');

        mkdirSync(logHome, { recursive: true });
        mkdirSync(deploymentDir, { recursive: true });

        const needInstall = deployment.package_name && deployment.package_version;

        // 使用 node 运行这个包目录本身，会通过 main 字段去加载入口文件
        const entryFile = join(deploymentDir, 'node_modules', deployment.package_name);

        if (needInstall) {
          writeFileSync(
            join(deploymentDir, 'package.json'),
            JSON.stringify({
              dependencies: {
                [deployment.package_name]: deployment.package_version,
              },
            }),
          );
        }

        return defer(() =>
          concat(
            needInstall
              ? spawnChild({
                  command: PNPM_PATH || NPM_PATH,
                  args: ['install'],
                  env: Object.assign({}, process.env, deployment.env),
                  cwd: deploymentDir,
                  stdoutFilename: join(logHome, `${deployment.id}.install.log`),
                  stderrFilename: join(logHome, `${deployment.id}.install.err.log`),
                })
              : EMPTY,

            needInstall
              ? spawnChild({
                  command: NODE_PATH,
                  args: [entryFile],
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
                  cwd: deploymentDir,
                  stdoutFilename: join(logHome, `${deployment.id}.log`),
                  stderrFilename: join(logHome, `${deployment.id}.err.log`),
                })
              : spawnChild({
                  command: executable,
                  args,
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
                  cwd: deploymentDir,
                  stdoutFilename: join(logHome, `${deployment.id}.log`),
                  stderrFilename: join(logHome, `${deployment.id}.err.log`),
                }),
          ),
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
