export * from './app';
export * from './bootstrap-from-env';
export * from './execution/live-execution-adapter';
export * from './execution/paper-execution-adapter';
export * from './observer/observation-normalizer';
export * from './runtime/runtime-config';
export * from './runtime/live-capability';
export * from './runtime/runtime-health';
export * from './runtime/runtime-manager';
export * from './runtime/runtime-worker';
export * from './services/signal-trader-services';
export * from './storage/repositories';
export * from './types';

import { createSignalTraderAppFromEnv } from './bootstrap-from-env';

if (require.main === module) {
  const { app, terminal, config } = createSignalTraderAppFromEnv();
  app.start().catch((error) => {
    terminal.dispose();
    console.error('[signal-trader] startup_failed', error instanceof Error ? error.name : 'unknown');
    console.error('[signal-trader] startup_context', {
      observer_backend: config.observerBackend,
      host_internal_services_trusted: true,
    });
    process.exitCode = 1;
  });
}
