import {
  createSignalTraderServicePolicyFromEnv,
  createVexAccountBoundLiveDeps,
  DEFAULT_OPERATOR_PRINCIPAL,
  DEFAULT_VEX_ACCOUNT_BOUND_EVIDENCE_SOURCE,
  DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND,
  readSignalTraderEnvBootstrapConfig,
} from '../bootstrap-from-env';
import { SignalTraderRuntimeConfig } from '../types';

const createLiveRuntime = (): SignalTraderRuntimeConfig => ({
  runtime_id: 'runtime-live',
  enabled: true,
  execution_mode: 'live',
  account_id: 'acct-live',
  subscription_id: 'runtime-live',
  investor_id: 'investor-live',
  signal_key: 'sig-live',
  product_id: 'BINANCE/SWAP/BTC-USDT',
  vc_budget: 100,
  daily_burn_amount: 10,
  subscription_status: 'active',
  observer_backend: DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND,
  poll_interval_ms: 1000,
  reconciliation_interval_ms: 5000,
  event_batch_size: 100,
  metadata: {
    signal_trader_transfer: {
      funding_account_id: 'acct-funding',
      currency: 'USDT',
      min_transfer_amount: 1,
      trading_buffer_amount: 2,
    },
    vex_account_bound_route_proof: {
      target_terminal_id: 'vex-terminal',
      submit_order_service_id: 'svc.submit',
      cancel_order_service_id: 'svc.cancel',
      query_pending_orders_service_id: 'svc.pending',
      query_account_info_service_id: 'svc.account',
    },
  },
});

const createAccountBoundServiceInfo = (method: string, serviceId: string) => ({
  method,
  service_id: serviceId,
  schema: { properties: { account_id: { const: 'acct-live' } } },
});

const createVerifiedTerminal = (requestForResponseData = jest.fn()) =>
  ({
    client: { requestForResponseData },
    terminalInfos: [
      {
        terminal_id: 'vex-terminal',
        serviceInfo: {
          listCredentials: { method: 'VEX/ListCredentials', service_id: 'vex/list' },
          submit: createAccountBoundServiceInfo('SubmitOrder', 'svc.submit'),
          cancel: createAccountBoundServiceInfo('CancelOrder', 'svc.cancel'),
          pending: createAccountBoundServiceInfo('QueryPendingOrders', 'svc.pending'),
          account: createAccountBoundServiceInfo('QueryAccountInfo', 'svc.account'),
        },
      },
    ],
  } as any);

describe('bootstrap-from-env', () => {
  it('默认 live bootstrap 配置收敛为 VEX account-bound + SQL order history', () => {
    const config = readSignalTraderEnvBootstrapConfig({} as NodeJS.ProcessEnv);
    expect(config.observerBackend).toBe(DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND);
    expect(config.evidenceSource).toBe(DEFAULT_VEX_ACCOUNT_BOUND_EVIDENCE_SOURCE);
    expect(config.submitOrderServiceName).toBe('SubmitOrder');
    expect(config.cancelOrderServiceName).toBe('CancelOrder');
    expect(config.queryPendingOrdersServiceName).toBe('QueryPendingOrders');
    expect(config.queryAccountInfoServiceName).toBe('QueryAccountInfo');
    expect(config.transferOrderTableName).toBe('transfer_order');
    expect(config.transferPollIntervalMs).toBe(1000);
    expect(config.transferTimeoutMs).toBe(60000);
  });

  it('废弃 env 覆盖项会被忽略', () => {
    const config = readSignalTraderEnvBootstrapConfig({
      SIGNAL_TRADER_LIVE_BACKEND: 'legacy-backend',
      SIGNAL_TRADER_ORDER_HISTORY_TABLE: 'legacy_order',
      SIGNAL_TRADER_SUBMIT_ORDER_SERVICE_NAME: 'LegacySubmitOrder',
    } as NodeJS.ProcessEnv);
    expect(config.observerBackend).toBe(DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND);
    expect(config.orderHistoryTable).toBe('order');
    expect(config.submitOrderServiceName).toBe('SubmitOrder');
    expect(config.transferOrderTableName).toBe('transfer_order');
  });

  it('默认 service policy 不开放匿名读，写入需显式 env 开关', async () => {
    const policy = createSignalTraderServicePolicyFromEnv({} as NodeJS.ProcessEnv);
    expect(policy.allowAnonymousRead).toBe(false);
    expect(policy.enableMutatingServices).toBe(false);
    expect(policy.enableOperatorServices).toBe(false);
    await expect(policy.authorizeRead?.({ serviceName: 'x', request: {} })).resolves.toBe(false);
    await expect(policy.authorize?.({ serviceName: 'x', request: {} })).resolves.toBe(false);
    await expect(
      policy.resolveOperatorAuditContext?.({
        serviceName: 'SignalTrader/UnlockRuntime',
        request: { operator: 'alice' },
      }),
    ).resolves.toBeUndefined();
  });

  it('显式 env 开启时 service policy 恢复 host 内互信写权限', async () => {
    const policy = createSignalTraderServicePolicyFromEnv({
      SIGNAL_TRADER_ALLOW_ANONYMOUS_READ: '1',
      SIGNAL_TRADER_ENABLE_MUTATING_SERVICES: '1',
      SIGNAL_TRADER_ENABLE_OPERATOR_SERVICES: '1',
      SIGNAL_TRADER_ASSUME_INTERNAL_TRUSTED: '1',
    } as NodeJS.ProcessEnv);
    expect(policy.allowAnonymousRead).toBe(true);
    await expect(policy.authorizeRead?.({ serviceName: 'x', request: {} })).resolves.toBe(true);
    expect(policy.enableMutatingServices).toBe(true);
    expect(policy.enableOperatorServices).toBe(true);
    await expect(policy.authorize?.({ serviceName: 'x', request: {} })).resolves.toBe(true);
    await expect(
      policy.resolveOperatorAuditContext?.({
        serviceName: 'SignalTrader/UnlockRuntime',
        request: { operator: 'alice' },
      }),
    ).resolves.toMatchObject({
      principal: DEFAULT_OPERATOR_PRINCIPAL,
      requested_operator: 'alice',
    });
  });

  it('默认 route context 只携带 VEX account-bound 路由信息', async () => {
    const terminal = createVerifiedTerminal();
    const deps = createVexAccountBoundLiveDeps(
      terminal,
      readSignalTraderEnvBootstrapConfig({} as NodeJS.ProcessEnv),
    );
    const credential = await deps.resolveLiveCredential(createLiveRuntime());
    expect(credential.type).toBe('signal_trader_live_route_context');
    expect(credential.payload).toEqual({
      runtime_id: 'runtime-live',
      account_id: 'acct-live',
      observer_backend: DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND,
      target_terminal_id: 'vex-terminal',
      submit_order_service_id: 'svc.submit',
      cancel_order_service_id: 'svc.cancel',
      query_pending_orders_service_id: 'svc.pending',
      query_account_info_service_id: 'svc.account',
    });
    expect(deps.liveCapabilityDescriptor).toMatchObject({
      key: DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND,
      evidence_source: DEFAULT_VEX_ACCOUNT_BOUND_EVIDENCE_SOURCE,
      supports_submit: true,
      supports_cancel_by_external_operate_order_id: true,
      supports_closed_order_history: true,
      supports_open_orders: true,
      supports_account_snapshot: true,
      supports_authorize_order_account_check: true,
    });
  });

  it('account-bound live venue 默认调用通用 Submit/Cancel/Account 服务', async () => {
    const requestForResponseData = jest.fn(async (method: string, payload: any) => {
      if (method === 'svc.account') {
        return {
          account_id: payload.account_id,
          money: { balance: 1, free: 1, currency: 'USDT' },
          updated_at: Date.now(),
        };
      }
      if (method === 'svc.submit') {
        return { order_id: 'external-1' };
      }
      if (method === 'svc.cancel') {
        return undefined;
      }
      throw new Error(`UNEXPECTED_METHOD:${method}`);
    });
    const terminal = createVerifiedTerminal(requestForResponseData);
    const deps = createVexAccountBoundLiveDeps(
      terminal,
      readSignalTraderEnvBootstrapConfig({} as NodeJS.ProcessEnv),
    );
    const credential = await deps.resolveLiveCredential(createLiveRuntime());

    await deps.liveVenue!.authorizeOrder({
      credential,
      effect: { effect_type: 'place_order' },
    });
    await deps.liveVenue!.submitOrder({
      credential,
      runtime: createLiveRuntime(),
      internal_order_id: 'internal-1',
      signal_id: 'signal-1',
      product_id: 'BINANCE/SWAP/BTC-USDT',
      size: 2,
      stop_loss_price: 90,
    });
    await deps.liveVenue!.cancelOrder({
      credential,
      runtime: createLiveRuntime(),
      internal_order_id: 'internal-1',
      external_operate_order_id: 'external-1',
      product_id: 'BINANCE/SWAP/BTC-USDT',
    });

    expect(requestForResponseData).toHaveBeenNthCalledWith(1, 'svc.account', {
      account_id: 'acct-live',
      force_update: false,
    });
    expect(requestForResponseData).toHaveBeenNthCalledWith(2, 'svc.submit', {
      order_id: 'internal-1',
      account_id: 'acct-live',
      product_id: 'BINANCE/SWAP/BTC-USDT',
      order_type: 'MARKET',
      volume: 2,
      size: '2',
      stop_loss_price: 90,
    });
    expect(requestForResponseData).toHaveBeenNthCalledWith(3, 'svc.cancel', {
      order_id: 'external-1',
      account_id: 'acct-live',
      product_id: 'BINANCE/SWAP/BTC-USDT',
      volume: 0,
    });
  });

  it('account-bound live venue 默认提供 transfer query/submit/poll', async () => {
    const requestForResponseData = jest.fn(async (method: string, payload: any) => {
      if (method === 'svc.account') {
        return {
          account_id: payload.account_id,
          money: { balance: 8, free: 8, currency: 'USDT' },
          updated_at: Date.now(),
        };
      }
      throw new Error(`UNEXPECTED_METHOD:${method}`);
    });
    const sqlState = { inserted: undefined as any };
    const requestSql = jest.fn(async (_terminal: unknown, sql: string) => {
      if (sql.includes('INSERT INTO transfer_order')) {
        sqlState.inserted = sql;
        return [];
      }
      if (sql.includes('status NOT IN')) {
        return [];
      }
      return [
        {
          order_id: 'transfer-1',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:01.000Z',
          runtime_id: 'runtime-live',
          credit_account_id: 'acct-funding',
          debit_account_id: 'acct-live',
          currency: 'USDT',
          expected_amount: 5,
          status: 'COMPLETE',
        },
      ];
    });
    const terminal = createVerifiedTerminal(requestForResponseData);
    const deps = createVexAccountBoundLiveDeps(
      terminal,
      readSignalTraderEnvBootstrapConfig({} as NodeJS.ProcessEnv),
      { requestSql: requestSql as any },
    );
    const runtime = createLiveRuntime();
    const credential = await deps.resolveLiveCredential(runtime);
    const transfer = runtime.metadata!.signal_trader_transfer as any;

    await expect(deps.liveVenue.queryTradingBalance?.({ credential, runtime })).resolves.toMatchObject({
      balance: 8,
      currency: 'USDT',
    });
    await expect(
      deps.liveVenue.findActiveTransfer?.({ credential, runtime, transfer }),
    ).resolves.toBeUndefined();
    await expect(
      deps.liveVenue.submitTransfer?.({
        credential,
        runtime,
        transfer,
        direction: 'funding_to_trading',
        amount: 5,
      }),
    ).resolves.toMatchObject({
      credit_account_id: 'acct-funding',
      debit_account_id: 'acct-live',
      currency: 'USDT',
      expected_amount: 5,
      status: 'INIT',
    });
    await expect(
      deps.liveVenue.pollTransfer?.({ credential, runtime, transfer, order_id: 'transfer-1' }),
    ).resolves.toMatchObject({ order_id: 'transfer-1', status: 'COMPLETE' });
    expect(sqlState.inserted).toContain('INSERT INTO transfer_order');
  });

  it('quote provider 默认从 SQL quote 表读取正式价格证据', async () => {
    const terminal = createVerifiedTerminal();
    const requestSql = jest.fn(async () => [
      {
        datasource_id: 'okx',
        product_id: 'BINANCE/SWAP/BTC-USDT',
        updated_at: '2026-03-23T00:00:00.000Z',
        bid_price: '99',
        ask_price: '101',
        last_price: '100',
      },
    ]);
    const deps = createVexAccountBoundLiveDeps(
      terminal,
      readSignalTraderEnvBootstrapConfig({} as NodeJS.ProcessEnv),
      { requestSql: requestSql as any },
    );
    await expect(deps.quoteProvider.getLatestReferencePrice(createLiveRuntime())).resolves.toEqual({
      evidence: {
        product_id: 'BINANCE/SWAP/BTC-USDT',
        price: 100,
        source: 'sql.quote.bid_ask_mid',
        datasource_id: 'okx',
        quote_updated_at: '2026-03-23T00:00:00.000Z',
      },
    });
  });

  it('quote provider 在多 datasource 且未显式指定时 fail-close', async () => {
    const terminal = createVerifiedTerminal();
    const requestSql = jest.fn(async () => [
      {
        datasource_id: 'okx',
        product_id: 'BINANCE/SWAP/BTC-USDT',
        updated_at: '2026-03-23T00:00:00.000Z',
        last_price: '100',
      },
      {
        datasource_id: 'binance',
        product_id: 'BINANCE/SWAP/BTC-USDT',
        updated_at: '2026-03-22T23:59:59.000Z',
        last_price: '101',
      },
    ]);
    const deps = createVexAccountBoundLiveDeps(
      terminal,
      readSignalTraderEnvBootstrapConfig({} as NodeJS.ProcessEnv),
      { requestSql: requestSql as any },
    );
    await expect(deps.quoteProvider.getLatestReferencePrice(createLiveRuntime())).resolves.toEqual({
      reason: 'QUOTE_AMBIGUOUS_DATASOURCE',
    });
  });

  it('observer provider 默认结合 pending/account 与 SQL order history', async () => {
    const requestForResponseData = jest.fn(async (method: string) => {
      if (method === 'svc.pending') return [{ order_id: 'external-1', order_status: 'OPEN' }];
      if (method === 'svc.account') {
        return { account_id: 'acct-live', money: { balance: 1 }, updated_at: Date.now() };
      }
      throw new Error(`UNEXPECTED_METHOD:${method}`);
    });
    const requestSql = jest.fn(async () => [
      {
        order_id: 'external-1',
        account_id: 'acct-live',
        product_id: 'BINANCE/SWAP/BTC-USDT',
        order_status: 'TRADED',
        traded_volume: 1,
      },
    ]);
    const terminal = createVerifiedTerminal(requestForResponseData);
    const deps = createVexAccountBoundLiveDeps(
      terminal,
      readSignalTraderEnvBootstrapConfig({} as NodeJS.ProcessEnv),
      { requestSql: requestSql as any },
    );
    const result = await deps.observerProvider.observe({
      runtime: createLiveRuntime(),
      bindings: [
        {
          runtime_id: 'runtime-live',
          internal_order_id: 'internal-1',
          external_operate_order_id: 'external-1',
          external_submit_order_id: 'external-1',
          account_id: 'acct-live',
          product_id: 'BINANCE/SWAP/BTC-USDT',
          signal_id: 'signal-1',
          submit_effect_id: 'effect-1',
          binding_status: 'submitted',
          observer_backend: DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND,
          first_submitted_at_ms: Date.now(),
        },
      ],
    });

    expect(requestSql).toHaveBeenCalledTimes(1);
    expect(requestForResponseData).toHaveBeenCalledWith('svc.pending', {
      account_id: 'acct-live',
      force_update: false,
    });
    expect(requestForResponseData).toHaveBeenCalledWith('svc.account', {
      account_id: 'acct-live',
      force_update: false,
    });
    expect(result.observations[0].history_order?.order_status).toBe('FILLED');
    expect(result.observations[0].open_order).toEqual({ order_id: 'external-1', order_status: 'OPEN' });
    expect(result.account_snapshot).toMatchObject({ account_id: 'acct-live' });
  });

  it('只在探测到 VEX account-bound 服务时声明默认 live capability', async () => {
    const terminal = createVerifiedTerminal();
    const deps = createVexAccountBoundLiveDeps(
      terminal,
      readSignalTraderEnvBootstrapConfig({} as NodeJS.ProcessEnv),
    );
    await expect(
      deps.liveCapabilityRegistry.resolve({
        observer_backend: DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND,
        runtime: createLiveRuntime(),
      }),
    ).resolves.toMatchObject({
      key: DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND,
      evidence_source: expect.stringContaining('#terminal:vex-terminal'),
    });

    const missingVexTerminal = {
      client: { requestForResponseData: jest.fn() },
      terminalInfos: [
        {
          terminal_id: 'plain-terminal',
          serviceInfo: {
            submit: createAccountBoundServiceInfo('SubmitOrder', 'svc.submit'),
            cancel: createAccountBoundServiceInfo('CancelOrder', 'svc.cancel'),
            pending: createAccountBoundServiceInfo('QueryPendingOrders', 'svc.pending'),
            account: createAccountBoundServiceInfo('QueryAccountInfo', 'svc.account'),
          },
        },
      ],
    } as any;
    const unverifiedDeps = createVexAccountBoundLiveDeps(
      missingVexTerminal,
      readSignalTraderEnvBootstrapConfig({} as NodeJS.ProcessEnv),
    );
    await expect(
      unverifiedDeps.liveCapabilityRegistry.resolve({
        observer_backend: DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND,
        runtime: createLiveRuntime(),
      }),
    ).resolves.toBeUndefined();
  });
});
