import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const command = process.argv[2] || 'start';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const stateRoot = resolve('/tmp', 'yuants-signal-trader-web-mock-stack');
const logsDir = resolve(stateRoot, 'logs');
const pidsDir = resolve(stateRoot, 'pids');
const composeFile = resolve(repoRoot, 'apps/signal-trader/dev/docker-compose.yml');
const hostPort = Number(process.env.HOST_PORT || 8888);
const postgresPort = Number(process.env.POSTGRES_PORT || 54329);
const postgresUri = process.env.POSTGRES_URI || `postgres://yuants:yuants@127.0.0.1:${postgresPort}/yuan`;
const hostUrl = `ws://127.0.0.1:${hostPort}`;
const hostPidFile = resolve(pidsDir, 'app-host.pid');
const storagePidFile = resolve(pidsDir, 'app-postgres-storage.pid');
const traderPidFile = resolve(pidsDir, 'app-signal-trader.pid');

mkdirSync(logsDir, { recursive: true });
mkdirSync(pidsDir, { recursive: true });

const pidIsRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const stopPidFile = (file) => {
  if (!existsSync(file)) return;
  const pid = Number(readFileSync(file, 'utf8').trim());
  if (Number.isFinite(pid) && pidIsRunning(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {}
  }
  rmSync(file, { force: true });
};

const spawnLogged = (name, file, commandName, args, extraEnv = {}) => {
  const out = resolve(logsDir, `${name}.log`);
  const fd = openSync(out, 'a');
  const child = spawn(commandName, args, {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', fd, fd],
    env: { ...process.env, ...extraEnv },
  });
  child.unref();
  writeFileSync(file, `${child.pid}\n`);
  return child.pid;
};

const dockerCompose = (...args) => {
  const result = spawnSync('docker', ['compose', '-f', composeFile, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
};

const waitFor = async (fn, label, attempts = 60) => {
  for (let i = 0; i < attempts; i += 1) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`WAIT_TIMEOUT:${label}`);
};

const tcpReady = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });

const httpRequest = async (method, req) => {
  const response = await fetch(`http://127.0.0.1:${hostPort}/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ method, req }),
  });
  if (!response.ok) {
    throw new Error(`${method}: HTTP_${response.status}`);
  }
  const raw = await response.text();
  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    throw new Error(`${method}: EMPTY_RESPONSE`);
  }
  const payload = JSON.parse(lines[lines.length - 1]);
  if (payload?.res?.code !== 0) {
    throw new Error(`${method}: ${payload?.res?.message || 'UNKNOWN_ERROR'}`);
  }
  return payload.res.data;
};

const startStack = async () => {
  if (existsSync(traderPidFile)) {
    const current = Number(readFileSync(traderPidFile, 'utf8').trim());
    if (Number.isFinite(current) && pidIsRunning(current)) {
      throw new Error('PAPER_STACK_ALREADY_RUNNING');
    }
  }
  dockerCompose('up', '-d', 'postgres');
  await waitFor(() => {
    const result = spawnSync(
      'docker',
      ['compose', '-f', composeFile, 'exec', '-T', 'postgres', 'pg_isready', '-U', 'yuants', '-d', 'yuan'],
      {
        cwd: repoRoot,
        stdio: 'ignore',
      },
    );
    return Promise.resolve(result.status === 0);
  }, 'postgres');

  spawnLogged('app-host', hostPidFile, 'node', ['apps/host/lib/cli.js'], { PORT: String(hostPort) });
  await waitFor(() => tcpReady(hostPort), 'host');

  spawnLogged('app-postgres-storage', storagePidFile, 'node', ['apps/postgres-storage/lib/cli.js'], {
    HOST_URL: hostUrl,
    TERMINAL_ID: 'signal-trader-mock-postgres-storage-ui',
    POSTGRES_URI: postgresUri,
  });
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const migration = spawnSync('node', ['tools/sql-migration/lib/cli.js'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      HOST_URL: hostUrl,
      TERMINAL_ID: 'signal-trader-mock-sql-migration-ui',
      SQL_DIR: resolve(repoRoot, 'tools/sql-migration/sql'),
    },
  });
  if (migration.status !== 0) throw new Error('SQL_MIGRATION_FAILED');

  spawnLogged(
    'app-signal-trader',
    traderPidFile,
    'node',
    ['ui/signal-trader-web/scripts/bootstrap-mock-app.mjs'],
    {
      HOST_URL: hostUrl,
      TERMINAL_ID: 'signal-trader-mock-bootstrap-ui',
    },
  );

  await waitFor(async () => {
    try {
      await httpRequest('SignalTrader/ListRuntimeConfig', {});
      return true;
    } catch {
      return false;
    }
  }, 'signal-trader-service');

  await httpRequest('SignalTrader/UpsertRuntimeConfig', {
    runtime_id: process.env.SIGNAL_TRADER_RUNTIME_ID || 'runtime-mock',
    enabled: true,
    execution_mode: 'paper',
    account_id: 'acct-mock',
    subscription_id: process.env.SIGNAL_TRADER_RUNTIME_ID || 'runtime-mock',
    investor_id: 'investor-mock',
    signal_key: 'sig-mock',
    product_id: process.env.SIGNAL_TRADER_PRODUCT_ID || 'BTC-USDT',
    vc_budget: 100,
    daily_burn_amount: 10,
    subscription_status: 'active',
    observer_backend: 'paper_simulated',
    poll_interval_ms: 1000,
    reconciliation_interval_ms: 5000,
    event_batch_size: 100,
    metadata: {
      bootstrap: 'ui-signal-trader-web-mock-wrapper',
      signal_trader_transfer: {
        funding_account_id: 'acct-funding-mock',
        currency: 'USDT',
        min_transfer_amount: 1,
        trading_buffer_amount: 0,
      },
    },
  });

  console.log(`mock stack ready at http://127.0.0.1:${hostPort}`);
};

const stopStack = () => {
  stopPidFile(traderPidFile);
  stopPidFile(storagePidFile);
  stopPidFile(hostPidFile);
  dockerCompose('down');
};

const statusStack = () => {
  for (const [label, file] of [
    ['app-host', hostPidFile],
    ['app-postgres-storage', storagePidFile],
    ['app-signal-trader', traderPidFile],
  ]) {
    const pid = existsSync(file) ? Number(readFileSync(file, 'utf8').trim()) : NaN;
    console.log(
      `${label} ${Number.isFinite(pid) && pidIsRunning(pid) ? 'running' : 'stopped'} ${
        Number.isFinite(pid) ? pid : '-'
      }`,
    );
  }
  dockerCompose('ps');
};

if (command === 'start') {
  try {
    await startStack();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    stopStack();
    process.exit(1);
  }
} else if (command === 'stop') {
  stopStack();
} else if (command === 'restart') {
  stopStack();
  await startStack();
} else if (command === 'status') {
  statusStack();
} else {
  console.error('usage: node scripts/run-mock-stack.mjs [start|stop|restart|status]');
  process.exit(1);
}
