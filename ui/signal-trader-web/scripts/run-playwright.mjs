import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const profile = process.argv[2] || 'mock';
const normalizedProfile = profile === 'mock' ? 'paper' : profile;
const envByProfile = {
  mock: {
    SIGNAL_TRADER_ENV_PROFILE: 'paper',
    SIGNAL_TRADER_ENABLE_MUTATION: '1',
    SIGNAL_TRADER_HOST_ORIGIN: 'http://127.0.0.1:8888',
    SIGNAL_TRADER_HOST_LABEL: 'local-mock-host',
  },
  'dummy-live': {
    SIGNAL_TRADER_ENV_PROFILE: 'dummy-live',
    SIGNAL_TRADER_ENABLE_MUTATION: '1',
    SIGNAL_TRADER_HOST_ORIGIN: 'http://127.0.0.1:8899',
    SIGNAL_TRADER_HOST_LABEL: 'local-dummy-signal-trader',
  },
};

const env = {
  ...process.env,
  ...(envByProfile[profile] || envByProfile.mock),
  PLAYWRIGHT_PROFILE: profile,
};

const requiredArtifacts = [
  resolve(process.cwd(), '../../apps/host/lib/cli.js'),
  resolve(process.cwd(), '../../apps/postgres-storage/lib/cli.js'),
  resolve(process.cwd(), '../../tools/sql-migration/lib/cli.js'),
  resolve(process.cwd(), '../../apps/signal-trader/lib/index.js'),
];

const buildResult = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env,
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status || 1);
}

if (!requiredArtifacts.every((file) => existsSync(file))) {
  const fallbackBuild = spawnSync(
    'node',
    [
      '../../common/scripts/install-run-rush.js',
      'build',
      '-t',
      '@yuants/app-host',
      '-t',
      '@yuants/app-postgres-storage',
      '-t',
      '@yuants/tool-sql-migration',
      '-t',
      '@yuants/app-signal-trader',
    ],
    {
      stdio: 'inherit',
      env,
    },
  );
  if (fallbackBuild.status !== 0 && !requiredArtifacts.every((file) => existsSync(file))) {
    process.exit(fallbackBuild.status || 1);
  }
}

const result = spawnSync('npx', ['playwright', 'test', '--grep', `@${profile}`], {
  stdio: 'inherit',
  env: {
    ...env,
    PLAYWRIGHT_PROFILE_INTERNAL: normalizedProfile,
  },
});

process.exit(result.status || 0);
