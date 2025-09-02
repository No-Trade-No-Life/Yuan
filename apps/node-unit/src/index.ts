import '@yuants/deploy';
import { IDeployment } from '@yuants/deploy';
import { setupHandShakeService, Terminal } from '@yuants/protocol';
import { escapeSQL, ExecuteMigrations, requestSQL } from '@yuants/sql';
import {
  createKeyPair,
  decodeBase58,
  encodeBase58,
  encodePath,
  encryptByPublicKey,
  formatTime,
  fromPrivateKey,
  listWatch,
} from '@yuants/utils';
import { execSync, spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  concat,
  defer,
  EMPTY,
  firstValueFrom,
  fromEvent,
  merge,
  mergeMap,
  Observable,
  repeat,
  retry,
  share,
  takeUntil,
  tap,
} from 'rxjs';
import treeKill from 'tree-kill';

// 如果没有制定主机地址，则创建一个默认的主机管理器
// 如果设置了数据库地址，则创建一个数据库连接服务
// 不能既不设置主机地址又不设置数据库地址
if (!process.env.POSTGRES_URI && !process.env.HOST_URL) {
  throw new Error('Either POSTGRES_URI or HOST_URL must be set');
}

// 每个 Node Unit 都有一个表明其身份的公私钥对，在环境变量中可以指定，不指定时随机生成
// 用于部署鉴权，区分部署环境
const NodeUnitKeyPair = process.env.PRIVATE_KEY ? fromPrivateKey(process.env.PRIVATE_KEY) : createKeyPair();
delete process.env.PRIVATE_KEY; // 阅后即焚，防止泄漏

const NODE_UNIT_PUBLIC_KEY = NodeUnitKeyPair.public_key;

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
      address: '',
      enabled: true,
      created_at: formatTime(Date.now()),
      updated_at: formatTime(Date.now()),
    }
  : null;

if (localHostDeployment) {
  const hostUrl = new URL('ws://localhost:8888');
  if (process.env.HOST_TOKEN) {
    hostUrl.searchParams.set('host_token', process.env.HOST_TOKEN);
  }
  process.env.HOST_URL = hostUrl.toString();
}

const localPgDeployment: IDeployment | null = process.env.POSTGRES_URI
  ? {
      id: 'local-postgres-storage',
      command: PNPX_PATH ? 'pnpx' : 'npx',
      args: ['@yuants/app-postgres-storage'],
      package_name: '@yuants/app-postgres-storage',
      package_version: 'latest',
      address: '',
      env: {
        TERMINAL_ID: encodePath('PG', NODE_UNIT_PUBLIC_KEY),
      },
      enabled: true,
      created_at: formatTime(Date.now()),
      updated_at: formatTime(Date.now()),
    }
  : null;

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

    child.on('spawn', () => {
      console.info(formatTime(Date.now()), 'Spawn', ctx.command, ctx.args, child.pid);
      sub.next(); // 只发出一次，用于表示启动成功
    });

    child.on('error', (err) => {
      console.error(formatTime(Date.now()), 'Error', err);
      sub.error(err);
    });

    child.on('exit', () => {
      console.info(formatTime(Date.now()), 'Exit', ctx.command, ctx.args, child.pid);
      sub.complete();
    });

    return () => {
      treeKill(child.pid!, 'SIGKILL');
    };
  });
};

const childPublicKeys = new Set<string>();

const runDeployment = (deployment: IDeployment) => {
  const command = deployment.command;
  const executable = mapCommandToExecutable[command] || command;
  const args = deployment.args.slice();
  if (command === 'npx') {
    args.unshift('-y');
  }
  const terminalName = `${command} ${args.join(' ')}`;

  const deploymentDir = join(WORKSPACE_DIR, 'deployments', deployment.id);
  const logHome = join(WORKSPACE_DIR, 'logs');

  const needInstall = deployment.package_name && deployment.package_version;

  // 使用 node 运行这个包目录本身，会通过 main 字段去加载入口文件
  const entryFile = join(deploymentDir, 'node_modules', deployment.package_name);

  const childKeyPair = createKeyPair();
  childPublicKeys.add(childKeyPair.public_key);

  return defer(() =>
    concat(
      needInstall
        ? defer(async () => {
            // EnsureDir log
            await mkdir(logHome, { recursive: true });

            // EnsureEmptyDir deployment
            await rm(deploymentDir, { recursive: true, force: true });
            await mkdir(deploymentDir, { recursive: true });

            await writeFile(
              join(deploymentDir, 'package.json'),
              JSON.stringify({
                dependencies: {
                  [deployment.package_name]: deployment.package_version,
                },
              }),
            );
          }).pipe(mergeMap(() => EMPTY)) // suppress signal
        : EMPTY,
      needInstall
        ? spawnChild({
            command: PNPM_PATH || NPM_PATH,
            args: ['install'],
            env: Object.assign({}, process.env, deployment.env),
            cwd: deploymentDir,
            stdoutFilename: join(logHome, `${deployment.id}.install.log`),
            stderrFilename: join(logHome, `${deployment.id}.install.err.log`),
          }).pipe(mergeMap(() => EMPTY)) // suppress signal
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
                DEPLOYMENT_NODE_UNIT_ADDRESS: NODE_UNIT_PUBLIC_KEY,
                DEPLOYMENT_PRIVATE_KEY: childKeyPair.private_key,
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
        childPublicKeys.delete(childKeyPair.public_key);
      },
    }),
    //
    retry({ delay: 1000 }),
    repeat({ delay: 1000 }),
  );
};

// Setup
defer(async () => {
  if (localHostDeployment) {
    await firstValueFrom(runDeployment(localHostDeployment).pipe(share({ resetOnRefCountZero: false })));
  }

  if (localPgDeployment) {
    await firstValueFrom(runDeployment(localPgDeployment).pipe(share({ resetOnRefCountZero: false })));
  }

  const terminal = new Terminal(process.env.HOST_URL!, {
    terminal_id: encodePath('NodeUnit', NODE_UNIT_PUBLIC_KEY),
    name: '@yuants/node-unit',
  });

  setupHandShakeService(terminal, NodeUnitKeyPair.private_key);

  terminal.provideService(
    'NodeUnit/DecryptForChild',
    {
      type: 'object',
      required: ['node_unit_address', 'encrypted_data_base58', 'child_public_key'],
      properties: {
        node_unit_address: { type: 'string', const: NODE_UNIT_PUBLIC_KEY },
        encrypted_data_base58: { type: 'string' },
        child_public_key: { type: 'string' },
      },
    },
    async (msg) => {
      const { encrypted_data_base58, child_public_key } = msg.req as {
        encrypted_data_base58: string;
        child_public_key: string;
      };
      if (!childPublicKeys.has(child_public_key)) {
        return { res: { code: 403, message: 'Child public key not recognized' } };
      }
      const encrypted_data = decodeBase58(encrypted_data_base58);
      const data = encodeBase58(encryptByPublicKey(encrypted_data, child_public_key));
      return {
        res: {
          code: 0,
          message: 'OK',
          data: { data },
        },
      };
    },
  );

  ExecuteMigrations(terminal);

  defer(() =>
    requestSQL<IDeployment[]>(
      terminal,
      `select * from deployment where enabled = true and address = ${escapeSQL(NODE_UNIT_PUBLIC_KEY)}`,
    ),
  )
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
        runDeployment,
        (a, b) => a.updated_at === b.updated_at,
      ),
    )
    .subscribe();
}).subscribe();
