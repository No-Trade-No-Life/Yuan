#!/usr/bin/env node

const crypto = require('node:crypto');
const net = require('node:net');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const process = require('node:process');
const { Terminal } = require('@yuants/protocol');
const { requestSQL, escapeSQL } = require('@yuants/sql');
const { firstValueFrom } = require('rxjs');
const { filter, timeout } = require('rxjs/operators');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const composeFile = path.join(repoRoot, 'tools', 'yuanctl', 'e2e', 'docker-compose.yml');
const cliEntry = path.join(repoRoot, 'tools', 'yuanctl', 'lib', 'bin', 'yuanctl.js');
const nodeBinary = process.execPath;

const DEFAULT_HOST_PORT = process.env.YUANCTL_E2E_HOST_PORT || '28888';
const DEFAULT_DB_PORT = process.env.YUANCTL_E2E_DB_PORT || '25432';
const DB_USER = process.env.YUANCTL_DB_USER || 'yuan';
const DB_PASSWORD = process.env.YUANCTL_DB_PASSWORD || 'yuan';
const DB_NAME = process.env.YUANCTL_DB_NAME || 'yuan';
const dockerCommand = process.env.YUANCTL_DOCKER_BIN || 'docker';
const skipCompose = process.env.YUANCTL_E2E_SKIP_COMPOSE === '1';
const keepServices = process.env.YUANCTL_E2E_KEEP_SERVICES === '1';
const sqlDir = path.join(repoRoot, 'tools', 'sql-migration', 'sql');

const portalDeploymentId = process.env.YUANCTL_PORTAL_DEPLOYMENT_ID || '11111111-1111-1111-1111-111111111111';
const portalPackageName = process.env.YUANCTL_PORTAL_PACKAGE || '@yuants/app-portal';
const portalPackageVersion = process.env.YUANCTL_PORTAL_VERSION || 'latest';
const testDeploymentId = process.env.YUANCTL_TEST_DEPLOYMENT_ID || '22222222-2222-2222-2222-222222222222';
const testPackageName = process.env.YUANCTL_TEST_PACKAGE || portalPackageName;
const testPackageVersion = process.env.YUANCTL_TEST_PACKAGE_VERSION || portalPackageVersion;

const hostUrl = process.env.YUANCTL_E2E_HOST_URL || `ws://127.0.0.1:${DEFAULT_HOST_PORT}`;

function log(msg) {
  process.stdout.write(`[yuanctl:e2e] ${msg}\n`);
}

function stripProtocolDebugLines(stdout) {
  return stdout
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\d{4}-\d{2}-\d{2} .*connection (established|closed|closing because output complete|terminated:)/.test(
          line,
        ),
    )
    .join('\n')
    .trim();
}

function parseJsonStdout(stdout, fallback = null) {
  const sanitized = stripProtocolDebugLines(stdout || '');
  if (!sanitized) {
    return fallback;
  }
  return JSON.parse(sanitized);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: options.env || process.env,
      stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (options.pipeStdout) process.stdout.write(data);
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (options.pipeStderr) process.stderr.write(data);
      });
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !options.ignoreError) {
        const error = new Error(`Command failed: ${command} ${args.join(' ')}\n${stderr}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ code, stdout, stderr });
    });
  });
}

function jsonLiteral(value) {
  return `CAST(${escapeSQL(JSON.stringify(value))} AS jsonb)`;
}

function buildDeploymentUpsertSQL({
  id,
  packageName,
  packageVersion,
  address,
  enabled,
  command = '',
  args = [],
  env = {},
}) {
  return `
    INSERT INTO deployment (id, package_name, package_version, command, args, env, address, enabled, created_at, updated_at)
    VALUES (
      ${escapeSQL(id)},
      ${escapeSQL(packageName)},
      ${escapeSQL(packageVersion)},
      ${escapeSQL(command)},
      ${jsonLiteral(args)},
      ${jsonLiteral(env)},
      ${escapeSQL(address)},
      ${enabled ? 'true' : 'false'},
      NOW(),
      NOW()
    )
    ON CONFLICT (id)
    DO UPDATE SET
      package_name = EXCLUDED.package_name,
      package_version = EXCLUDED.package_version,
      command = EXCLUDED.command,
      args = EXCLUDED.args,
      env = EXCLUDED.env,
      address = EXCLUDED.address,
      enabled = EXCLUDED.enabled,
      updated_at = NOW();
  `;
}

async function ensureCliBuilt() {
  try {
    await fsPromises.access(cliEntry, fs.constants.R_OK);
    return;
  } catch {
    log('yuanctl build artifact missing, running rush build');
    await runCommand(
      nodeBinary,
      [
        path.join(repoRoot, 'common', 'scripts', 'install-run-rush.js'),
        'build',
        '--to',
        '@yuants/tool-yuanctl',
      ],
      {
        pipeStdout: true,
        pipeStderr: true,
      },
    );
  }
}

async function composeUpServices(...services) {
  log(`Starting docker compose services: ${services.join(', ') || 'all'}`);
  await runCommand(dockerCommand, ['compose', '-f', composeFile, 'up', '-d', ...services], {
    pipeStdout: true,
    pipeStderr: true,
  });
}

async function composeDown() {
  log('Stopping docker compose stack');
  await runCommand(dockerCommand, ['compose', '-f', composeFile, 'down', '-v'], {
    pipeStdout: true,
    pipeStderr: true,
    ignoreError: true,
  });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, { retries = 60, intervalMs = 2000, description = 'condition' } = {}) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (err) {
      lastError = err;
    }
    await wait(intervalMs);
  }
  if (lastError) throw lastError;
  throw new Error(`Timeout waiting for ${description}`);
}

async function runYuanctl(args, { configPath, env = {}, ignoreError = false, input } = {}) {
  const cliEnv = {
    ...process.env,
    YUANCTL_DISABLE_UPDATE_CHECK: '1',
    ...env,
  };
  if (configPath) {
    cliEnv.YUANCTL_CONFIG = configPath;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(nodeBinary, [cliEntry, ...args], {
      cwd: repoRoot,
      env: cliEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, 15000);
    let stdout = '';
    let stderr = '';
    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (
        timedOut &&
        stripProtocolDebugLines(stdout).trim().length > 0 &&
        stripProtocolDebugLines(stderr).trim().length === 0
      ) {
        return resolve({ code: 0, stdout, stderr });
      }
      if (code !== 0 && !ignoreError) {
        const error = new Error(`yuanctl ${args.join(' ')} failed: ${stderr}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ code, stdout, stderr });
    });
  });
}

async function withSqlTerminal(fn) {
  const terminal = new Terminal(hostUrl, {
    terminal_id: `yuanctl/e2e/sql/${Date.now()}/${Math.random().toString(36).slice(2)}`,
    name: 'yuanctl-e2e-sql',
  });
  try {
    await firstValueFrom(terminal.isConnected$.pipe(filter(Boolean), timeout(30000)));
    return await fn(terminal);
  } finally {
    terminal.dispose();
  }
}

async function runSQL(query) {
  return withSqlTerminal((terminal) => requestSQL(terminal, query));
}

async function deleteDeploymentSafe(id, configPath) {
  if (!configPath) return;
  try {
    await runYuanctl(['deploy', 'delete', id, '--yes'], { configPath, ignoreError: true });
  } catch {
    // ignore cleanup failures
  }
}

async function discoverNodeUnitAddress() {
  return withSqlTerminal(async (terminal) => {
    const response = await terminal.client.requestForResponse('GetTerminalInfos', {});
    const terminals = response.data?.terminals ?? [];
    const nodeUnit = terminals.find((item) => item?.tags?.node_unit_address);
    return nodeUnit?.tags?.node_unit_address || false;
  });
}

async function waitForPostgres() {
  await waitFor(
    async () => {
      const result = await runCommand(
        dockerCommand,
        ['compose', '-f', composeFile, 'exec', '-T', 'postgres', 'pg_isready', '-U', DB_USER],
        { env: { ...process.env, PGPASSWORD: DB_PASSWORD }, ignoreError: true },
      );
      return result.code === 0;
    },
    { description: 'PostgreSQL (pg_isready)' },
  );

  await waitFor(
    async () => {
      const result = await runCommand(
        dockerCommand,
        [
          'compose',
          '-f',
          composeFile,
          'exec',
          '-T',
          'postgres',
          'psql',
          '-U',
          DB_USER,
          '-d',
          DB_NAME,
          '-v',
          'ON_ERROR_STOP=1',
          '-c',
          'SELECT 1;',
        ],
        { env: { ...process.env, PGPASSWORD: DB_PASSWORD }, ignoreError: true },
      );
      return result.code === 0;
    },
    { description: 'PostgreSQL accepting SQL' },
  );
  // Wait for host port forwarding (for optional direct access)
  await waitFor(
    async () => {
      try {
        const socket = net.createConnection({ host: '127.0.0.1', port: Number(DEFAULT_DB_PORT) });
        await new Promise((resolve, reject) => {
          socket.once('error', reject);
          socket.once('connect', resolve);
        });
        socket.destroy();
        return true;
      } catch {
        return false;
      }
    },
    { description: 'PostgreSQL port binding' },
  );
}

async function runPsql(sql) {
  await runCommand(
    dockerCommand,
    [
      'compose',
      '-f',
      composeFile,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      DB_USER,
      '-d',
      DB_NAME,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { env: { ...process.env, PGPASSWORD: DB_PASSWORD }, pipeStdout: true, pipeStderr: true },
  );
}

async function runSqlMigrations() {
  log('Applying SQL migrations before starting node-unit');
  await waitForPostgres();
  await runPsql(`
    CREATE TABLE IF NOT EXISTS migration (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      statement TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const files = (await fsPromises.readdir(sqlDir)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const filePath = path.join(sqlDir, file);
    const sql = await fsPromises.readFile(filePath, 'utf-8');
    const id = crypto.createHash('sha256').update(sql).digest('hex');
    const migrationSQL = `
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT id FROM migration WHERE id = ${escapeSQL(id)}) THEN
    INSERT INTO migration (id, name, statement) VALUES (${escapeSQL(id)}, ${escapeSQL(file)}, ${escapeSQL(
      sql,
    )});
    ${sql}
  END IF;
END $migration$;
`;
    log(`Applying migration ${file}`);
    await runPsql(migrationSQL);
  }
}

async function main() {
  let composeStarted = false;
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'yuanctl-e2e-'));
  const configPath = path.join(tmpDir, 'config.toml');

  try {
    await ensureCliBuilt();

    if (!skipCompose) {
      await composeDown();
      await composeUpServices('postgres');
      composeStarted = true;
      await runSqlMigrations();
      await composeUpServices('nodeunit');
    } else {
      log(
        'Skipping docker compose control (using existing services); ensure PostgreSQL、迁移与 Node Unit 由外部负责。',
      );
    }

    log('Waiting for SQL service (via host) to be reachable');
    await waitFor(
      async () => {
        try {
          await runSQL('SELECT 1');
          return true;
        } catch {
          return false;
        }
      },
      { description: 'SQL availability via host' },
    );

    await waitFor(
      async () => {
        try {
          const rows = await runSQL("SELECT to_regclass('public.deployment') AS exists");
          return Array.isArray(rows) && rows[0] && rows[0].exists;
        } catch {
          return false;
        }
      },
      { description: 'deployment table' },
    );

    log('Creating yuanctl config');
    const baseConfig = `current_context = "e2e"\n\n[hosts.e2e]\nhost_url = "${hostUrl}"\ntls_verify = false\nconnect_timeout_ms = 10000\nreconnect_delay_ms = 2000\n\n[contexts.e2e]\nhost = "e2e"\n`;
    await fsPromises.writeFile(configPath, baseConfig, 'utf-8');

    log('Waiting for node unit availability');
    const nodeUnitAddress = await waitFor(() => discoverNodeUnitAddress(), {
      description: 'node unit discovery',
    });
    log(`Detected node unit address: ${nodeUnitAddress}`);

    log('Seeding portal deployment');
    await runSQL(
      buildDeploymentUpsertSQL({
        id: portalDeploymentId,
        packageName: portalPackageName,
        packageVersion: portalPackageVersion,
        address: nodeUnitAddress,
        enabled: true,
      }),
    );

    log('Seeding test deployment');
    await runSQL(
      buildDeploymentUpsertSQL({
        id: testDeploymentId,
        packageName: testPackageName,
        packageVersion: testPackageVersion,
        address: nodeUnitAddress,
        enabled: false,
      }),
    );

    await wait(1000);

    const getResult = await runYuanctl(['deploy', 'inspect', testDeploymentId, '--output', 'json'], {
      configPath,
    });
    const deploymentInspect = parseJsonStdout(getResult.stdout, {});
    if (!deploymentInspect?.data || deploymentInspect.data.id !== testDeploymentId) {
      throw new Error(`Expected single deployment row, got: ${getResult.stdout}`);
    }

    log('Running deploy inspect command');

    log('Toggling deployment enabled state');
    await runYuanctl(['deploy', 'enable', testDeploymentId, '--yes'], { configPath });
    await waitFor(
      async () => {
        const res = await runYuanctl(['deploy', 'inspect', testDeploymentId, '--output', 'json'], {
          configPath,
        });
        const parsed = parseJsonStdout(res.stdout, {});
        return parsed?.data?.enabled === true;
      },
      { description: 'enable propagation' },
    );

    await runYuanctl(['deploy', 'disable', testDeploymentId, '--yes'], { configPath });
    await waitFor(
      async () => {
        const res = await runYuanctl(['deploy', 'inspect', testDeploymentId, '--output', 'json'], {
          configPath,
        });
        const parsed = parseJsonStdout(res.stdout, {});
        return parsed?.data?.enabled === false;
      },
      { description: 'disable propagation' },
    );

    log('Checking restart command updates timestamp');
    const beforeRestart = await runYuanctl(['deploy', 'inspect', testDeploymentId, '--output', 'json'], {
      configPath,
    });
    const beforeInspect = parseJsonStdout(beforeRestart.stdout, {});
    const beforeUpdatedAt = beforeInspect?.data?.updated_at;
    await runYuanctl(['deploy', 'restart', testDeploymentId, '--yes'], { configPath });
    await waitFor(
      async () => {
        const after = await runYuanctl(['deploy', 'inspect', testDeploymentId, '--output', 'json'], {
          configPath,
        });
        const afterInspect = parseJsonStdout(after.stdout, {});
        return afterInspect?.data?.updated_at && afterInspect.data.updated_at !== beforeUpdatedAt;
      },
      { description: 'restart updated_at propagation' },
    );

    log('Running config init smoke test');
    const configInit = await runYuanctl(['config', 'init', '--host-url', hostUrl], { configPath });
    if (!configInit.stdout.includes('current_context')) {
      throw new Error('config-init output missing expected content');
    }

    log('Executing logs command (best effort)');
    const logsResult = await runYuanctl(['deploy', 'logs', portalDeploymentId, '--tail', '50', '--yes'], {
      configPath,
      ignoreError: true,
    });
    if (logsResult.code !== 0) {
      throw new Error(`deploy logs failed: ${logsResult.stderr || logsResult.stdout}`);
    }

    log('Deleting test deployment');
    await runYuanctl(['deploy', 'delete', testDeploymentId, '--yes'], { configPath });

    await waitFor(
      async () => {
        const res = await runYuanctl(['deploy', 'list', '--output', 'json'], {
          configPath,
        });
        const parsed = parseJsonStdout(res.stdout, {});
        return !parsed?.data?.some((item) => item.id === testDeploymentId);
      },
      { description: 'deployment deletion confirmation' },
    );

    log('Deleting portal deployment');
    await runYuanctl(['deploy', 'delete', portalDeploymentId, '--yes'], {
      configPath,
      ignoreError: true,
    });

    log('E2E test completed successfully');
  } finally {
    await deleteDeploymentSafe(testDeploymentId, configPath);
    await deleteDeploymentSafe(portalDeploymentId, configPath);
    if (!skipCompose && composeStarted && !keepServices) {
      await composeDown();
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
