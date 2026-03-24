import { IAccountInfo, createEmptyAccountInfo, publishAccountInfo } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { buildPaperMockAccountId, PaperExecutionAdapter } from '../execution/paper-execution-adapter';
import { RuntimeManager } from '../runtime/runtime-manager';
import { SignalTraderRuntimeConfig, SignalTraderServicePolicy } from '../types';

class ReplayValue<T> {
  private readonly listeners = new Set<(value: T) => void>();

  constructor(private value: T) {}

  next(value: T) {
    this.value = value;
    for (const listener of this.listeners) listener(value);
  }

  subscribe(observer: { next?: (value: T) => void } | ((value: T) => void)) {
    const next = typeof observer === 'function' ? observer : observer.next;
    if (!next) return { unsubscribe() {} };
    next(this.value);
    this.listeners.add(next);
    return {
      unsubscribe: () => {
        this.listeners.delete(next);
      },
    };
  }

  complete() {
    this.listeners.clear();
  }
}

type Registration = {
  runtime_ref: { current: SignalTraderRuntimeConfig };
  subject: ReplayValue<IAccountInfo>;
  dispose: () => void;
};

const emptyAccountInfo = (runtime: SignalTraderRuntimeConfig) => {
  const transfer = runtime.metadata?.signal_trader_transfer as Record<string, unknown> | undefined;
  const currency = typeof transfer?.currency === 'string' ? transfer.currency : 'MOCK';
  return createEmptyAccountInfo(buildPaperMockAccountId(runtime), currency, 1, 0);
};

export class PaperAccountPublisherRegistry {
  private readonly registrations = new Map<string, Registration>();

  constructor(
    private readonly terminal: Terminal,
    private readonly runtimeManager: RuntimeManager,
    private readonly paperAdapter: PaperExecutionAdapter,
    private readonly servicePolicy?: SignalTraderServicePolicy,
  ) {}

  private createPublisher(accountId: string, subject: ReplayValue<IAccountInfo>) {
    if (this.terminal.metrics && this.terminal.client && this.terminal.dispose$) {
      return publishAccountInfo(this.terminal, accountId, subject as any);
    }
    const channelDisposable = this.terminal.channel.publishChannel(
      'AccountInfo',
      { const: accountId },
      () => subject as any,
    );
    return {
      dispose: () => channelDisposable.dispose(),
    };
  }

  async sync() {
    if (this.servicePolicy?.allowAnonymousRead !== true) {
      this.dispose();
      return;
    }
    const runtimes = (await this.runtimeManager.listRuntimeConfig()).filter(
      (runtime) => runtime.enabled && runtime.execution_mode === 'paper',
    );
    const desired = new Map(runtimes.map((runtime) => [buildPaperMockAccountId(runtime), runtime]));

    for (const [accountId, registration] of this.registrations.entries()) {
      if (desired.has(accountId)) continue;
      registration.dispose();
      registration.subject.complete();
      this.registrations.delete(accountId);
    }

    for (const [accountId, runtime] of desired.entries()) {
      const existing = this.registrations.get(accountId);
      if (existing) {
        existing.runtime_ref.current = runtime;
        existing.subject.next(this.paperAdapter.getMockAccountInfo(runtime));
        continue;
      }

      const runtimeRef: { current: SignalTraderRuntimeConfig } = { current: runtime };
      const subject = new ReplayValue<IAccountInfo>(
        this.paperAdapter.getMockAccountInfo(runtime) ?? emptyAccountInfo(runtime),
      );
      const serviceDisposable = this.terminal.server.provideService(
        'QueryAccountInfo',
        {
          type: 'object',
          required: ['account_id'],
          properties: {
            account_id: { type: 'string', const: accountId },
            force_update: { type: 'boolean' },
          },
        },
        async () => ({
          res: { code: 0, message: 'OK', data: this.paperAdapter.getMockAccountInfo(runtimeRef.current) },
        }),
      );
      const publisherDisposable = this.createPublisher(accountId, subject);
      const unsubscribe = this.paperAdapter.subscribeMockAccountInfo(runtime, (accountInfo) =>
        subject.next(accountInfo),
      );

      this.registrations.set(accountId, {
        runtime_ref: runtimeRef,
        subject,
        dispose: () => {
          unsubscribe();
          serviceDisposable.dispose();
          publisherDisposable.dispose();
        },
      });
    }
  }

  dispose() {
    for (const registration of this.registrations.values()) {
      registration.dispose();
      registration.subject.complete();
    }
    this.registrations.clear();
  }
}
