import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const command = process.argv[2] || 'start';
const stateRoot = resolve('/tmp', 'yuants-signal-trader-web-dummy-fixture');
const pidFile = resolve(stateRoot, 'dummy-fixture.pid');

mkdirSync(stateRoot, { recursive: true });

const pidIsRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const stop = () => {
  if (!existsSync(pidFile)) return;
  const pid = Number(readFileSync(pidFile, 'utf8').trim());
  if (Number.isFinite(pid) && pidIsRunning(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {}
  }
  rmSync(pidFile, { force: true });
};

if (command === 'start') {
  if (existsSync(pidFile)) {
    const current = Number(readFileSync(pidFile, 'utf8').trim());
    if (Number.isFinite(current) && pidIsRunning(current)) {
      console.log('dummy fixture already running');
      process.exit(0);
    }
    rmSync(pidFile, { force: true });
  }
  const child = spawn('node', ['scripts/dummy-signal-trader-server.mjs'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      DUMMY_SIGNAL_TRADER_PORT: process.env.DUMMY_SIGNAL_TRADER_PORT || '8899',
    },
  });
  child.unref();
  writeFileSync(pidFile, `${child.pid}\n`);
  console.log('dummy fixture started');
} else if (command === 'stop') {
  stop();
  console.log('dummy fixture stopped');
} else if (command === 'restart') {
  stop();
  const child = spawn('node', ['scripts/dummy-signal-trader-server.mjs'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      DUMMY_SIGNAL_TRADER_PORT: process.env.DUMMY_SIGNAL_TRADER_PORT || '8899',
    },
  });
  child.unref();
  writeFileSync(pidFile, `${child.pid}\n`);
  console.log('dummy fixture restarted');
} else {
  console.error('usage: node scripts/run-dummy-fixture-stack.mjs [start|stop|restart]');
  process.exit(1);
}
