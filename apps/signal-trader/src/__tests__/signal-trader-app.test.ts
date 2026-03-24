import { createSignalTraderApp } from '../app';
import { LiveExecutionAdapter } from '../execution/live-execution-adapter';
import { PaperExecutionAdapter } from '../execution/paper-execution-adapter';
import { normalizeObservation } from '../observer/observation-normalizer';
import { createStaticLiveCapabilityRegistry } from '../runtime/live-capability';
import { normalizeRuntimeConfig } from '../runtime/runtime-config';
import { createDefaultExecutionAdapterFactory, RuntimeManager } from '../runtime/runtime-manager';
import { registerSignalTraderServices } from '../services/signal-trader-services';
import {
  InMemoryCheckpointRepository,
  InMemoryEventStore,
  InMemoryOrderBindingRepository,
  InMemoryRuntimeAuditLogRepository,
  InMemoryRuntimeConfigRepository,
} from '../storage/repositories';
import {
  LiveExecutionVenue,
  SignalTraderLiveCapabilityDescriptor,
  SignalTraderLiveCapabilityRegistry,
  RuntimeObserverProvider,
  RuntimeRepositories,
  SignalTraderRuntimeConfig,
  SignalTraderServiceHandlers,
  TypedCredential,
} from '../types';

const LIVE_PRODUCT_ID = 'BINANCE/SWAP/BTC-USDT';
const LIVE_OBSERVER_BACKEND = 'binance_swap_history_bridge';
const DAY_MS = 86_400_000;

const basePaperRuntime = (): SignalTraderRuntimeConfig => ({
  runtime_id: 'runtime-paper',
  enabled: true,
  execution_mode: 'paper',
  account_id: 'acct-paper',
  subscription_id: 'runtime-paper',
  investor_id: 'investor-paper',
  signal_key: 'sig-paper',
  product_id: 'BTC-USDT',
  vc_budget: 100,
  daily_burn_amount: 100,
  subscription_status: 'active',
  observer_backend: 'paper_simulated',
  poll_interval_ms: 1000,
  reconciliation_interval_ms: 5000,
  event_batch_size: 100,
});

const baseLiveRuntime = (): SignalTraderRuntimeConfig => ({
  runtime_id: 'runtime-live',
  enabled: true,
  execution_mode: 'live',
  account_id: 'acct-live',
  subscription_id: 'runtime-live',
  investor_id: 'investor-live',
  signal_key: 'sig-live',
  product_id: LIVE_PRODUCT_ID,
  vc_budget: 100,
  daily_burn_amount: 100,
  subscription_status: 'active',
  observer_backend: LIVE_OBSERVER_BACKEND,
  poll_interval_ms: 20,
  reconciliation_interval_ms: 5000,
  event_batch_size: 100,
});

const withTransferMetadata = (runtime: SignalTraderRuntimeConfig): SignalTraderRuntimeConfig => ({
  ...runtime,
  metadata: {
    ...(runtime.metadata ?? {}),
    signal_trader_transfer: {
      funding_account_id: 'acct-funding',
      currency: 'USDT',
      min_transfer_amount: 1,
      trading_buffer_amount: 2,
    },
  },
});

const createRepositories = (): RuntimeRepositories => ({
  runtimeConfigRepository: new InMemoryRuntimeConfigRepository(),
  eventStore: new InMemoryEventStore(),
  orderBindingRepository: new InMemoryOrderBindingRepository(),
  checkpointRepository: new InMemoryCheckpointRepository(),
  auditLogRepository: new InMemoryRuntimeAuditLogRepository(),
});

const idleObserverProvider: RuntimeObserverProvider = {
  observe: async () => ({ observations: [] }),
};

const createLiveCapabilityDescriptor = (
  overrides: Partial<SignalTraderLiveCapabilityDescriptor> = {},
): SignalTraderLiveCapabilityDescriptor => ({
  key: LIVE_OBSERVER_BACKEND,
  supports_submit: true,
  supports_cancel_by_external_operate_order_id: true,
  supports_closed_order_history: true,
  supports_open_orders: true,
  supports_account_snapshot: true,
  supports_authorize_order_account_check: true,
  evidence_source: 'integration-test',
  ...overrides,
});

const createLiveCapabilityRegistry = (
  descriptors: SignalTraderLiveCapabilityDescriptor[] = [createLiveCapabilityDescriptor()],
): SignalTraderLiveCapabilityRegistry => createStaticLiveCapabilityRegistry(descriptors);

describe('@yuants/app-signal-trader', () => {
  it('校验 runtime config 的 live/mock 约束', () => {
    expect(() => normalizeRuntimeConfig({ ...basePaperRuntime(), subscription_id: 'mismatch' })).toThrow(
      'SUBSCRIPTION_ID_MUST_EQUAL_RUNTIME_ID',
    );
    expect(() => normalizeRuntimeConfig({ ...baseLiveRuntime(), observer_backend: '' })).toThrow(
      'LIVE_REQUIRES_OBSERVER_BACKEND',
    );
    expect(() =>
      normalizeRuntimeConfig({ ...baseLiveRuntime(), observer_backend: 'paper_simulated' }),
    ).toThrow('LIVE_FORBIDS_PAPER_SIMULATED_OBSERVER');
    expect(() => normalizeRuntimeConfig(baseLiveRuntime())).not.toThrow();
  });

  it('mock 路径可跑通 event -> effect -> report -> projection 闭环与 replay', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(repositories, createDefaultExecutionAdapterFactory());
    await manager.upsertRuntimeConfig(basePaperRuntime());

    const submit = await manager.submitSignal('runtime-paper', {
      command_type: 'submit_signal',
      signal_id: 'signal-1',
      signal_key: 'sig-paper',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });
    expect(submit.accepted).toBe(true);

    const product = await manager.queryProjection({
      runtime_id: 'runtime-paper',
      query: { type: 'product', product_id: 'BTC-USDT' },
    });
    expect((product as any).current_net_qty).toBe(10);

    const events = await manager.queryEventStream({ runtime_id: 'runtime-paper', query: {} });
    expect(events.map((item: { event_type: string }) => item.event_type)).toEqual(
      expect.arrayContaining([
        'SubscriptionUpdated',
        'SignalReceived',
        'OrderSubmitted',
        'OrderAccepted',
        'OrderFilled',
      ]),
    );

    const replay = await manager.replayRuntime('runtime-paper');
    expect(replay.accepted).toBe(true);
  });

  it('binding 写入后 live cancel 只能使用 external_operate_order_id', async () => {
    const repositories = createRepositories();
    let cancelledExternalId: string | undefined;
    const venue: LiveExecutionVenue = {
      authorizeOrder: async () => ({ account_id: 'acct-live' }),
      submitOrder: async () => ({
        external_submit_order_id: 'submit-1',
        external_operate_order_id: 'operate-1',
      }),
      cancelOrder: async (input) => {
        cancelledExternalId = input.external_operate_order_id;
      },
    };
    const adapter = new LiveExecutionAdapter(
      repositories.orderBindingRepository,
      async () => ({ type: 'OKX', payload: { ok: true } }),
      venue,
    );

    const submitResult = await adapter.execute(baseLiveRuntime(), [
      {
        effect_type: 'place_order',
        order_id: 'internal-1',
        signal_id: 'signal-1',
        product_id: LIVE_PRODUCT_ID,
        size: 1,
        attribution: [],
      },
    ]);
    await repositories.orderBindingRepository.upsert(submitResult.bindings[0]);

    const cancelResult = await adapter.execute(baseLiveRuntime(), [
      {
        effect_type: 'cancel_order',
        order_id: 'internal-1',
        product_id: LIVE_PRODUCT_ID,
      },
    ]);
    expect(cancelResult.lock_reason).toBeUndefined();
    expect(cancelledExternalId).toBe('operate-1');
  });

  it('mock 跨天后 query 与 submit 共用同一 daily burn 预算语义', async () => {
    jest.useFakeTimers();
    const baseTime = new Date('2026-01-01T00:00:00.000Z');
    jest.setSystemTime(baseTime);

    try {
      const repositories = createRepositories();
      const manager = new RuntimeManager(repositories, createDefaultExecutionAdapterFactory());
      await manager.upsertRuntimeConfig({ ...basePaperRuntime(), daily_burn_amount: 10 });

      const d0Subscription = (await manager.queryProjection({
        runtime_id: 'runtime-paper',
        query: { type: 'subscription', subscription_id: 'runtime-paper' },
      })) as any;
      expect(d0Subscription.available_vc).toBe(10);

      await manager.submitSignal('runtime-paper', {
        command_type: 'submit_signal',
        signal_id: 'paper-d0',
        signal_key: 'sig-paper',
        product_id: 'BTC-USDT',
        signal: 1,
        source: 'model',
        entry_price: 100,
        stop_loss_price: 90,
      });

      jest.setSystemTime(baseTime.getTime() + DAY_MS);

      const d1Subscription = (await manager.queryProjection({
        runtime_id: 'runtime-paper',
        query: { type: 'subscription', subscription_id: 'runtime-paper' },
      })) as any;
      expect(d1Subscription.released_vc_total).toBe(20);
      expect(d1Subscription.available_vc).toBe(10);

      await manager.submitSignal('runtime-paper', {
        command_type: 'submit_signal',
        signal_id: 'paper-d1',
        signal_key: 'sig-paper',
        product_id: 'BTC-USDT',
        signal: 1,
        source: 'model',
        entry_price: 100,
        stop_loss_price: 90,
      });

      const product = (await manager.queryProjection({
        runtime_id: 'runtime-paper',
        query: { type: 'product', product_id: 'BTC-USDT' },
      })) as any;
      expect(product.current_net_qty).toBe(2);
      expect(product.target_net_qty).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('mock clock controller can advance runtime time without touching system clock', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(repositories, createDefaultExecutionAdapterFactory());
    await manager.upsertRuntimeConfig({ ...basePaperRuntime(), daily_burn_amount: 10 });

    await expect(manager.getPaperClock()).resolves.toMatchObject({ offset_ms: 0 });

    const d0Subscription = (await manager.queryProjection({
      runtime_id: 'runtime-paper',
      query: { type: 'subscription', subscription_id: 'runtime-paper' },
    })) as any;
    expect(d0Subscription.released_vc_total).toBe(10);

    const advanced = await manager.advancePaperClock({ delta_ms: DAY_MS });
    expect(advanced.offset_ms).toBe(DAY_MS);

    const d1Subscription = (await manager.queryProjection({
      runtime_id: 'runtime-paper',
      query: { type: 'subscription', subscription_id: 'runtime-paper' },
    })) as any;
    expect(d1Subscription.released_vc_total).toBe(20);

    const reset = await manager.resetPaperClock();
    expect(reset.offset_ms).toBe(0);
  });

  it('mock transfer 支持 transfer-in / transfer-out 余额语义', async () => {
    const adapter = new PaperExecutionAdapter();
    const runtime = withTransferMetadata(basePaperRuntime());
    const transfer = runtime.metadata!.signal_trader_transfer as any;

    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({
      balance: 0,
      currency: 'USDT',
    });

    const transferIn = await adapter.submitTransfer({
      runtime,
      transfer,
      direction: 'funding_to_trading',
      amount: 12,
    });
    expect(transferIn.status).toBe('COMPLETE');
    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({
      balance: 12,
      currency: 'USDT',
    });

    const transferOut = await adapter.submitTransfer({
      runtime,
      transfer,
      direction: 'trading_to_funding',
      amount: 7,
    });
    expect(transferOut.status).toBe('COMPLETE');
    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({
      balance: 5,
      currency: 'USDT',
    });
  });

  it('paper adapter 支持 10 买 20 卖并把盈利结转到 mock account', async () => {
    const adapter = new PaperExecutionAdapter();
    const runtime = withTransferMetadata(basePaperRuntime());

    await adapter.submitTransfer({
      runtime,
      transfer: runtime.metadata!.signal_trader_transfer as any,
      direction: 'funding_to_trading',
      amount: 100,
    });
    adapter.setMockFillContext(runtime, {
      signal_id: 'signal-open',
      product_id: runtime.product_id,
      entry_price: 10,
    });
    await adapter.execute(runtime, [
      {
        effect_type: 'place_order',
        order_id: 'order-open',
        signal_id: 'signal-open',
        product_id: runtime.product_id,
        size: 1,
        attribution: [],
      },
    ]);

    adapter.setMockFillContext(runtime, {
      signal_id: 'signal-close',
      product_id: runtime.product_id,
      entry_price: 20,
    });
    const result = await adapter.execute(runtime, [
      {
        effect_type: 'place_order',
        order_id: 'order-close',
        signal_id: 'signal-close',
        product_id: runtime.product_id,
        size: -1,
        attribution: [],
      },
    ]);

    expect(
      result.commands.find(
        (item) => item.command_type === 'apply_execution_report' && item.status === 'filled',
      ),
    ).toMatchObject({
      avg_fill_price: 20,
    });
    expect(adapter.getMockAccountInfo(runtime)).toMatchObject({
      money: {
        balance: 110,
        equity: 110,
        profit: 0,
        free: 110,
        used: 0,
      },
      positions: [],
    });
    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({ balance: 100 });
  });

  it('paper adapter fill price 按 reference -> last price -> fallback_1 退化', async () => {
    const adapter = new PaperExecutionAdapter();
    const runtime = basePaperRuntime();

    adapter.setMockFillContext(runtime, {
      signal_id: 'signal-reference',
      product_id: runtime.product_id,
      reference_price: 12,
    });
    const referenceFill = await adapter.execute(runtime, [
      {
        effect_type: 'place_order',
        order_id: 'order-reference',
        signal_id: 'signal-reference',
        product_id: runtime.product_id,
        size: 1,
        attribution: [],
      },
    ]);
    expect(
      referenceFill.commands.find(
        (item) => item.command_type === 'apply_execution_report' && item.status === 'filled',
      ),
    ).toMatchObject({
      avg_fill_price: 12,
      raw_report: expect.objectContaining({ fill_price_source: 'reference_price' }),
    });

    const lastPriceFill = await adapter.execute(runtime, [
      {
        effect_type: 'place_order',
        order_id: 'order-last-price',
        signal_id: 'signal-last-price',
        product_id: runtime.product_id,
        size: 1,
        attribution: [],
      },
    ]);
    expect(
      lastPriceFill.commands.find(
        (item) => item.command_type === 'apply_execution_report' && item.status === 'filled',
      ),
    ).toMatchObject({
      avg_fill_price: 12,
      raw_report: expect.objectContaining({ fill_price_source: 'last_price' }),
    });

    const fallbackFill = await adapter.execute(basePaperRuntime(), [
      {
        effect_type: 'place_order',
        order_id: 'order-fallback',
        signal_id: 'signal-fallback',
        product_id: 'ETH-USDT',
        size: 1,
        attribution: [],
      },
    ]);
    expect(
      fallbackFill.commands.find(
        (item) => item.command_type === 'apply_execution_report' && item.status === 'filled',
      ),
    ).toMatchObject({
      avg_fill_price: 1,
      raw_report: expect.objectContaining({
        fill_price_source: 'fallback_1',
        resolved_fill_price: 1,
      }),
    });
  });

  it('paper transfer-out 会按 free clamp，避免 mock account free 变负', async () => {
    const adapter = new PaperExecutionAdapter();
    const runtime = withTransferMetadata(basePaperRuntime());

    await adapter.submitTransfer({
      runtime,
      transfer: runtime.metadata!.signal_trader_transfer as any,
      direction: 'funding_to_trading',
      amount: 10,
    });
    adapter.setMockFillContext(runtime, {
      signal_id: 'signal-open',
      product_id: runtime.product_id,
      entry_price: 10,
    });
    await adapter.execute(runtime, [
      {
        effect_type: 'place_order',
        order_id: 'order-open',
        signal_id: 'signal-open',
        product_id: runtime.product_id,
        size: 1,
        attribution: [],
      },
    ]);

    const transferOut = await adapter.submitTransfer({
      runtime,
      transfer: runtime.metadata!.signal_trader_transfer as any,
      direction: 'trading_to_funding',
      amount: 8,
    });
    expect(transferOut.expected_amount).toBe(0);
    expect(adapter.getMockAccountInfo(runtime).money.free).toBe(0);
    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({ balance: 10 });
  });

  it('paper runtime account_id 变更后会重置旧 mock account 状态', async () => {
    const adapter = new PaperExecutionAdapter();
    const runtime = withTransferMetadata(basePaperRuntime());

    await adapter.submitTransfer({
      runtime,
      transfer: runtime.metadata!.signal_trader_transfer as any,
      direction: 'funding_to_trading',
      amount: 50,
    });
    adapter.setMockFillContext(runtime, {
      signal_id: 'signal-open',
      product_id: runtime.product_id,
      entry_price: 10,
    });
    await adapter.execute(runtime, [
      {
        effect_type: 'place_order',
        order_id: 'order-open',
        signal_id: 'signal-open',
        product_id: runtime.product_id,
        size: 1,
        attribution: [],
      },
    ]);

    const oldAccount = adapter.getMockAccountInfo(runtime);
    const nextRuntime = { ...runtime, account_id: 'acct-paper-next' };

    await expect(adapter.queryTradingBalance(nextRuntime)).resolves.toMatchObject({
      balance: 0,
      currency: 'USDT',
    });
    const nextAccount = adapter.getMockAccountInfo(nextRuntime);
    expect(nextAccount.account_id).not.toBe(oldAccount.account_id);
    expect(nextAccount).toMatchObject({
      money: { balance: 0, equity: 0, profit: 0, used: 0, free: 0 },
      positions: [],
    });
  });

  it('mock runtime 会在不下单时按日把固定 tranche 划入 trading account', async () => {
    const repositories = createRepositories();
    const adapter = new PaperExecutionAdapter();
    const manager = new RuntimeManager(repositories, () => adapter);
    const runtime = {
      ...basePaperRuntime(),
      vc_budget: 30,
      daily_burn_amount: 10,
      metadata: {
        signal_trader_transfer: {
          funding_account_id: 'acct-funding',
          currency: 'USDT',
          min_transfer_amount: 1,
          trading_buffer_amount: 0,
        },
      },
    };
    await manager.upsertRuntimeConfig(runtime);

    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({
      balance: 10,
      currency: 'USDT',
    });

    await manager.advancePaperClock({ delta_ms: DAY_MS });

    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({
      balance: 20,
      currency: 'USDT',
    });
    const subscription = (await manager.queryProjection({
      runtime_id: 'runtime-paper',
      query: { type: 'subscription', subscription_id: 'runtime-paper' },
    })) as any;
    expect(subscription.funding_account).toBe(10);
    expect(subscription.trading_account).toBe(20);
  });

  it('mock runtime 不会在同一天重复补资，并且达到 vc_budget 后停止继续日拨', async () => {
    const repositories = createRepositories();
    const adapter = new PaperExecutionAdapter();
    const manager = new RuntimeManager(repositories, () => adapter);
    const runtime = {
      ...basePaperRuntime(),
      vc_budget: 25,
      daily_burn_amount: 10,
      metadata: {
        signal_trader_transfer: {
          funding_account_id: 'acct-funding',
          currency: 'USDT',
          min_transfer_amount: 1,
          trading_buffer_amount: 0,
        },
      },
    };
    await manager.upsertRuntimeConfig(runtime);

    const auditLogsD0 = await repositories.auditLogRepository.listByRuntime('runtime-paper');
    expect(auditLogsD0.filter((item) => item.action === 'transfer_submitted')).toHaveLength(1);
    await manager.queryProjection({
      runtime_id: 'runtime-paper',
      query: { type: 'subscription', subscription_id: 'runtime-paper' },
    });
    const auditLogsD0Repeat = await repositories.auditLogRepository.listByRuntime('runtime-paper');
    expect(auditLogsD0Repeat.filter((item) => item.action === 'transfer_submitted')).toHaveLength(1);

    await manager.advancePaperClock({ delta_ms: DAY_MS });
    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({
      balance: 20,
      currency: 'USDT',
    });

    await manager.advancePaperClock({ delta_ms: DAY_MS });
    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({
      balance: 25,
      currency: 'USDT',
    });

    const auditLogsAtCap = await repositories.auditLogRepository.listByRuntime('runtime-paper');
    expect(auditLogsAtCap.filter((item) => item.action === 'transfer_submitted')).toHaveLength(3);

    await manager.advancePaperClock({ delta_ms: DAY_MS });
    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({
      balance: 25,
      currency: 'USDT',
    });
    const auditLogsPastCap = await repositories.auditLogRepository.listByRuntime('runtime-paper');
    expect(auditLogsPastCap.filter((item) => item.action === 'transfer_submitted')).toHaveLength(3);
  });

  it('mock runtime 平仓后不会把已分配本金 sweep 回 funding', async () => {
    const repositories = createRepositories();
    const adapter = new PaperExecutionAdapter();
    const manager = new RuntimeManager(repositories, () => adapter);
    const runtime = {
      ...basePaperRuntime(),
      metadata: {
        signal_trader_transfer: {
          funding_account_id: 'acct-funding',
          currency: 'USDT',
          min_transfer_amount: 1,
          trading_buffer_amount: 0,
        },
      },
    };
    await manager.upsertRuntimeConfig(runtime);

    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({
      balance: 100,
      currency: 'USDT',
    });

    await manager.submitSignal('runtime-paper', {
      command_type: 'submit_signal',
      signal_id: 'paper-transfer-open',
      signal_key: 'sig-paper',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });

    await manager.submitSignal('runtime-paper', {
      command_type: 'submit_signal',
      signal_id: 'paper-transfer-close',
      signal_key: 'sig-paper',
      product_id: 'BTC-USDT',
      signal: 0,
      source: 'model',
    });

    const subscription = (await manager.queryProjection({
      runtime_id: 'runtime-paper',
      query: { type: 'subscription', subscription_id: 'runtime-paper' },
    })) as any;
    expect(subscription.trading_account).toBe(100);
    await expect(adapter.queryTradingBalance(runtime)).resolves.toMatchObject({
      balance: 100,
      currency: 'USDT',
    });

    const auditLogs = await repositories.auditLogRepository.listByRuntime('runtime-paper');
    expect(auditLogs.filter((item) => item.action === 'transfer_submitted')).toHaveLength(1);
    expect(auditLogs.filter((item) => item.action === 'transfer_completed')).toHaveLength(1);
  });

  it('live 跨天 submit 也使用同一 daily burn 预算语义', async () => {
    jest.useFakeTimers();
    const baseTime = new Date('2026-01-01T00:00:00.000Z');
    jest.setSystemTime(baseTime);

    try {
      const repositories = createRepositories();
      const observerProvider: RuntimeObserverProvider = {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 10 },
            updated_at: Date.now(),
          } as any,
        }),
      };
      const manager = new RuntimeManager(
        repositories,
        createDefaultExecutionAdapterFactory(
          () =>
            new LiveExecutionAdapter(
              repositories.orderBindingRepository,
              async () => ({ type: 'OKX', payload: {} }),
              {
                authorizeOrder: async () => ({ account_id: 'acct-live' }),
                submitOrder: async () => ({
                  external_submit_order_id: 'submit-live-d1',
                  external_operate_order_id: 'operate-live-d1',
                }),
                cancelOrder: async () => undefined,
              },
            ),
        ),
        observerProvider,
        createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
      );

      await manager.upsertRuntimeConfig({
        ...baseLiveRuntime(),
        daily_burn_amount: 10,
        poll_interval_ms: DAY_MS * 10,
        reconciliation_interval_ms: DAY_MS * 2,
      });

      jest.setSystemTime(baseTime.getTime() + DAY_MS);

      const submit = await manager.submitSignal('runtime-live', {
        command_type: 'submit_signal',
        signal_id: 'live-d1',
        signal_key: 'sig-live',
        product_id: LIVE_PRODUCT_ID,
        signal: 1,
        source: 'model',
        entry_price: 100,
        stop_loss_price: 90,
      });
      expect(submit.accepted).toBe(true);

      const subscription = (await manager.queryProjection({
        runtime_id: 'runtime-live',
        query: { type: 'subscription', subscription_id: 'runtime-live' },
      })) as any;
      expect(subscription.released_vc_total).toBe(20);
      expect(subscription.target_position_qty).toBe(2);

      const product = (await manager.queryProjection({
        runtime_id: 'runtime-live',
        query: { type: 'product', product_id: LIVE_PRODUCT_ID },
      })) as any;
      expect(product.target_net_qty).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('live runtime 会在 boot observer 周期先完成 daily allocation，再进入 submitOrder', async () => {
    const repositories = createRepositories();
    const calls: string[] = [];
    let observedBalance = 0;
    const manager = new RuntimeManager(
      repositories,
      (runtime) =>
        new LiveExecutionAdapter(
          repositories.orderBindingRepository,
          async () => ({ type: 'OKX', payload: {} }),
          {
            authorizeOrder: async () => ({ account_id: runtime.account_id }),
            submitOrder: async () => {
              calls.push('submitOrder');
              return {
                external_submit_order_id: 'submit-live-transfer-in',
                external_operate_order_id: 'operate-live-transfer-in',
              };
            },
            cancelOrder: async () => undefined,
            queryTradingBalance: async () => {
              calls.push('queryTradingBalance');
              return { balance: observedBalance, currency: 'USDT' };
            },
            findActiveTransfer: async () => {
              calls.push('findActiveTransfer');
              return undefined;
            },
            submitTransfer: async (_input) => {
              calls.push('submitTransfer');
              observedBalance = 12;
              return {
                order_id: 'transfer-live-1',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                credit_account_id: 'acct-funding',
                debit_account_id: runtime.account_id,
                currency: 'USDT',
                expected_amount: 12,
                status: 'INIT',
              };
            },
            pollTransfer: async () => {
              calls.push('pollTransfer');
              return {
                order_id: 'transfer-live-1',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                credit_account_id: 'acct-funding',
                debit_account_id: runtime.account_id,
                currency: 'USDT',
                expected_amount: 12,
                status: 'COMPLETE',
              };
            },
          },
        ),
      {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 10 },
            updated_at: Date.now(),
          } as any,
        }),
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );

    await manager.upsertRuntimeConfig(
      withTransferMetadata({
        ...baseLiveRuntime(),
        vc_budget: 10,
      }),
    );
    expect(calls).toEqual(['queryTradingBalance', 'findActiveTransfer', 'submitTransfer', 'pollTransfer']);

    calls.length = 0;
    const submit = await manager.submitSignal('runtime-live', {
      command_type: 'submit_signal',
      signal_id: 'signal-live-transfer-in',
      signal_key: 'sig-live',
      product_id: LIVE_PRODUCT_ID,
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });

    expect(submit.accepted).toBe(true);
    expect(calls).toEqual(['queryTradingBalance', 'submitOrder']);
    const auditLogs = await repositories.auditLogRepository.listByRuntime('runtime-live');
    expect(auditLogs.map((item) => item.action)).toEqual(
      expect.arrayContaining(['transfer_submitted', 'transfer_completed']),
    );
  });

  it('live observer 在不下单时也会按日拨资，且同一 snapshot 不会重复补资', async () => {
    jest.useFakeTimers();
    const baseTime = new Date('2026-01-01T00:00:00.000Z');
    jest.setSystemTime(baseTime);
    try {
      const repositories = createRepositories();
      let snapshotUpdatedAt = baseTime.getTime();
      let observedBalance = 0;
      let submitTransferCount = 0;
      const manager = new RuntimeManager(
        repositories,
        (runtime) =>
          new LiveExecutionAdapter(
            repositories.orderBindingRepository,
            async () => ({ type: 'OKX', payload: {} }),
            {
              authorizeOrder: async () => ({ account_id: runtime.account_id }),
              submitOrder: async () => ({
                external_submit_order_id: 'submit-ignored',
                external_operate_order_id: 'operate-ignored',
              }),
              cancelOrder: async () => undefined,
              queryTradingBalance: async () => ({ balance: observedBalance, currency: 'USDT' }),
              findActiveTransfer: async () => undefined,
              submitTransfer: async ({ amount }) => {
                submitTransferCount += 1;
                observedBalance += amount;
                return {
                  order_id: `transfer-in-${submitTransferCount}`,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  credit_account_id: 'acct-funding',
                  debit_account_id: runtime.account_id,
                  currency: 'USDT',
                  expected_amount: amount,
                  status: 'INIT',
                };
              },
              pollTransfer: async ({ order_id }) => ({
                order_id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                credit_account_id: 'acct-funding',
                debit_account_id: runtime.account_id,
                currency: 'USDT',
                expected_amount: observedBalance,
                status: 'COMPLETE',
              }),
            },
          ),
        {
          observe: async () => ({
            observations: [],
            account_snapshot: {
              account_id: 'acct-live',
              money: { balance: observedBalance, currency: 'USDT' },
              updated_at: snapshotUpdatedAt,
            } as any,
          }),
        },
        createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
      );

      await manager.upsertRuntimeConfig(
        withTransferMetadata({
          ...baseLiveRuntime(),
          vc_budget: 30,
          daily_burn_amount: 10,
          poll_interval_ms: 10,
          reconciliation_interval_ms: 5_000,
        }),
      );

      await jest.advanceTimersByTimeAsync(35);
      expect(submitTransferCount).toBe(1);

      snapshotUpdatedAt += 100;
      await jest.advanceTimersByTimeAsync(35);
      expect(submitTransferCount).toBe(1);

      jest.setSystemTime(baseTime.getTime() + DAY_MS);
      snapshotUpdatedAt += DAY_MS;
      observedBalance = 10;
      await jest.advanceTimersByTimeAsync(35);
      expect(submitTransferCount).toBe(2);

      manager.dispose();
    } finally {
      jest.useRealTimers();
    }
  });

  it('live observer transfer-out 会去重并等待新 snapshot 后再 sweep', async () => {
    const repositories = createRepositories();
    let snapshotUpdatedAt = Date.now();
    let observedBalance = 20;
    let submitTransferCount = 0;
    const manager = new RuntimeManager(
      repositories,
      (runtime) =>
        new LiveExecutionAdapter(
          repositories.orderBindingRepository,
          async () => ({ type: 'OKX', payload: {} }),
          {
            authorizeOrder: async () => ({ account_id: runtime.account_id }),
            submitOrder: async () => ({
              external_submit_order_id: 'submit-ignored',
              external_operate_order_id: 'operate-ignored',
            }),
            cancelOrder: async () => undefined,
            queryTradingBalance: async () => ({ balance: observedBalance, currency: 'USDT' }),
            findActiveTransfer: async () => undefined,
            submitTransfer: async () => {
              submitTransferCount += 1;
              return {
                order_id: `transfer-out-${submitTransferCount}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                credit_account_id: runtime.account_id,
                debit_account_id: 'acct-funding',
                currency: 'USDT',
                expected_amount: 18,
                status: 'INIT',
              };
            },
            pollTransfer: async ({ order_id }) => ({
              order_id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              credit_account_id: runtime.account_id,
              debit_account_id: 'acct-funding',
              currency: 'USDT',
              expected_amount: 18,
              status: 'COMPLETE',
            }),
          },
        ),
      {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: observedBalance },
            updated_at: snapshotUpdatedAt,
          } as any,
        }),
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );

    await manager.upsertRuntimeConfig(
      withTransferMetadata({
        ...baseLiveRuntime(),
        daily_burn_amount: 10,
        poll_interval_ms: 10,
        reconciliation_interval_ms: 5_000,
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(submitTransferCount).toBe(1);

    snapshotUpdatedAt += 100;
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(submitTransferCount).toBe(2);
  });

  it('live pre-order transfer-in 遇到 currency mismatch 会 fail-close', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      (runtime) =>
        new LiveExecutionAdapter(
          repositories.orderBindingRepository,
          async () => ({ type: 'OKX', payload: {} }),
          {
            authorizeOrder: async () => ({ account_id: runtime.account_id }),
            submitOrder: async () => ({
              external_submit_order_id: 'submit-should-not-run',
              external_operate_order_id: 'operate-should-not-run',
            }),
            cancelOrder: async () => undefined,
            queryTradingBalance: async () => ({ balance: 0, currency: 'BTC' }),
          },
        ),
      {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 10, free: 10, currency: 'USDT' },
            updated_at: Date.now(),
          } as any,
        }),
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );

    await manager.upsertRuntimeConfig(
      withTransferMetadata({
        ...baseLiveRuntime(),
        vc_budget: 10,
      }),
    );
    const submit = await manager.submitSignal('runtime-live', {
      command_type: 'submit_signal',
      signal_id: 'signal-live-transfer-currency-mismatch',
      signal_key: 'sig-live',
      product_id: LIVE_PRODUCT_ID,
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });

    expect(submit.accepted).toBe(false);
    expect(submit.reason).toBe('TRANSFER_CURRENCY_MISMATCH');
  });

  it('transfer-enabled live runtime forbids shared trading account across runtimes', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      (runtime) =>
        new LiveExecutionAdapter(
          repositories.orderBindingRepository,
          async () => ({ type: 'OKX', payload: {} }),
          {
            authorizeOrder: async () => ({ account_id: runtime.account_id }),
            submitOrder: async () => ({
              external_submit_order_id: 'submit-live-conflict',
              external_operate_order_id: 'operate-live-conflict',
            }),
            cancelOrder: async () => undefined,
            queryTradingBalance: async () => ({ balance: 10, currency: 'USDT' }),
          },
        ),
      {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 10, free: 10, currency: 'USDT' },
            updated_at: Date.now(),
          } as any,
        }),
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );

    const first = await manager.upsertRuntimeConfig(
      withTransferMetadata({
        ...baseLiveRuntime(),
        vc_budget: 10,
      }),
    );
    expect(first.accepted).toBe(true);

    const second = await manager.upsertRuntimeConfig(
      withTransferMetadata({
        ...baseLiveRuntime(),
        runtime_id: 'runtime-live-2',
        subscription_id: 'runtime-live-2',
        signal_key: 'sig-live-2',
        vc_budget: 10,
      }),
    );
    expect(second.accepted).toBe(false);
    expect(second.reason).toBe('TRANSFER_TRADING_ACCOUNT_CONFLICT');
  });

  it('restart 后仍可提交，但重启时保留 audit_only 锁态', async () => {
    const repositories = createRepositories();
    const readyObserverProvider: RuntimeObserverProvider = {
      observe: async () => ({
        observations: [],
        account_snapshot: {
          account_id: 'acct-live',
          money: { balance: 100 },
          updated_at: Date.now(),
        } as any,
      }),
    };
    const createManager = () =>
      new RuntimeManager(
        repositories,
        () =>
          new LiveExecutionAdapter(
            repositories.orderBindingRepository,
            async () => ({ type: 'OKX', payload: {} }),
            {
              authorizeOrder: async () => ({ account_id: 'unexpected-account' }),
              submitOrder: async () => ({
                external_submit_order_id: 'submit-1',
                external_operate_order_id: 'operate-1',
              }),
              cancelOrder: async () => undefined,
            },
          ),
        readyObserverProvider,
        createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
      );

    const manager1 = createManager();
    await manager1.upsertRuntimeConfig(baseLiveRuntime());
    const response = await manager1.submitSignal('runtime-live', {
      command_type: 'submit_signal',
      signal_id: 'signal-live-1',
      signal_key: 'sig-live',
      product_id: LIVE_PRODUCT_ID,
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });
    expect(response.accepted).toBe(true);

    const manager2 = createManager();
    await manager2.start();
    const health = await manager2.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('audit_only');
    expect(health.lock_reason).toBe('AUTHORIZE_ORDER_ACCOUNT_MISMATCH');
  });

  it('observer 缺失时 live 不进入 normal', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      undefined,
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );
    await manager.upsertRuntimeConfig({
      ...baseLiveRuntime(),
      poll_interval_ms: 1_000,
      reconciliation_interval_ms: 10,
    });

    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('stopped');
    expect(health.lock_reason).toBe('LIVE_OBSERVER_PROVIDER_NOT_CONFIGURED');
  });

  it('live 在首次 observe 后直接进入 normal，不再等待初始 reconcile gate', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      idleObserverProvider,
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );
    await manager.upsertRuntimeConfig(baseLiveRuntime());

    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('normal');
    expect(health.lock_reason).toBeUndefined();
  });

  it('stale snapshot 不允许 live 进入 normal', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 100 },
            updated_at: Date.now() - 5_000,
          } as any,
        }),
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );
    await manager.upsertRuntimeConfig({ ...baseLiveRuntime(), reconciliation_interval_ms: 1_000 });

    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('stopped');
    expect(health.lock_reason).toBe('RECONCILIATION_SNAPSHOT_STALE');
  });

  it('fresh matched reconciliation 过期后 observer 会切到 audit_only', async () => {
    const repositories = createRepositories();
    let mode: 'matched' | 'missing' = 'matched';
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      {
        observe: async () =>
          mode === 'matched'
            ? {
                observations: [],
                account_snapshot: {
                  account_id: 'acct-live',
                  money: { balance: 100 },
                  updated_at: Date.now(),
                } as any,
              }
            : { observations: [] },
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );
    await manager.upsertRuntimeConfig({
      ...baseLiveRuntime(),
      poll_interval_ms: 5,
      reconciliation_interval_ms: 10,
    });

    const bootHealth = await manager.getRuntimeHealth('runtime-live');
    expect(bootHealth.status).toBe('normal');
    mode = 'missing';

    await new Promise((resolve) => setTimeout(resolve, 30));
    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('audit_only');
    expect(health.lock_reason).toBe('RECONCILIATION_SNAPSHOT_MISSING');
  });

  it('submit 前不再执行 reconciliation freshness gate', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 100 },
            updated_at: Date.now(),
          } as any,
        }),
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );
    await manager.upsertRuntimeConfig({
      ...baseLiveRuntime(),
      poll_interval_ms: 1_000,
      reconciliation_interval_ms: 10,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const submit = await manager.submitSignal('runtime-live', {
      command_type: 'submit_signal',
      signal_id: 'signal-live-stale-submit',
      signal_key: 'sig-live',
      product_id: LIVE_PRODUCT_ID,
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });
    expect(submit.accepted).toBe(true);

    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('audit_only');
    expect(health.lock_reason).toBe('LIVE_EXECUTION_ADAPTER_NOT_CONFIGURED');
  });

  it('重启后同一 fresh matched snapshot 仍可恢复 normal', async () => {
    const repositories = createRepositories();
    const fixedUpdatedAt = Date.now();
    const createManager = () =>
      new RuntimeManager(
        repositories,
        createDefaultExecutionAdapterFactory(),
        {
          observe: async () => ({
            observations: [],
            account_snapshot: {
              account_id: 'acct-live',
              money: { balance: 100 },
              updated_at: fixedUpdatedAt,
            } as any,
          }),
        },
        createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
      );

    const manager1 = createManager();
    await manager1.upsertRuntimeConfig({
      ...baseLiveRuntime(),
      poll_interval_ms: 1_000,
      reconciliation_interval_ms: 5_000,
    });
    expect((await manager1.getRuntimeHealth('runtime-live')).status).toBe('normal');

    const manager2 = createManager();
    await manager2.start();
    const health = await manager2.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('normal');
    expect(health.last_matched_reconciliation_at_ms).toBe(fixedUpdatedAt);
  });

  it('observer 可回灌 report/account snapshot，并在缺失观测时锁定', async () => {
    const repositories = createRepositories();
    let mode: 'boot' | 'filled' | 'missing' = 'boot';
    const observerProvider: RuntimeObserverProvider = {
      observe: async ({ bindings }) => ({
        observations: bindings.map((binding) => ({
          binding,
          history_order:
            mode === 'filled'
              ? {
                  account_id: 'acct-live',
                  product_id: binding.product_id,
                  order_status: 'FILLED',
                  traded_volume: '1',
                  traded_price: '123',
                }
              : undefined,
        })),
        account_snapshot: {
          account_id: 'acct-live',
          money: { balance: 100 },
          updated_at: Date.now(),
        } as any,
      }),
    };
    const manager = new RuntimeManager(
      repositories,
      (runtime) =>
        new LiveExecutionAdapter(
          repositories.orderBindingRepository,
          async () => ({ type: 'OKX', payload: {} }),
          {
            authorizeOrder: async () => ({ account_id: runtime.account_id }),
            submitOrder: async () => ({
              external_submit_order_id: 'submit-1',
              external_operate_order_id: 'operate-1',
            }),
            cancelOrder: async () => undefined,
          },
        ),
      observerProvider,
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());
    mode = 'filled';
    const submit = await manager.submitSignal('runtime-live', {
      command_type: 'submit_signal',
      signal_id: 'signal-live-1',
      signal_key: 'sig-live',
      product_id: LIVE_PRODUCT_ID,
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });
    expect(submit.accepted).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 30));
    const eventsAfterFilled = await manager.queryEventStream({ runtime_id: 'runtime-live', query: {} });
    expect(eventsAfterFilled.map((item: { event_type: string }) => item.event_type)).toEqual(
      expect.arrayContaining(['OrderFilled', 'AuthorizedAccountSnapshotCaptured']),
    );
    const [filledBinding] = await repositories.orderBindingRepository.listByRuntime('runtime-live');
    expect(filledBinding?.binding_status).toBe('filled');

    mode = 'missing';
    await new Promise((resolve) => setTimeout(resolve, 30));
    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('audit_only');
    expect(health.lock_reason).toBe('MISSING_TERMINAL_OBSERVATION');
  });

  it('modify_order effect 会直接 fail-close', async () => {
    const repositories = createRepositories();
    const adapter = new LiveExecutionAdapter(
      repositories.orderBindingRepository,
      async () => ({ type: 'OKX', payload: {} }),
      {
        authorizeOrder: async () => ({ account_id: 'acct-live' }),
        submitOrder: async () => ({
          external_submit_order_id: 'submit-1',
          external_operate_order_id: 'operate-1',
        }),
        cancelOrder: async () => undefined,
      },
    );
    const result = await adapter.execute(baseLiveRuntime(), [
      { effect_type: 'modify_order', order_id: 'internal-1', product_id: LIVE_PRODUCT_ID, next_size: 2 },
    ]);
    expect(result.lock_reason).toBe('MODIFY_ORDER_NOT_SUPPORTED_IN_LIVE_V1');
  });

  it('缺失 external id 会直接 fail-close', async () => {
    const repositories = createRepositories();
    const adapter = new LiveExecutionAdapter(
      repositories.orderBindingRepository,
      async () => ({ type: 'OKX', payload: {} }),
      {
        authorizeOrder: async () => ({ account_id: 'acct-live' }),
        submitOrder: async () => ({ external_submit_order_id: 'submit-only' }),
        cancelOrder: async () => undefined,
      },
    );
    const result = await adapter.execute(baseLiveRuntime(), [
      {
        effect_type: 'place_order',
        order_id: 'internal-1',
        signal_id: 'signal-1',
        product_id: LIVE_PRODUCT_ID,
        size: 1,
        attribution: [],
      },
    ]);
    expect(result.lock_reason).toBe('MISSING_EXTERNAL_ORDER_IDS');
  });

  it('backfill/unlock 收紧并写入 audit log', async () => {
    const repositories = createRepositories();
    let observerMode: 'idle' | 'matched' = 'matched';
    let observedBalance = 100;
    const observerProvider: RuntimeObserverProvider = {
      observe: async ({ bindings }) =>
        observerMode === 'matched'
          ? {
              observations: bindings.map((binding) => ({
                binding,
                history_order: {
                  account_id: 'acct-live',
                  product_id: binding.product_id,
                  order_status: 'FILLED',
                  traded_volume: '1',
                  traded_price: '100',
                },
              })),
              account_snapshot: {
                account_id: 'acct-live',
                money: { balance: observedBalance },
                updated_at: Date.now(),
              } as any,
            }
          : { observations: [] },
    };
    const manager = new RuntimeManager(
      repositories,
      (runtime) =>
        new LiveExecutionAdapter(
          repositories.orderBindingRepository,
          async () => ({ type: 'OKX', payload: {} }),
          {
            authorizeOrder: async () => ({ account_id: runtime.account_id }),
            submitOrder: async () => ({ external_submit_order_id: 'submit-only' }),
            cancelOrder: async () => undefined,
          },
        ),
      observerProvider,
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );
    await manager.upsertRuntimeConfig(baseLiveRuntime());
    await manager.submitSignal('runtime-live', {
      command_type: 'submit_signal',
      signal_id: 'signal-live-1',
      signal_key: 'sig-live',
      product_id: LIVE_PRODUCT_ID,
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });

    const backfillRejected = await manager.backfillOrderBinding({
      runtime_id: 'runtime-live',
      internal_order_id: 'signal-live-1',
      external_submit_order_id: 'submit-rewrite',
      operator: 'alice',
      operator_note: 'nope',
      evidence: 'ticket-0',
    });
    expect(backfillRejected.accepted).toBe(false);
    expect(backfillRejected.reason).toBe('BINDING_NOT_FOUND');

    await repositories.orderBindingRepository.upsert({
      runtime_id: 'runtime-live',
      internal_order_id: 'internal-1',
      external_submit_order_id: 'submit-1',
      account_id: 'acct-live',
      product_id: LIVE_PRODUCT_ID,
      signal_id: 'signal-1',
      submit_effect_id: 'effect-1',
      binding_status: 'accepted',
      observer_backend: LIVE_OBSERVER_BACKEND,
      first_submitted_at_ms: 1,
    });
    await repositories.checkpointRepository.upsert({
      runtime_id: 'runtime-live',
      last_event_offset: 0,
      last_event_id: 'none',
      snapshot_json: { events: [], snapshot: { mode: 'normal' } },
      snapshot_hash: 'manual',
      health_status: 'audit_only',
      lock_reason: 'MISSING_EXTERNAL_ORDER_IDS',
    });

    const manager2 = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      observerProvider,
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );
    await manager2.start();
    const backfill = await manager2.backfillOrderBinding({
      runtime_id: 'runtime-live',
      internal_order_id: 'internal-1',
      external_operate_order_id: 'operate-1',
      operator: 'alice',
      operator_note: '补齐 operate id',
      evidence: 'ticket-2',
    });
    expect(backfill.accepted).toBe(true);

    const unlockRejected = await manager2.unlockRuntime({
      runtime_id: 'runtime-live',
      operator: 'alice',
      operator_note: '尝试解锁',
      evidence: 'ticket-1',
    });
    expect(unlockRejected.accepted).toBe(false);
    expect(unlockRejected.reason).toBe('UNLOCK_BLOCKED_BY_IN_FLIGHT_BINDING');

    const finalize = await manager2.backfillOrderBinding({
      runtime_id: 'runtime-live',
      internal_order_id: 'internal-1',
      binding_status: 'filled',
      operator: 'alice',
      operator_note: '人工确认已成交',
      evidence: 'ticket-3',
    });
    expect(finalize.accepted).toBe(true);
    const subscription = await manager2.queryProjection({
      runtime_id: 'runtime-live',
      query: { type: 'subscription', subscription_id: 'runtime-live' },
    });
    observedBalance = (subscription as any)?.trading_account ?? observedBalance;
    observerMode = 'idle';
    await new Promise((resolve) => setTimeout(resolve, 20));
    const unlockWithoutFreshReconcile = await manager2.unlockRuntime({
      runtime_id: 'runtime-live',
      operator: 'alice',
      operator_note: '缺少新鲜对账',
      evidence: 'ticket-stale',
    });
    expect(unlockWithoutFreshReconcile.accepted).toBe(false);
    expect(unlockWithoutFreshReconcile.reason).toBe('UNLOCK_REQUIRES_RECONCILIATION_MATCH');
    observerMode = 'matched';
    const unlock = await manager2.unlockRuntime({
      runtime_id: 'runtime-live',
      operator: 'alice',
      operator_note: '已核对外部订单',
      evidence: 'ticket-2',
    });
    expect(unlock.accepted).toBe(true);

    const auditLogs = await repositories.auditLogRepository.listByRuntime('runtime-live');
    expect(auditLogs.map((item) => item.action)).toEqual(
      expect.arrayContaining(['backfill_order_binding', 'unlock_runtime']),
    );
  });

  it('unlock 在同一 fresh matched snapshot 下也可恢复 normal', async () => {
    const repositories = createRepositories();
    const fixedUpdatedAt = Date.now();
    const createManager = () =>
      new RuntimeManager(
        repositories,
        createDefaultExecutionAdapterFactory(),
        {
          observe: async () => ({
            observations: [],
            account_snapshot: {
              account_id: 'acct-live',
              money: { balance: 100 },
              updated_at: fixedUpdatedAt,
            } as any,
          }),
        },
        createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
      );

    const manager1 = createManager();
    await manager1.upsertRuntimeConfig({
      ...baseLiveRuntime(),
      poll_interval_ms: 1_000,
      reconciliation_interval_ms: 5_000,
    });
    const checkpoint = await repositories.checkpointRepository.get('runtime-live');
    await repositories.checkpointRepository.upsert({
      ...checkpoint!,
      health_status: 'audit_only',
      lock_reason: 'MANUAL_LOCK',
    });

    const manager2 = createManager();
    await manager2.start();
    const unlock = await manager2.unlockRuntime({
      runtime_id: 'runtime-live',
      operator: 'alice',
      operator_note: '同一 snapshot 仍然 fresh',
      evidence: 'ticket-same-snapshot',
    });
    expect(unlock.accepted).toBe(true);

    const health = await manager2.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('normal');
  });

  it('observer 异常会显式降级并写 audit log', async () => {
    const repositories = createRepositories();
    let shouldThrow = false;
    const manager = new RuntimeManager(
      repositories,
      (runtime) =>
        new LiveExecutionAdapter(
          repositories.orderBindingRepository,
          async () => ({ type: 'OKX', payload: {} }),
          {
            authorizeOrder: async () => ({ account_id: runtime.account_id }),
            submitOrder: async () => ({
              external_submit_order_id: 'submit-1',
              external_operate_order_id: 'operate-1',
            }),
            cancelOrder: async () => undefined,
          },
        ),
      {
        observe: async () => {
          if (shouldThrow) {
            throw new Error('observer down');
          }
          return {
            observations: [],
            account_snapshot: {
              account_id: 'acct-live',
              money: { balance: 100 },
              updated_at: Date.now(),
            } as any,
          };
        },
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());
    shouldThrow = true;
    await new Promise((resolve) => setTimeout(resolve, 30));
    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('degraded');
    expect(health.last_error).toBe('OBSERVER_ERROR');
    const auditLogs = await repositories.auditLogRepository.listByRuntime('runtime-live');
    expect(auditLogs.map((item) => item.action)).toContain('runtime_degraded');
  });

  it('order history source unavailable 时会直接 fail-close', async () => {
    const repositories = createRepositories();
    let degraded = false;
    const manager = new RuntimeManager(
      repositories,
      (runtime) =>
        new LiveExecutionAdapter(
          repositories.orderBindingRepository,
          async () => ({ type: 'OKX', payload: {} }),
          {
            authorizeOrder: async () => ({ account_id: runtime.account_id }),
            submitOrder: async () => ({
              external_submit_order_id: 'submit-1',
              external_operate_order_id: 'operate-1',
            }),
            cancelOrder: async () => undefined,
          },
        ),
      {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 100 },
            updated_at: Date.now(),
          } as any,
          degraded_reason: degraded ? 'ORDER_HISTORY_SOURCE_UNAVAILABLE' : undefined,
        }),
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());
    degraded = true;
    await new Promise((resolve) => setTimeout(resolve, 30));

    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('audit_only');
    expect(health.lock_reason).toBe('ORDER_HISTORY_SOURCE_UNAVAILABLE');
  });

  it('存在 in-flight binding 时 order history source unavailable 会直接 fail-close', async () => {
    const repositories = createRepositories();
    let degraded = false;
    const manager = new RuntimeManager(
      repositories,
      (runtime) =>
        new LiveExecutionAdapter(
          repositories.orderBindingRepository,
          async () => ({ type: 'OKX', payload: {} }),
          {
            authorizeOrder: async () => ({ account_id: runtime.account_id }),
            submitOrder: async () => ({
              external_submit_order_id: 'submit-1',
              external_operate_order_id: 'operate-1',
            }),
            cancelOrder: async () => undefined,
          },
        ),
      {
        observe: async ({ bindings }) => ({
          observations: bindings.map((binding) => ({
            binding,
            open_order: degraded
              ? {
                  order_id: binding.external_operate_order_id,
                  account_id: 'acct-live',
                  product_id: binding.product_id,
                  order_status: 'ACCEPTED',
                  volume: 1,
                }
              : undefined,
          })),
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 100 },
            updated_at: Date.now(),
          } as any,
          degraded_reason: degraded ? 'ORDER_HISTORY_SOURCE_UNAVAILABLE' : undefined,
        }),
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());
    await manager.submitSignal('runtime-live', {
      command_type: 'submit_signal',
      signal_id: 'signal-live-1',
      signal_key: 'sig-live',
      product_id: LIVE_PRODUCT_ID,
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });

    degraded = true;
    await new Promise((resolve) => setTimeout(resolve, 30));

    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('audit_only');
    expect(health.lock_reason).toBe('ORDER_HISTORY_SOURCE_UNAVAILABLE');
  });

  it('读接口不隐式 boot 且服务默认只暴露只读面', async () => {
    const repositories = createRepositories();
    await repositories.runtimeConfigRepository.upsert(basePaperRuntime());
    const manager = new RuntimeManager(repositories, createDefaultExecutionAdapterFactory());

    await manager.queryProjection({
      runtime_id: 'runtime-paper',
      query: { type: 'product', product_id: 'BTC-USDT' },
    });
    await manager.queryEventStream({ runtime_id: 'runtime-paper', query: {} });
    await manager.getRuntimeHealth('runtime-paper');
    expect(await repositories.eventStore.list('runtime-paper')).toHaveLength(0);
    expect(await repositories.checkpointRepository.get('runtime-paper')).toBeUndefined();

    const services = new Map<string, (msg: any) => Promise<any>>();
    const terminal = {
      server: {
        provideService: (name: string, _schema: unknown, handler: (msg: any) => Promise<any>) => {
          services.set(name, handler);
          return { dispose() {} };
        },
      },
    } as any;
    let capturedUnlockReq: any;
    const handlers: SignalTraderServiceHandlers = {
      upsertRuntimeConfig: async () => ({ runtime_id: 'r1', accepted: true, correlation_id: '1' }),
      listRuntimeConfig: async () => [baseLiveRuntime()],
      listLiveCapabilities: async () => [
        {
          ...createLiveCapabilityDescriptor(),
          observer_backend: LIVE_OBSERVER_BACKEND,
          descriptor_hash: 'hash-1',
        },
      ],
      getPaperClock: async () => ({ real_now_ms: 1, offset_ms: 0, effective_now_ms: 1 }),
      getMockAccountInfo: async () => ({
        account_id: 'mock-account',
        updated_at: 1,
        money: { currency: 'USDT', balance: 0, equity: 0, profit: 0, free: 0, used: 0 },
        positions: [],
      }),
      submitSignal: async () => ({
        runtime_id: 'r1',
        accepted: false,
        reason: 'LOCKED',
        correlation_id: '2',
      }),
      queryProjection: async () => ({ ok: true }),
      queryEventStream: async () => [],
      queryRuntimeAuditLog: async () => ({
        items: [
          { runtime_id: 'r1', seq: 1, action: 'runtime_locked', created_at: '2026-03-19T00:00:00.000Z' },
        ],
      }),
      replayRuntime: async () => ({ runtime_id: 'r1', accepted: true, correlation_id: '3' }),
      advancePaperClock: async () => ({ real_now_ms: 1, offset_ms: DAY_MS, effective_now_ms: DAY_MS + 1 }),
      setPaperClockOffset: async () => ({ real_now_ms: 1, offset_ms: DAY_MS, effective_now_ms: DAY_MS + 1 }),
      resetPaperClock: async () => ({ real_now_ms: 1, offset_ms: 0, effective_now_ms: 1 }),
      getRuntimeHealth: async () => ({ runtime_id: 'r1', status: 'stopped', updated_at: 1 }),
      disableRuntime: async () => ({ runtime_id: 'r1', accepted: true, correlation_id: '4' }),
      backfillOrderBinding: async () => ({ runtime_id: 'r1', accepted: true, correlation_id: '5' }),
      unlockRuntime: async (req) => {
        capturedUnlockReq = req;
        return { runtime_id: 'r1', accepted: true, correlation_id: '6' };
      },
    };

    registerSignalTraderServices(terminal, handlers);
    expect([...services.keys()].sort()).toEqual([
      'SignalTrader/GetMockAccountInfo',
      'SignalTrader/GetRuntimeHealth',
      'SignalTrader/ListLiveCapabilities',
      'SignalTrader/ListRuntimeConfig',
      'SignalTrader/QueryEventStream',
      'SignalTrader/QueryProjection',
      'SignalTrader/QueryRuntimeAuditLog',
    ]);
    const anonymousRead = await services.get('SignalTrader/ListRuntimeConfig')!({ req: {} });
    expect(anonymousRead.res.code).toBe(403);

    expect(() =>
      registerSignalTraderServices(terminal, handlers, {
        enableMutatingServices: true,
      }),
    ).toThrow('MUTATING_OR_OPERATOR_SERVICES_REQUIRE_AUTHORIZE');

    expect(() =>
      registerSignalTraderServices(terminal, handlers, {
        enableOperatorServices: true,
        authorize: async () => true,
      }),
    ).toThrow('OPERATOR_SERVICES_REQUIRE_AUDIT_CONTEXT');

    registerSignalTraderServices(terminal, handlers, {
      allowAnonymousRead: true,
      enableMutatingServices: true,
      enableOperatorServices: true,
      enablePaperClockServices: true,
      authorize: ({ serviceName }) => serviceName !== 'SignalTrader/UnlockRuntime',
      resolveOperatorAuditContext: () => ({ principal: 'trusted-operator', source: 'session-1' }),
    });
    const listRes = await services.get('SignalTrader/ListRuntimeConfig')!({ req: {} });
    const clockRes = await services.get('SignalTrader/GetPaperClock')!({ req: {} });
    const matrixRes = await services.get('SignalTrader/ListLiveCapabilities')!({ req: {} });
    expect(clockRes.res.data.offset_ms).toBe(0);
    const advanceClockRes = await services.get('SignalTrader/AdvancePaperClock')!({
      req: { delta_ms: DAY_MS },
    });
    expect(advanceClockRes.res.data.offset_ms).toBe(DAY_MS);
    expect(matrixRes.res.data[0].descriptor_hash).toBe('hash-1');
    const auditRes = await services.get('SignalTrader/QueryRuntimeAuditLog')!({ req: { runtime_id: 'r1' } });
    expect(auditRes.res.data.items[0]).toMatchObject({ action: 'runtime_locked' });
    const submitRes = await services.get('SignalTrader/SubmitSignal')!({ req: { runtime_id: 'r1' } });
    expect(submitRes.res.code).toBe(409);
    const unlockRes = await services.get('SignalTrader/UnlockRuntime')!({ req: { runtime_id: 'r1' } });
    expect(unlockRes.res.code).toBe(403);

    registerSignalTraderServices(terminal, handlers, {
      allowAnonymousRead: true,
      enableMutatingServices: true,
      enableOperatorServices: true,
      enablePaperClockServices: true,
      authorize: async () => true,
      resolveOperatorAuditContext: () => ({
        principal: 'trusted-operator',
        source: 'session-2',
        request_id: 'req-1',
      }),
    });
    const allowedUnlockRes = await services.get('SignalTrader/UnlockRuntime')!({
      req: { runtime_id: 'r1', operator: 'spoofed-user' },
    });
    expect(allowedUnlockRes.res.code).toBe(0);
    expect(capturedUnlockReq).toMatchObject({
      operator: 'trusted-operator',
      audit_context: {
        principal: 'trusted-operator',
        source: 'session-2',
        request_id: 'req-1',
        requested_operator: 'spoofed-user',
      },
    });
  });

  it('app 会注册 mock account 查询服务并在 disable 时清理陈旧项', async () => {
    const repositories = createRepositories();
    const services = new Map<string, Array<(msg: any) => Promise<any>>>();
    const channels = new Map<string, unknown>();
    const terminal = {
      server: {
        provideService: (name: string, _schema: unknown, handler: (msg: any) => Promise<any>) => {
          const handlers = services.get(name) ?? [];
          handlers.push(handler);
          services.set(name, handlers);
          return {
            dispose() {
              const next = (services.get(name) ?? []).filter((item) => item !== handler);
              if (next.length === 0) services.delete(name);
              else services.set(name, next);
            },
          };
        },
      },
      channel: {
        publishChannel: (name: string, schema: { const: string }) => {
          channels.set(`${name}:${schema.const}`, true);
          return { dispose: () => channels.delete(`${name}:${schema.const}`) };
        },
      },
    } as any;

    const app = createSignalTraderApp({
      terminal,
      repositories,
      servicePolicy: { allowAnonymousRead: true, enableMutatingServices: true, authorize: async () => true },
    });
    await app.start();
    await app.services.upsertRuntimeConfig(withTransferMetadata(basePaperRuntime()));

    const getMockAccountInfo = services.get('SignalTrader/GetMockAccountInfo')![0];
    const mockAccountRes = await getMockAccountInfo({ req: { runtime_id: 'runtime-paper' } });
    const mockAccount = mockAccountRes.res.data;
    expect(mockAccount.account_id).toContain('signal-trader-mock');

    const queryAccountInfoHandlers = services.get('QueryAccountInfo') || [];
    expect(queryAccountInfoHandlers).toHaveLength(1);
    const queryAccountInfoRes = await queryAccountInfoHandlers[0]({
      req: { account_id: mockAccount.account_id },
    });
    expect(queryAccountInfoRes.res.data.account_id).toBe(mockAccount.account_id);
    expect(channels.has(`AccountInfo:${mockAccount.account_id}`)).toBe(true);

    await app.services.disableRuntime({ runtime_id: 'runtime-paper' });
    expect((services.get('QueryAccountInfo') || []).length).toBe(0);
    expect(channels.has(`AccountInfo:${mockAccount.account_id}`)).toBe(false);
    app.dispose();
  });

  it('app 在匿名读关闭时不会注册标准 mock account 读面', async () => {
    const repositories = createRepositories();
    const services = new Map<string, Array<(msg: any) => Promise<any>>>();
    const channels = new Map<string, unknown>();
    const terminal = {
      server: {
        provideService: (name: string, _schema: unknown, handler: (msg: any) => Promise<any>) => {
          const handlers = services.get(name) ?? [];
          handlers.push(handler);
          services.set(name, handlers);
          return {
            dispose() {
              const next = (services.get(name) ?? []).filter((item) => item !== handler);
              if (next.length === 0) services.delete(name);
              else services.set(name, next);
            },
          };
        },
      },
      channel: {
        publishChannel: (name: string, schema: { const: string }) => {
          channels.set(`${name}:${schema.const}`, true);
          return { dispose: () => channels.delete(`${name}:${schema.const}`) };
        },
      },
    } as any;

    const app = createSignalTraderApp({
      terminal,
      repositories,
      servicePolicy: { enableMutatingServices: true, authorize: async () => true },
    });
    await app.start();
    await app.services.upsertRuntimeConfig(withTransferMetadata(basePaperRuntime()));

    expect((services.get('QueryAccountInfo') || []).length).toBe(0);
    expect([...channels.keys()]).toHaveLength(0);
    app.dispose();
  });

  it('observer normalizer 支持 binding 翻译与缺失 external id fail-close', () => {
    const missing = normalizeObservation({
      runtime: baseLiveRuntime(),
      binding: {
        runtime_id: 'runtime-live',
        internal_order_id: 'internal-1',
        account_id: 'acct-live',
        product_id: LIVE_PRODUCT_ID,
        signal_id: 'signal-1',
        submit_effect_id: 'effect-1',
        binding_status: 'submitted',
        observer_backend: LIVE_OBSERVER_BACKEND,
        first_submitted_at_ms: 1,
      },
    });
    expect(missing.lock_reason).toBe('MISSING_EXTERNAL_OPERATE_ORDER_ID');

    const normalized = normalizeObservation({
      runtime: baseLiveRuntime(),
      binding: {
        runtime_id: 'runtime-live',
        internal_order_id: 'internal-1',
        external_submit_order_id: 'submit-1',
        external_operate_order_id: 'operate-1',
        account_id: 'acct-live',
        product_id: LIVE_PRODUCT_ID,
        signal_id: 'signal-1',
        submit_effect_id: 'effect-1',
        binding_status: 'accepted',
        observer_backend: LIVE_OBSERVER_BACKEND,
        first_submitted_at_ms: 1,
      },
      history_order: {
        account_id: 'acct-live',
        product_id: LIVE_PRODUCT_ID,
        order_status: 'FILLED',
        traded_volume: '1',
        traded_price: '123',
      },
    });
    expect(normalized.commands[0]).toMatchObject({
      command_type: 'apply_execution_report',
      order_id: 'internal-1',
      status: 'filled',
    });
  });

  it('非 OKX product/backend 在提供 capability descriptor 时可正常 boot', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 100 },
            updated_at: Date.now(),
          } as any,
        }),
      },
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());

    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('normal');
    const auditLogs = await repositories.auditLogRepository.listByRuntime('runtime-live');
    expect(auditLogs.map((item) => item.action)).toContain('live_capability_validated');
  });

  it('live 缺 capability descriptor 时 boot fail-close', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      idleObserverProvider,
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());

    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('stopped');
    expect(health.lock_reason).toBe('LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED');
    const auditLogs = await repositories.auditLogRepository.listByRuntime('runtime-live');
    const latestRejectedLog = [...auditLogs]
      .reverse()
      .find((item) => item.action === 'live_capability_rejected');
    expect(latestRejectedLog?.detail).toMatchObject({
      phase: 'boot',
      validator_result: 'LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED',
    });
  });

  it('live capability 缺关键能力时 boot fail-close', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      idleObserverProvider,
      createLiveCapabilityRegistry([
        createLiveCapabilityDescriptor({
          supports_closed_order_history: false,
        }),
      ]),
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());

    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('stopped');
    expect(health.lock_reason).toBe('LIVE_CAPABILITY_DESCRIPTOR_INSUFFICIENT');
    const auditLogs = await repositories.auditLogRepository.listByRuntime('runtime-live');
    const latestRejectedLog = [...auditLogs]
      .reverse()
      .find((item) => item.action === 'live_capability_rejected');
    expect(latestRejectedLog?.detail).toMatchObject({
      phase: 'boot',
      descriptor_hash: expect.any(String),
      validator_result: 'LIVE_CAPABILITY_DESCRIPTOR_INSUFFICIENT',
      missing_capabilities: ['supports_closed_order_history'],
    });
  });

  it('缺 descriptor 时进入 stopped', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      idleObserverProvider,
      createLiveCapabilityRegistry([]),
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());

    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('stopped');
    expect(health.lock_reason).toBe('LIVE_CAPABILITY_DESCRIPTOR_MISSING');
  });

  it('ListLiveCapabilities 返回带 descriptor_hash 的 support matrix', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      idleObserverProvider,
      createLiveCapabilityRegistry([
        createLiveCapabilityDescriptor({ evidence_source: 'binance-order-history-v1' }),
      ]),
    );

    const capabilities = await manager.listLiveCapabilities();
    expect(capabilities).toEqual([
      expect.objectContaining({
        observer_backend: LIVE_OBSERVER_BACKEND,
        evidence_source: 'binance-order-history-v1',
        descriptor_hash: expect.any(String),
        supports_submit: true,
      }),
    ]);
  });

  it('audit log 包含 phase / descriptor_hash / validator_result', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(),
      idleObserverProvider,
      createLiveCapabilityRegistry([createLiveCapabilityDescriptor()]),
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());

    const auditLogs = await repositories.auditLogRepository.listByRuntime('runtime-live');
    const latestValidatedLog = [...auditLogs]
      .reverse()
      .find((item) => item.action === 'live_capability_validated');
    expect(auditLogs.find((item) => item.action === 'live_capability_validated')?.detail).toMatchObject({
      phase: 'upsert',
      observer_backend: LIVE_OBSERVER_BACKEND,
      descriptor_hash: expect.any(String),
      validator_result: 'ok',
    });
    expect(latestValidatedLog?.detail).toMatchObject({
      phase: 'boot',
      descriptor_hash: expect.any(String),
      validator_result: 'ok',
    });
  });

  it('live 运行中执行异常会 fail-close 到 audit_only', async () => {
    const repositories = createRepositories();
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(() => ({
        execute: async () => {
          throw new Error('submit-failed');
        },
      })),
      {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 100 },
            updated_at: Date.now(),
          } as any,
        }),
      },
      createLiveCapabilityRegistry(),
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());
    const response = await manager.submitSignal('runtime-live', {
      command_type: 'submit_signal',
      signal_id: 'signal-runtime-error',
      signal_key: 'sig-live',
      product_id: LIVE_PRODUCT_ID,
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });

    expect(response.accepted).toBe(false);
    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('audit_only');
    expect(health.lock_reason).toBe('LIVE_EXECUTION_RUNTIME_ERROR');
    const auditLogs = await repositories.auditLogRepository.listByRuntime('runtime-live');
    expect(auditLogs.find((item) => item.action === 'runtime_locked')?.detail).toMatchObject({
      phase: 'execute_effects',
      signal_id: 'signal-runtime-error',
      error_message: 'submit-failed',
    });
  });

  it('live binding 持久化异常会 fail-close 到 audit_only', async () => {
    const repositories = createRepositories();
    const originalUpsert = repositories.orderBindingRepository.upsert.bind(
      repositories.orderBindingRepository,
    );
    let shouldThrow = true;
    repositories.orderBindingRepository.upsert = async (binding) => {
      if (shouldThrow) {
        shouldThrow = false;
        throw new Error('binding-write-failed');
      }
      return originalUpsert(binding);
    };
    const manager = new RuntimeManager(
      repositories,
      createDefaultExecutionAdapterFactory(() => ({
        execute: async () => ({
          commands: [],
          bindings: [
            {
              runtime_id: 'runtime-live',
              internal_order_id: 'binding-order-1',
              external_submit_order_id: 'submit-1',
              external_operate_order_id: 'operate-1',
              account_id: 'acct-live',
              product_id: LIVE_PRODUCT_ID,
              signal_id: 'signal-binding-error',
              submit_effect_id: 'effect-1',
              binding_status: 'submitted',
              observer_backend: LIVE_OBSERVER_BACKEND,
              first_submitted_at_ms: Date.now(),
            },
          ],
        }),
      })),
      {
        observe: async () => ({
          observations: [],
          account_snapshot: {
            account_id: 'acct-live',
            money: { balance: 100 },
            updated_at: Date.now(),
          } as any,
        }),
      },
      createLiveCapabilityRegistry(),
    );

    await manager.upsertRuntimeConfig(baseLiveRuntime());
    const response = await manager.submitSignal('runtime-live', {
      command_type: 'submit_signal',
      signal_id: 'signal-binding-error',
      signal_key: 'sig-live',
      product_id: LIVE_PRODUCT_ID,
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });

    expect(response.accepted).toBe(false);
    const health = await manager.getRuntimeHealth('runtime-live');
    expect(health.status).toBe('audit_only');
    expect(health.lock_reason).toBe('LIVE_EXECUTION_RUNTIME_ERROR');
    const auditLogs = await repositories.auditLogRepository.listByRuntime('runtime-live');
    expect(auditLogs.find((item) => item.action === 'runtime_locked')?.detail).toMatchObject({
      phase: 'execute_effects',
      signal_id: 'signal-binding-error',
      error_message: 'binding-write-failed',
    });
  });
});
