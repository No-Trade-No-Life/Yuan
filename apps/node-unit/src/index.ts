import '@yuants/deploy';
import { IDeployment, IDeploymentAssignment } from '@yuants/deploy';
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
import { cpus, hostname } from 'os';
import { join } from 'path';
import pidusage from 'pidusage';
import {
  catchError,
  concat,
  concatMap,
  ReplaySubject,
  defer,
  EMPTY,
  endWith,
  firstValueFrom,
  fromEvent,
  ignoreElements,
  interval,
  timer,
  map,
  merge,
  mergeMap,
  Observable,
  repeat,
  retry,
  share,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import treeKill from 'tree-kill';
import { getAbsolutePath, NODE_PATH, WORKSPACE_DIR } from './const';
import { DEFAULT_LOG_ROTATE_OPTIONS, RotatingLogStream } from './logging';
import { installWorkspaceTo } from './prepare-workspace';
import {
  isAssignmentActiveAt,
  isAssignmentModeEnabled,
  normalizeHeartbeatIntervalSeconds,
  normalizeLeaseTtlSeconds,
  shouldUseAssignmentSource,
  startDeploymentScheduler,
} from './scheduler';
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
let currentResourceUsage = { cpuPercent: 0, memoryMb: 0 };

const MetricDeploymentInfo = GlobalPrometheusRegistry.gauge(
  'node_unit_deployment_info',
  'Deployment info for joining with nodejs_process_resource_usage',
);
const MetricAssignmentRunning = GlobalPrometheusRegistry.gauge(
  'node_unit_assignment_running',
  'Assignment running state reported by node-unit',
);
// NOTE: Socket-level network metrics are temporarily disabled

interface IRuntimeDeploymentTarget extends IDeployment {
  runtime_id: string;
  runtime_version: string;
  assignment_id?: string;
  assignment_generation?: number;
}

const mapDeploymentIdToProcess = new Map<
  string,
  {
    pid: number;
    package_name: string;
    package_version: string;
    terminal_id: string;
    assignment_id: string;
  }
>();
// NOTE: Socket-level network metrics are temporarily disabled

const makeDeploymentInfoMetricLabels = (
  deploymentId: string,
  terminalId: string,
  meta: { package_name: string; package_version: string; assignment_id?: string },
) => ({
  deployment_id: deploymentId,
  terminal_id: terminalId,
  package_name: meta.package_name,
  package_version: meta.package_version,
  node_unit_name: NODE_UNIT_NAME,
  node_unit_address: nodeUnitAddress,
  assignment_id: meta.assignment_id ?? '',
});

const normalizeDeploymentType = (deployment: IDeployment): 'daemon' | 'deployment' | undefined => {
  const rawType = (deployment as { type?: string }).type;
  if (rawType === 'daemon' || rawType === 'deployment') return rawType;
  console.error(formatTime(Date.now()), 'DeploymentTypeInvalid', {
    error_code: 'ERR_INVALID_TYPE',
    deployment_id: deployment.id,
    type: rawType ?? null,
  });
  return undefined;
};

const registerDeploymentProcess = (
  deployment: IRuntimeDeploymentTarget,
  pid: number | undefined,
  terminalId: string,
) => {
  if (!pid) return;
  const prev = mapDeploymentIdToProcess.get(deployment.id);
  if (prev) {
    const oldLabels = makeDeploymentInfoMetricLabels(deployment.id, prev.terminal_id, prev);
    MetricDeploymentInfo.labels(oldLabels).delete();
    MetricAssignmentRunning.labels({
      deployment_id: deployment.id,
      node_id: nodeUnitAddress,
      assignment_id: prev.assignment_id,
    }).delete();
  }
  const meta = {
    pid,
    terminal_id: terminalId,
    package_name: deployment.package_name,
    package_version: deployment.package_version,
    assignment_id: deployment.assignment_id ?? '',
  };
  mapDeploymentIdToProcess.set(deployment.id, meta);
  const newLabels = makeDeploymentInfoMetricLabels(deployment.id, terminalId, meta);
  MetricDeploymentInfo.labels(newLabels).set(1);
  MetricAssignmentRunning.labels({
    deployment_id: deployment.id,
    node_id: nodeUnitAddress,
    assignment_id: meta.assignment_id,
  }).set(meta.assignment_id ? 1 : 0);
};

const unregisterDeploymentProcess = (deploymentId: string) => {
  const meta = mapDeploymentIdToProcess.get(deploymentId);
  if (!meta) return;
  const labels = makeDeploymentInfoMetricLabels(deploymentId, meta.terminal_id, meta);
  MetricDeploymentInfo.labels(labels).delete();
  MetricAssignmentRunning.labels({
    deployment_id: deploymentId,
    node_id: nodeUnitAddress,
    assignment_id: meta.assignment_id,
  }).delete();
  mapDeploymentIdToProcess.delete(deploymentId);
};

const startResourceCollector = (intervalMs: number) => {
  let lastUsage = process.cpuUsage();
  let lastAt = Date.now();
  const cores = Math.max(cpus().length, 1);

  timer(0, intervalMs)
    .pipe(
      takeUntil(kill$), // Use kill$ instead of terminal.dispose$ as it's global now
      concatMap(() =>
        defer(async () => {
          const now = Date.now();
          const usage = process.cpuUsage();
          const deltaMicros = usage.user + usage.system - lastUsage.user - lastUsage.system;
          const elapsedMs = Math.max(now - lastAt, 1);
          const cpuMs = Math.max(deltaMicros / 1000, 0);
          const mainCpuPercent = Math.max((cpuMs / (elapsedMs * cores)) * 100, 0);
          const mainMemoryMb = Math.max(process.memoryUsage().rss / 1024 / 1024, 0);

          let childCpuPercent = 0;
          let childMemoryMb = 0;
          for (const [, meta] of mapDeploymentIdToProcess) {
            const stats = await pidusage(meta.pid).catch(() => null);
            if (!stats) continue;
            childCpuPercent += Math.max(stats.cpu ?? 0, 0);
            childMemoryMb += Math.max(stats.memory ?? 0, 0) / 1024 / 1024;
          }

          const totalCpuPercent = mainCpuPercent + childCpuPercent / cores;
          const totalMemoryMb = mainMemoryMb + childMemoryMb;

          lastUsage = usage;
          lastAt = now;

          currentResourceUsage = {
            cpuPercent: totalCpuPercent,
            memoryMb: totalMemoryMb,
          };
          console.info(formatTime(Date.now()), 'ResourceCollectorUpdate', {
            mainCpuPercent,
            childCpuPercent,
            cores,
            totalCpuPercent,
            mainMemoryMb,
            childMemoryMb,
            totalMemoryMb,
          });
        }),
      ),
      catchError((err) => {
        console.error(formatTime(Date.now()), 'ResourceCollectorError', err);
        return EMPTY;
      }),
    )
    .subscribe();
};

const renewAssignmentLease = async (
  terminal: Terminal | null,
  deployment: IRuntimeDeploymentTarget,
): Promise<boolean> => {
  if (!terminal || !deployment.assignment_id) return true;
  const ttlSeconds = normalizeLeaseTtlSeconds(deployment);
  const assignmentGeneration = deployment.assignment_generation ?? 0;
  const result = await requestSQL<Array<{ assignment_id: string }>>(
    terminal,
    `update deployment_assignment set
      heartbeat_at = CURRENT_TIMESTAMP,
      lease_expire_at = CURRENT_TIMESTAMP + make_interval(secs => ${ttlSeconds})
      where assignment_id = ${escapeSQL(deployment.assignment_id)}
      and deployment_id = ${escapeSQL(deployment.id)}::uuid
      and node_id = ${escapeSQL(nodeUnitAddress)}
      and lease_holder = ${escapeSQL(nodeUnitAddress)}
      and generation = ${assignmentGeneration}
      and state in ('Assigned','Running')
      and lease_expire_at >= CURRENT_TIMESTAMP
      returning assignment_id`,
  );
  return result.length > 0;
};

const writeAssignmentExitReason = async (
  terminal: Terminal | null,
  deployment: IRuntimeDeploymentTarget,
  exitReason: string,
): Promise<void> => {
  if (!terminal || !deployment.assignment_id) return;
  const assignmentGeneration = deployment.assignment_generation ?? 0;
  await requestSQL(
    terminal,
    `update deployment_assignment set exit_reason = ${escapeSQL(
      exitReason,
    )} where assignment_id = ${escapeSQL(deployment.assignment_id)} and deployment_id = ${escapeSQL(
      deployment.id,
    )}::uuid and node_id = ${escapeSQL(nodeUnitAddress)} and generation = ${assignmentGeneration}`,
  );
};

const runDeployment = (
  terminal: Terminal | null,
  nodeUnitKeyPair: IEd25519KeyPair,
  deployment: IRuntimeDeploymentTarget,
) => {
  const terminalName = `${deployment.package_name}@${deployment.package_version}`;

  const deploymentDir = join(WORKSPACE_DIR, 'deployments', deployment.id);
  const logHome = join(WORKSPACE_DIR, 'logs');

  // 使用 node 运行这个包目录本身，会通过 main 字段去加载入口文件
  const entryFile = join(deploymentDir, 'node_modules', deployment.package_name);

  let exitReason = deployment.assignment_id ? 'stopped_by_node_unit' : 'legacy_stopped';
  const assignmentLifecycle$ = new ReplaySubject<void>(1);

  const deployment$ = defer(() =>
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

        const child$ = spawnChild({
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
          cwd: join(deploymentDir, 'node_modules', deployment.package_name),
          stdoutFilename: join(logHome, `${deployment.id}.log`),
          stderrFilename: join(logHome, `${deployment.id}.log`),
          streamFactory: (filename) => new RotatingLogStream(filename, LOG_ROTATE_OPTIONS),
          onSpawn: (child) => {
            registerDeploymentProcess(deployment, child.pid, childKeyPair.public_key);
            assignmentLifecycle$.next();
          },
        }).pipe(
          tap({
            subscribe: () => {
              exitReason = deployment.assignment_id ? 'stopped_by_node_unit' : 'legacy_stopped';
            },
            finalize: () => {
              assignmentLifecycle$.complete();
              console.info(
                formatTime(Date.now()),
                'DeploymentRemoveChildKey',
                deployment.id,
                childKeyPair.public_key,
              );
              childPublicKeys.delete(childKeyPair.public_key);
              unregisterDeploymentProcess(deployment.id);
            },
            error: (err) => {
              exitReason = `spawn_error:${String(err?.message ?? err)}`;
            },
          }),
          share({ resetOnRefCountZero: false }),
        );

        const heartbeat$ =
          terminal && deployment.assignment_id
            ? child$.pipe(
                take(1),
                switchMap(() =>
                  timer(0, normalizeHeartbeatIntervalSeconds(deployment) * 1000).pipe(
                    takeUntil(assignmentLifecycle$),
                    concatMap(() =>
                      defer(async () => {
                        const renewed = await renewAssignmentLease(terminal, deployment);
                        if (!renewed) {
                          exitReason = 'lease_lost';
                          throw new Error(`E_LEASE_CONFLICT:${deployment.assignment_id}`);
                        }
                      }),
                    ),
                  ),
                ),
              )
            : EMPTY;

        return merge(child$, heartbeat$);
      }),
    ),
  ).pipe(
    tap({
      subscribe: () => {
        console.info(formatTime(Date.now()), 'DeploymentStart', deployment.id, terminalName);
      },
      error: (err) => {
        exitReason = `runtime_error:${String(err?.message ?? err)}`;
        console.info(
          formatTime(Date.now()),
          'DeploymentFailed',
          deployment.id,
          terminalName,
          `Error: ${err.message || err}`,
        );
      },
      finalize: () => {
        writeAssignmentExitReason(terminal, deployment, exitReason).catch((error) => {
          console.error(formatTime(Date.now()), 'DeploymentExitReasonWriteFailed', {
            deployment_id: deployment.id,
            assignment_id: deployment.assignment_id ?? '',
            error: String(error),
          });
        });
        console.info(formatTime(Date.now()), `DeploymentComplete`, deployment.id, terminalName);
      },
    }),
    //
    retry({ delay: 1000 }),
    repeat({ delay: 1000 }),
  );

  return deployment$;
};

const loadAssignmentTargets = async (
  terminal: Terminal,
  nodeId: string,
): Promise<IRuntimeDeploymentTarget[]> => {
  const rows = await requestSQL<
    Array<
      IDeployment & {
        assignment_id: string;
        assignment_generation: number;
      }
    >
  >(
    terminal,
    `select d.*, da.assignment_id, da.generation as assignment_generation
      from deployment_assignment da
      join deployment d on d.id = da.deployment_id
      where d.enabled = true
      and da.node_id = ${escapeSQL(nodeId)}
      and da.state in ('Assigned','Running')
      and da.lease_expire_at >= CURRENT_TIMESTAMP`,
  );
  return rows.map((item) => ({
    ...item,
    runtime_id: item.assignment_id,
    runtime_version: `${item.updated_at}:${item.assignment_generation}:${item.assignment_id}`,
    assignment_id: item.assignment_id,
    assignment_generation: item.assignment_generation,
  }));
};

const loadLegacyTargets = async (terminal: Terminal, nodeId: string): Promise<IRuntimeDeploymentTarget[]> => {
  const assignments = await requestSQL<IDeploymentAssignment[]>(
    terminal,
    `select * from deployment_assignment where state in ('Assigned','Running') and lease_expire_at >= CURRENT_TIMESTAMP`,
  );
  const fencedDeploymentIds = new Set(
    assignments
      .filter((assignment) => isAssignmentActiveAt(assignment, Date.now()))
      .map((assignment) => assignment.deployment_id),
  );
  const deployments = await requestSQL<IDeployment[]>(
    terminal,
    `select * from deployment where enabled = true and ((type = 'deployment' and address = ${escapeSQL(
      nodeId,
    )}) or type = 'daemon')`,
  );
  return deployments
    .filter((deployment) => {
      if (fencedDeploymentIds.has(deployment.id)) return false;
      if (deployment.paused) return false;
      if ((deployment.desired_replicas ?? 1) > 1) return false;
      if (deployment.type === 'daemon' && (deployment.selector ?? '') !== '') return false;
      return true;
    })
    .map((deployment) => ({
      ...deployment,
      runtime_id: deployment.id,
      runtime_version: deployment.updated_at,
    }));
};

const loadRuntimeTargets = async (
  terminal: Terminal,
  nodeId: string,
): Promise<IRuntimeDeploymentTarget[]> => {
  if (isAssignmentModeEnabled()) {
    return loadAssignmentTargets(terminal, nodeId);
  }
  return loadLegacyTargets(terminal, nodeId);
};

const startNodeModeHeartbeat = (terminal: Terminal) => {
  const intervalSeconds = Number(process.env.NODE_UNIT_MODE_HEARTBEAT_INTERVAL_SECONDS ?? '5');
  const intervalMs = Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds * 1000 : 5000;
  timer(0, intervalMs)
    .pipe(
      takeUntil(kill$),
      tap(() => {
        terminal.terminalInfo.tags = terminal.terminalInfo.tags ?? {};
        terminal.terminalInfo.tags.applied_generation = String(getNodeAppliedGeneration());
        terminal.terminalInfo.tags.assignment_mode_enabled = isAssignmentModeEnabled() ? 'true' : 'false';
        terminal.terminalInfoUpdated$.next();
      }),
      catchError((err) => {
        console.error(formatTime(Date.now()), 'NodeModeHeartbeatError', err);
        return EMPTY;
      }),
    )
    .subscribe();
};

const getNodeAppliedGeneration = (): number => {
  const parsed = Number(
    process.env.NODE_UNIT_ASSIGNMENT_GENERATION ?? (isAssignmentModeEnabled() ? '1' : '0'),
  );
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
};

// Setup
defer(async () => {
  const nodeKeyPair = await getNodeKeyPairFromEnv();

  console.info(formatTime(Date.now()), 'Node Unit Address:', nodeKeyPair.public_key);
  nodeUnitAddress = nodeKeyPair.public_key;

  const localHostDeployment: IDeployment | null = !process.env.HOST_URL
    ? {
        id: 'local-host',
        package_name: '@yuants/app-host',
        package_version: process.env.HOST_PACKAGE_VERSION || 'latest',
        command: '',
        args: [],
        env: {},
        type: 'deployment',
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
        type: 'deployment',
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
      runDeployment(null, nodeKeyPair, localHostDeployment as IRuntimeDeploymentTarget).pipe(
        share({ resetOnRefCountZero: false }),
      ),
    );
  }

  if (localPgDeployment) {
    await firstValueFrom(
      runDeployment(null, nodeKeyPair, localPgDeployment as IRuntimeDeploymentTarget).pipe(
        share({ resetOnRefCountZero: false }),
      ),
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

  childPublicKeys.add(terminal.keyPair.public_key);

  setupSecretProxyService(terminal, (publicKey: string) => childPublicKeys.has(publicKey));
  const schedulerIntervalFromEnv = Number(process.env.NODE_UNIT_SCHEDULER_INTERVAL_MS);
  const resourceIntervalMs =
    Number.isFinite(schedulerIntervalFromEnv) && schedulerIntervalFromEnv > 0
      ? schedulerIntervalFromEnv
      : 5000;
  startResourceCollector(resourceIntervalMs);
  startNodeModeHeartbeat(terminal);
  startDeploymentScheduler(terminal, nodeKeyPair.public_key);

  terminal.server.provideService('NodeUnit/InspectResourceUsage', {}, async () => {
    console.info(formatTime(Date.now()), 'NodeUnit/InspectResourceUsage', currentResourceUsage);
    return {
      res: {
        code: 0,
        message: 'OK',
        data: {
          cpu_percent: currentResourceUsage.cpuPercent,
          memory_mb: currentResourceUsage.memoryMb,
        },
      },
    };
  });

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

  defer(() => loadRuntimeTargets(terminal, nodeKeyPair.public_key))
    .pipe(
      map((deployments) => {
        const validDeployments = deployments.filter((deployment) => {
          const type = normalizeDeploymentType(deployment);
          if (!type) return false;
          if (!deployment.assignment_id && type === 'daemon' && deployment.address) {
            console.error(formatTime(Date.now()), 'DeploymentDaemonAddressSet', {
              error_code: 'ERR_DAEMON_ADDRESS_SET',
              deployment_id: deployment.id,
              address: deployment.address,
            });
          }
          return true;
        });
        const trusted = validDeployments.filter((deployment) =>
          trustedPackageRegExp.test(`${deployment.package_name}@${deployment.package_version}`),
        );
        console.info(
          formatTime(Date.now()),
          'Deployments',
          `${trusted.length} trusted, ${validDeployments.length} total`,
        );
        console.table(
          validDeployments.map(({ id, package_name, package_version, updated_at, assignment_id }) => ({
            id,
            package_name,
            package_version,
            updated_at,
            assignment_id: assignment_id ?? '',
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
        (item) => item.runtime_id,
        (x) => runDeployment(terminal, nodeKeyPair, x),
        (a, b) => a.runtime_version === b.runtime_version,
      ),
    )
    .subscribe();
}).subscribe();
