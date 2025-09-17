import '@yuants/deploy';
import { IDeployment } from '@yuants/deploy';
import { setupHandShakeService, Terminal } from '@yuants/protocol';
import { escapeSQL, ExecuteMigrations, requestSQL } from '@yuants/sql';
import {
  createKeyPair,
  decodeBase58,
  decryptByPrivateKey,
  encodeBase58,
  encodePath,
  encryptByPublicKey,
  formatTime,
  fromSeed,
  IEd25519KeyPair,
  listWatch,
  sha256,
  UUID,
} from '@yuants/utils';
import { execSync, spawn } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { hostname, tmpdir } from 'os';
import { join } from 'path';
import {
  concat,
  defer,
  EMPTY,
  firstValueFrom,
  fromEvent,
  map,
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
const getNodeKeyPairFromEnv = async (): Promise<IEd25519KeyPair> => {
  const password = process.env.NODE_UNIT_PASSWORD || UUID();
  delete process.env.NODE_UNIT_PASSWORD; // 阅后即焚，防止泄漏
  const nodeUnitName = process.env.NODE_UNIT_NAME || hostname();
  const seed = await sha256(new TextEncoder().encode(password + nodeUnitName));
  return fromSeed(seed);
};

const getAbsolutePath = (command: string) =>
  execSync(`which ${command} || echo ""`, { encoding: 'utf-8' }).trim();

const NODE_PATH = getAbsolutePath('node');
const NPM_PATH = getAbsolutePath('npm');
const PNPM_PATH = getAbsolutePath('pnpm');

const WORKSPACE_DIR = join(tmpdir(), 'yuants', 'node-unit');
console.info('Workspace Dir:', WORKSPACE_DIR);

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

    const stdout = createWriteStream(ctx.stdoutFilename, { flags: 'a' });
    const stderr =
      ctx.stderrFilename === ctx.stdoutFilename
        ? stdout
        : createWriteStream(ctx.stderrFilename, { flags: 'a' });
    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);

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

const runDeployment = (nodeKeyPair: IEd25519KeyPair, deployment: IDeployment) => {
  const terminalName = `${deployment.package_name}@${deployment.package_version}`;

  const deploymentDir = join(WORKSPACE_DIR, 'deployments', deployment.id);
  const logHome = join(WORKSPACE_DIR, 'logs');

  // 使用 node 运行这个包目录本身，会通过 main 字段去加载入口文件
  const entryFile = join(deploymentDir, 'node_modules', deployment.package_name);

  return defer(() =>
    concat(
      defer(async () => {
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
      }).pipe(mergeMap(() => EMPTY)), // suppress signal
      spawnChild({
        command: PNPM_PATH || NPM_PATH,
        args: ['install', '-C', deploymentDir], // -C is for npm, --prefix is for pnpm, but pnpm also supports -C (可以在 htop 中显示正在安装哪个部署)
        env: Object.assign({}, process.env, deployment.env),
        cwd: deploymentDir, // 重复了，但无妨
        stdoutFilename: join(logHome, `${deployment.id}.log`),
        stderrFilename: join(logHome, `${deployment.id}.log`),
      }).pipe(mergeMap(() => EMPTY)), // suppress signal
      defer(() => {
        const childKeyPair = createKeyPair();
        childPublicKeys.add(childKeyPair.public_key);
        console.info(formatTime(Date.now()), 'DeploymentAddChildKey', deployment.id, childKeyPair.public_key);

        const isCustomCommandMode = process.env.ENABLE_CUSTOM_COMMAND === 'true' && !!deployment.command;

        // Mode 1: no command, use node to run the package (from main entry)
        // Mode 2: custom command, use the command to run the package
        return spawnChild({
          command: isCustomCommandMode
            ? getAbsolutePath(deployment.command) || deployment.command
            : NODE_PATH,
          args: isCustomCommandMode ? deployment.args : [entryFile, ...deployment.args],
          env: Object.assign(
            {},
            process.env,
            {
              HOST_URL: process.env.HOST_URL,
              TERMINAL_ID: encodePath('Deployment', deployment.id),
              TERMINAL_NAME: terminalName,
              DEPLOYMENT_NODE_UNIT_ADDRESS: nodeKeyPair.public_key,
              DEPLOYMENT_PRIVATE_KEY: childKeyPair.private_key,
            },
            deployment.env,
          ),
          // Current working directory is the installed package directory
          cwd: join(deploymentDir, 'node_modules', deployment.package_name),
          stdoutFilename: join(logHome, `${deployment.id}.log`),
          stderrFilename: join(logHome, `${deployment.id}.log`),
        }).pipe(
          tap({
            finalize: () => {
              console.info(
                formatTime(Date.now()),
                'DeploymentRemoveChildKey',
                deployment.id,
                childKeyPair.public_key,
              );
              childPublicKeys.delete(childKeyPair.public_key);
            },
          }),
        );
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
};

// Setup
defer(async () => {
  const nodeKeyPair = await getNodeKeyPairFromEnv();

  console.info(formatTime(Date.now()), 'Node Unit Address:', nodeKeyPair.public_key);

  const localHostDeployment: IDeployment | null = !process.env.HOST_URL
    ? {
        id: 'local-host',
        package_name: '@yuants/app-host',
        package_version: process.env.HOST_PACKAGE_VERSION || 'latest',
        command: '',
        args: [],
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
        package_name: '@yuants/app-postgres-storage',
        package_version: process.env.PG_PACKAGE_VERSION || 'latest',
        command: '',
        args: [],
        address: '',
        env: {
          TERMINAL_ID: encodePath('PG', nodeKeyPair.public_key),
        },
        enabled: true,
        created_at: formatTime(Date.now()),
        updated_at: formatTime(Date.now()),
      }
    : null;

  if (localHostDeployment) {
    await firstValueFrom(
      runDeployment(nodeKeyPair, localHostDeployment).pipe(share({ resetOnRefCountZero: false })),
    );
  }

  if (localPgDeployment) {
    await firstValueFrom(
      runDeployment(nodeKeyPair, localPgDeployment).pipe(share({ resetOnRefCountZero: false })),
    );
  }

  const terminal = new Terminal(process.env.HOST_URL!, {
    terminal_id: encodePath('NodeUnit', nodeKeyPair.public_key),
    name: '@yuants/node-unit',
    tags: {
      node_unit: 'true',
      node_unit_address: nodeKeyPair.public_key,
      node_unit_name: process.env.NODE_UNIT_NAME || hostname(),
      node_unit_version: require('../package.json').version,
    },
  });

  setupHandShakeService(terminal, nodeKeyPair.private_key);

  terminal.server.provideService(
    'NodeUnit/DecryptForChild',
    {
      type: 'object',
      required: ['node_unit_address', 'encrypted_data_base58', 'child_public_key'],
      properties: {
        node_unit_address: { type: 'string', const: nodeKeyPair.public_key },
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
      // decrypt with parent private key
      const decrypted_data = decryptByPrivateKey(encrypted_data, nodeKeyPair.private_key);
      if (!decrypted_data) {
        return { res: { code: 403, message: 'NodeUnit decryption failed: wrong parent private key' } };
      }
      // re-encrypt with child's public key
      const data = encodeBase58(encryptByPublicKey(decrypted_data, child_public_key));
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

  terminal.server.provideService(
    'Deployment/ReadLogSlice',
    {
      type: 'object',
      required: ['deployment_id', 'start'],
      properties: {
        deployment_id: { type: 'string' },
        start: { type: 'number', title: 'Start byte position' },
      },
    },
    async (msg) => {
      const { deployment_id, start } = msg.req as {
        deployment_id: string;
        start: number;
      };

      const logsDir = join(WORKSPACE_DIR, 'logs');

      const logPath = join(logsDir, `${deployment_id}.log`);
      // deployment_id must be a UUID v4 string, so no need to check for path traversal attack
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(deployment_id)) {
        return { res: { code: 403, message: 'Invalid deployment_id: invalid format' } };
      }
      // Guard against path traversal attack
      if (!logPath.startsWith(logsDir)) {
        return { res: { code: 403, message: 'Invalid deployment_id: path traversal attack detected' } };
      }
      const fileStat = await stat(logPath);
      if (!fileStat.isFile()) {
        return { res: { code: 404, message: 'Log file not found' } };
      }
      const fileSize = fileStat.size;
      // for given size, start, calculate the actual read range (inclusive, zero-based)
      // The read range behaves like Array.prototype.slice, we allow start to be negative to count from the end
      const theTrueStart = start < 0 ? Math.max(0, fileSize + start) : start;
      const MAX_READ_BYTES = 128 * 1024; // 128 KB
      const theTrueEnd = Math.min(fileSize, theTrueStart + MAX_READ_BYTES) - 1; // inclusive

      const stream = createReadStream(logPath, {
        start: theTrueStart,
        // it's inclusive range for createReadStream
        end: theTrueEnd,
        encoding: 'utf-8',
      });

      const content = await new Promise<string>((resolve, reject) => {
        let content = '';
        stream.on('data', (chunk) => {
          content += chunk;
        });
        stream.on('end', () => {
          resolve(content);
        });
        stream.on('error', (err) => {
          reject(err);
        });
      });

      return {
        res: {
          code: 0,
          message: 'OK',
          data: {
            content,
            start: theTrueStart,
            end: theTrueEnd,
            file_size: fileSize,
          },
        },
      };
    },
  );

  if (getAbsolutePath('tail')) {
    // Realtime log streaming via `tail -f`
    terminal.channel.publishChannel(
      encodePath('Deployment', 'RealtimeLog', nodeKeyPair.public_key),
      {},
      (deployment_id) => {
        // Subscribe to the log stream for the given deployment_id
        const logPath = join(WORKSPACE_DIR, 'logs', `${deployment_id}.log`);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(deployment_id)) {
          throw new Error('Invalid deployment_id: invalid format');
        }
        if (!logPath.startsWith(join(WORKSPACE_DIR, 'logs'))) {
          throw new Error('Invalid deployment_id: path traversal attack detected');
        }

        return new Observable<string>((sub) => {
          // Use `tail -F` to follow the log file (-F to follow even if the file is rotated)
          const child = spawn('tail', ['-F', logPath], {
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          child.stdout?.on('data', (chunk) => {
            sub.next(chunk.toString('utf-8'));
          });
          child.stderr?.on('data', (chunk) => {
            sub.next(chunk.toString('utf-8'));
          });
          child.on('error', (err) => {
            sub.error(err);
          });
          child.on('exit', () => {
            sub.complete();
          });
          return () => {
            treeKill(child.pid!, 'SIGKILL');
          };
        });
      },
    );
  }

  const trustedPackageRegExp = new RegExp(process.env.TRUSTED_PACKAGE_REGEXP || '^@yuants/');

  defer(() =>
    requestSQL<IDeployment[]>(
      terminal,
      `select * from deployment where enabled = true and address = ${escapeSQL(nodeKeyPair.public_key)}`,
    ),
  )
    .pipe(
      map((deployments) =>
        deployments.filter((deployment) =>
          trustedPackageRegExp.test(`${deployment.package_name}@${deployment.package_version}`),
        ),
      ),

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
        (x) => runDeployment(nodeKeyPair, x),
        (a, b) => a.updated_at === b.updated_at,
      ),
    )
    .subscribe();
}).subscribe();
