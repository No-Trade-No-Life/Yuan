import '@yuants/deploy';
import { IDeployment } from '@yuants/deploy';
import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';
import { setupSecretProxyService } from '@yuants/secret';
import { escapeSQL, requestSQL } from '@yuants/sql';
import {
  createKeyPair,
  encodePath,
  formatTime,
  fromSeed,
  IEd25519KeyPair,
  listWatch,
  sha256,
  UUID,
} from '@yuants/utils';
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import { hostname } from 'os';
import { join } from 'path';
import pidusage from 'pidusage';
import {
  catchError,
  concat,
  defer,
  EMPTY,
  firstValueFrom,
  fromEvent,
  interval,
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
import { getAbsolutePath, NODE_PATH, WORKSPACE_DIR } from './const';
import { DEFAULT_LOG_ROTATE_OPTIONS, RotatingLogStream } from './logging';
import { installWorkspaceTo } from './prepare-workspace';
import { startDeploymentScheduler } from './scheduler';
import { spawnChild } from './spawnChild';

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

console.info('Workspace Dir:', WORKSPACE_DIR);

const kill$ = merge(fromEvent(process, 'SIGINT'), fromEvent(process, 'SIGTERM'));

kill$.subscribe(() => {
  process.exit();
});

const childPublicKeys = new Set<string>();
const LOG_ROTATE_OPTIONS = DEFAULT_LOG_ROTATE_OPTIONS;
const NODE_UNIT_NAME = process.env.NODE_UNIT_NAME || hostname();
let nodeUnitAddress = '';

const MetricDeploymentCpuSecondsTotal = GlobalPrometheusRegistry.counter(
  'node_unit_deployment_cpu_seconds_total',
  'Cumulative CPU seconds consumed by deployment process',
);
const MetricDeploymentCpuUsageRatio = GlobalPrometheusRegistry.gauge(
  'node_unit_deployment_cpu_usage_ratio',
  'Deployment CPU usage ratio compared to host total jiffies',
);
const MetricDeploymentMemoryRssBytes = GlobalPrometheusRegistry.gauge(
  'node_unit_deployment_memory_rss_bytes',
  'Deployment process RSS bytes from /proc/[pid]/status',
);
// NOTE: Socket-level network metrics are temporarily disabled

const mapDeploymentIdToProcess = new Map<
  string,
  { pid: number; package_name: string; package_version: string }
>();
let lastPidusageAt = Date.now();

// NOTE: Socket-level network metrics are temporarily disabled

const makeDeploymentMetricLabels = (
  deploymentId: string,
  meta: { pid: number; package_name: string; package_version: string },
) => ({
  deployment_id: deploymentId,
  package_name: meta.package_name,
  package_version: meta.package_version,
  node_unit_name: NODE_UNIT_NAME,
  node_unit_address: nodeUnitAddress,
  pid: String(meta.pid),
});

const resetDeploymentGauges = (
  deploymentId: string,
  meta: { pid: number; package_name: string; package_version: string },
) => {
  const labels = makeDeploymentMetricLabels(deploymentId, meta);
  MetricDeploymentCpuUsageRatio.labels(labels).set(0);
  MetricDeploymentMemoryRssBytes.labels(labels).set(0);
};

const registerDeploymentProcess = (deployment: IDeployment, pid: number | undefined) => {
  if (!pid) return;
  const prev = mapDeploymentIdToProcess.get(deployment.id);
  if (prev && prev.pid !== pid) {
    resetDeploymentGauges(deployment.id, prev);
  }
  const meta = {
    pid,
    package_name: deployment.package_name,
    package_version: deployment.package_version,
  };
  mapDeploymentIdToProcess.set(deployment.id, meta);
};

const unregisterDeploymentProcess = (deploymentId: string) => {
  const meta = mapDeploymentIdToProcess.get(deploymentId);
  if (!meta) return;
  resetDeploymentGauges(deploymentId, meta);
  mapDeploymentIdToProcess.delete(deploymentId);
};

const collectDeploymentMetrics = async () => {
  if (mapDeploymentIdToProcess.size === 0) return;
  const now = Date.now();
  const wallDeltaSec = Math.max((now - lastPidusageAt) / 1000, 0);
  lastPidusageAt = now;
  for (const [deploymentId, meta] of mapDeploymentIdToProcess) {
    const labels = makeDeploymentMetricLabels(deploymentId, meta);
    const stats = await pidusage(meta.pid).catch(() => null);
    if (!stats) {
      unregisterDeploymentProcess(deploymentId);
      continue;
    }
    const cpuSeconds = Math.max((stats.cpu / 100) * wallDeltaSec, 0);
    if (cpuSeconds > 0) {
      MetricDeploymentCpuSecondsTotal.labels(labels).inc(cpuSeconds);
    }
    MetricDeploymentCpuUsageRatio.labels(labels).set(Math.max(stats.cpu / 100, 0));
    MetricDeploymentMemoryRssBytes.labels(labels).set(Math.max(stats.memory ?? 0, 0));
  }
};

const startDeploymentMetricsCollector = () => {
  interval(5000)
    .pipe(
      takeUntil(kill$),
      mergeMap(() => defer(() => collectDeploymentMetrics())),
      catchError((err) => {
        console.error(formatTime(Date.now()), 'DeploymentMetricsError', err);
        return EMPTY;
      }),
    )
    .subscribe();
};

const runDeployment = (nodeUnitKeyPair: IEd25519KeyPair, deployment: IDeployment) => {
  const terminalName = `${deployment.package_name}@${deployment.package_version}`;

  const deploymentDir = join(WORKSPACE_DIR, 'deployments', deployment.id);
  const logHome = join(WORKSPACE_DIR, 'logs');

  // 使用 node 运行这个包目录本身，会通过 main 字段去加载入口文件
  const entryFile = join(deploymentDir, 'node_modules', deployment.package_name);

  return defer(() =>
    concat(
      defer(async () => {
        await mkdir(logHome, { recursive: true });
      }).pipe(mergeMap(() => EMPTY)), // suppress signal
      // Install workspace
      defer(() =>
        installWorkspaceTo(
          deployment.package_name,
          deployment.package_version,
          deploymentDir,
          deployment.package_version === 'latest',
        ),
      ).pipe(mergeMap(() => EMPTY)),
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
              TERMINAL_NAME: terminalName,
              TERMINAL_PRIVATE_KEY: childKeyPair.private_key,
              NODE_UNIT_PUBLIC_KEY: nodeUnitKeyPair.public_key,
            },
            deployment.env,
          ),
          // Current working directory is the installed package directory
          cwd: join(deploymentDir, 'node_modules', deployment.package_name),
          stdoutFilename: join(logHome, `${deployment.id}.log`),
          stderrFilename: join(logHome, `${deployment.id}.log`),
          streamFactory: (filename) => new RotatingLogStream(filename, LOG_ROTATE_OPTIONS),
          onSpawn: (child) => registerDeploymentProcess(deployment, child.pid),
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
              unregisterDeploymentProcess(deployment.id);
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
  nodeUnitAddress = nodeKeyPair.public_key;
  startDeploymentMetricsCollector();

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

  const terminal = new Terminal(
    process.env.HOST_URL!,
    {
      name: '@yuants/node-unit',
      tags: {
        node_unit: 'true',
        node_unit_address: nodeKeyPair.public_key,
        node_unit_name: process.env.NODE_UNIT_NAME || hostname(),
        node_unit_version: require('../package.json').version,
      },
    },
    {
      private_key: nodeKeyPair.private_key,
    },
  );

  setupSecretProxyService(terminal, childPublicKeys);
  startDeploymentScheduler(terminal, nodeKeyPair.public_key);

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
      map((deployments) => {
        const trusted = deployments.filter((deployment) =>
          trustedPackageRegExp.test(`${deployment.package_name}@${deployment.package_version}`),
        );
        console.info(
          formatTime(Date.now()),
          'Deployments',
          `${trusted.length} trusted, ${deployments.length} total`,
        );
        console.table(
          deployments.map(({ id, package_name, package_version, updated_at }) => ({
            id,
            package_name,
            package_version,
            updated_at,
            is_trusted: !!trusted.find((x) => x.id === id),
          })),
        );
        return trusted;
      }),

      repeat({ delay: 5000 }),
      retry({ delay: 1000 }),
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
