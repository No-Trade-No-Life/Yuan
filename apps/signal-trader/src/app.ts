import { Terminal } from '@yuants/protocol';
import { PaperExecutionAdapter } from './execution/paper-execution-adapter';
import { LiveExecutionAdapter } from './execution/live-execution-adapter';
import { RuntimeManager } from './runtime/runtime-manager';
import {
  createSignalTraderServiceHandlers,
  registerSignalTraderServices,
} from './services/signal-trader-services';
import { PaperAccountPublisherRegistry } from './services/paper-account-publisher-registry';
import {
  ExecutionAdapter,
  SignalTraderLiveCapabilityRegistry,
  LiveExecutionVenue,
  RuntimeQuoteProvider,
  RuntimeObserverProvider,
  RuntimeRepositories,
  SignalTraderRuntimeConfig,
  SignalTraderServiceHandlers,
  SignalTraderServicePolicy,
  TypedCredential,
} from './types';

export interface CreateSignalTraderAppOptions<T = unknown> {
  terminal?: Terminal;
  repositories: RuntimeRepositories;
  resolveLiveCredential?: (runtime: SignalTraderRuntimeConfig) => Promise<TypedCredential<T>>;
  liveVenue?: LiveExecutionVenue<T>;
  observerProvider?: RuntimeObserverProvider;
  quoteProvider?: RuntimeQuoteProvider;
  liveCapabilityRegistry?: SignalTraderLiveCapabilityRegistry;
  servicePolicy?: SignalTraderServicePolicy;
}

const createExecutionAdapterFactory = <T>(
  options: CreateSignalTraderAppOptions<T>,
  paperAdapter: PaperExecutionAdapter,
) => {
  return (runtime: SignalTraderRuntimeConfig) => {
    if (runtime.execution_mode === 'paper') return paperAdapter;
    if (options.resolveLiveCredential && options.liveVenue) {
      return new LiveExecutionAdapter(
        options.repositories.orderBindingRepository,
        options.resolveLiveCredential,
        options.liveVenue,
      ) satisfies ExecutionAdapter;
    }
    return {
      execute: async () => ({
        commands: [],
        bindings: [],
        lock_reason: 'LIVE_EXECUTION_ADAPTER_NOT_CONFIGURED',
      }),
    } satisfies ExecutionAdapter;
  };
};

const wrapServices = (
  services: SignalTraderServiceHandlers,
  registry?: PaperAccountPublisherRegistry,
): SignalTraderServiceHandlers => ({
  ...services,
  upsertRuntimeConfig: async (req) => {
    try {
      return await services.upsertRuntimeConfig(req);
    } finally {
      await registry?.sync();
    }
  },
  disableRuntime: async (req) => {
    try {
      return await services.disableRuntime(req);
    } finally {
      await registry?.sync();
    }
  },
  replayRuntime: async (req) => {
    try {
      return await services.replayRuntime(req);
    } finally {
      await registry?.sync();
    }
  },
});

export const createSignalTraderApp = <T = unknown>(options: CreateSignalTraderAppOptions<T>) => {
  const paperExecutionAdapter = new PaperExecutionAdapter();
  const runtimeManager = new RuntimeManager(
    options.repositories,
    createExecutionAdapterFactory(options, paperExecutionAdapter),
    options.observerProvider,
    options.liveCapabilityRegistry,
    options.quoteProvider,
  );
  const registry = options.terminal
    ? new PaperAccountPublisherRegistry(
        options.terminal,
        runtimeManager,
        paperExecutionAdapter,
        options.servicePolicy,
      )
    : undefined;
  const services = wrapServices(createSignalTraderServiceHandlers(runtimeManager), registry);

  return {
    runtimeManager,
    services,
    async start() {
      await runtimeManager.start();
      await registry?.sync();
      if (options.terminal) {
        registerSignalTraderServices(options.terminal, services, options.servicePolicy);
      }
    },
    dispose() {
      registry?.dispose();
      runtimeManager.dispose();
    },
  };
};
