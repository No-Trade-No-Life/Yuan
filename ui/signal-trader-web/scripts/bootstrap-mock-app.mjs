import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const { Terminal } = require(resolve(repoRoot, 'libraries/protocol/lib/index.js'));
const {
  SQLCheckpointRepository,
  SQLEventStore,
  SQLOrderBindingRepository,
  SQLRuntimeAuditLogRepository,
  SQLRuntimeConfigRepository,
  createSignalTraderApp,
} = require(resolve(repoRoot, 'apps/signal-trader/lib/index.js'));

const terminal = Terminal.fromNodeEnv();

const app = createSignalTraderApp({
  terminal,
  repositories: {
    runtimeConfigRepository: new SQLRuntimeConfigRepository(terminal),
    eventStore: new SQLEventStore(terminal),
    orderBindingRepository: new SQLOrderBindingRepository(terminal),
    checkpointRepository: new SQLCheckpointRepository(terminal),
    auditLogRepository: new SQLRuntimeAuditLogRepository(terminal),
  },
  servicePolicy: {
    allowAnonymousRead: true,
    enableMutatingServices: true,
    enableOperatorServices: false,
    enablePaperClockServices: true,
    authorize: async () => true,
  },
});

const shutdown = async (signal) => {
  console.info(`[ui-signal-trader-web mock bootstrap] received ${signal}, exiting`);
  await terminal.dispose();
  process.exit(0);
};

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

app
  .start()
  .then(() => {
    console.info('[ui-signal-trader-web mock bootstrap] started');
  })
  .catch((error) => {
    console.error('[ui-signal-trader-web mock bootstrap] startup_failed', error);
    process.exit(1);
  });
