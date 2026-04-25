import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const command = process.argv[2] || 'start';
const hostPort = Number(process.env.HOST_PORT || 8898);
const postgresPort = Number(process.env.POSTGRES_PORT || 54339);
const hostToken = process.env.HOST_TOKEN || 'signal-trader-dummy';
const runtimeId = process.env.SIGNAL_TRADER_RUNTIME_ID || 'runtime-live';
const productId = process.env.SIGNAL_TRADER_PRODUCT_ID || 'BINANCE/SWAP/BTC-USDT';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const composeFile = resolve(repoRoot, 'apps/signal-trader/dev/docker-compose.live-dummy.yml');
const hostUrl = `ws://127.0.0.1:${hostPort}?host_token=${encodeURIComponent(hostToken)}`;

const sharedEnv = {
  ...process.env,
  HOST_PORT: String(hostPort),
  POSTGRES_PORT: String(postgresPort),
  HOST_TOKEN: hostToken,
  DUMMY_LIVE_PRODUCT_ID: productId,
  SIGNAL_TRADER_PRODUCT_ID: productId,
};

const dockerCompose = (...args) => {
  const result = spawnSync('docker', ['compose', '-f', composeFile, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: sharedEnv,
  });
  if (result.status !== 0) process.exit(result.status || 1);
};

const waitFor = async (fn, label, attempts = 90) => {
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

const requestService = async (method, req) => {
  const response = await fetch(`http://127.0.0.1:${hostPort}/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host_token: hostToken,
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

const waitForSqlService = async () => {
  await waitFor(async () => {
    try {
      await requestService('SQL', { query: 'SELECT 1 AS ok;' });
      return true;
    } catch {
      return false;
    }
  }, 'dummy-sql-service');
};

const waitForPostgres = async () => {
  await waitFor(() => {
    const result = spawnSync(
      'docker',
      ['compose', '-f', composeFile, 'exec', '-T', 'postgres', 'pg_isready', '-U', 'yuants', '-d', 'yuan'],
      {
        cwd: repoRoot,
        stdio: 'ignore',
        env: sharedEnv,
      },
    );
    return Promise.resolve(result.status === 0);
  }, 'dummy-postgres');
};

const runMigrations = () => {
  const result = spawnSync('node', ['tools/sql-migration/lib/cli.js'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...sharedEnv,
      HOST_URL: hostUrl,
      TERMINAL_ID: 'signal-trader-dummy-sql-migration-ui',
      SQL_DIR: resolve(repoRoot, 'tools/sql-migration/sql'),
    },
  });
  if (result.status !== 0) {
    throw new Error('SQL_MIGRATION_FAILED');
  }
};

const seedRuntime = async () => {
  await requestService('SignalTrader/UpsertRuntimeConfig', {
    runtime_id: runtimeId,
    enabled: true,
    execution_mode: 'live',
    account_id: process.env.DUMMY_LIVE_ACCOUNT_ID || 'acct-dummy-live',
    subscription_id: runtimeId,
    investor_id: `investor-${runtimeId}`,
    signal_key: 'sig-live',
    product_id: productId,
    vc_budget: 100,
    daily_burn_amount: 10,
    subscription_status: 'active',
    observer_backend: 'vex_account_bound_sql_order_history',
    poll_interval_ms: 1000,
    reconciliation_interval_ms: 10000,
    event_batch_size: 100,
    metadata: {
      bootstrap: 'ui-signal-trader-web-dummy-wrapper',
      live_route: 'vex_account_bound',
    },
  });
  await requestService('SignalTrader/GetRuntimeHealth', { runtime_id: runtimeId });
};

const startStack = async () => {
  dockerCompose('up', '-d', 'postgres', 'host', 'postgres-storage', 'dummy-live-backend');
  await waitForPostgres();
  await waitFor(() => tcpReady(hostPort), 'dummy-host');
  await waitForSqlService();
  runMigrations();
  await waitFor(async () => {
    try {
      await requestService('VEX/ListCredentials', {});
      return true;
    } catch {
      return false;
    }
  }, 'dummy-backend');
  dockerCompose('up', '-d', 'signal-trader');
  await waitFor(async () => {
    try {
      await requestService('SignalTrader/ListRuntimeConfig', {});
      return true;
    } catch {
      return false;
    }
  }, 'dummy-signal-trader');
  await seedRuntime();
  console.log(`dummy-live stack ready at http://127.0.0.1:${hostPort}`);
};

const stopStack = () => {
  dockerCompose('down');
  console.log('local dummy live stack 已停止');
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
  dockerCompose('ps');
} else {
  console.error('usage: node scripts/run-dummy-live-stack.mjs [start|stop|restart|status]');
  process.exit(1);
}
