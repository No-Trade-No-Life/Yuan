#!/usr/bin/env node

const { Terminal } = require('@yuants/protocol');
const {
  SQLCheckpointRepository,
  SQLEventStore,
  SQLOrderBindingRepository,
  SQLRuntimeAuditLogRepository,
  SQLRuntimeConfigRepository,
  createSignalTraderApp,
} = require('../lib');

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
    enableOperatorServices: true,
    enablePaperClockServices: true,
    authorize: async () => true,
  },
});

const shutdown = (signal) => {
  console.info(`[signal-trader-mock-bootstrap] received ${signal}, exiting`);
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

app
  .start()
  .then(() => {
    console.info('[signal-trader-mock-bootstrap] started with permissive local-only service policy');
  })
  .catch((error) => {
    console.error('[signal-trader-mock-bootstrap] startup_failed', error);
    process.exit(1);
  });
