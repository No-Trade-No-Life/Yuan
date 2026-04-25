#!/usr/bin/env node

const { Terminal } = require('@yuants/protocol');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DEFAULT_LIVE_BACKEND = 'vex_account_bound_sql_order_history';

const readStringEnv = (name, defaultValue) => {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;
  return String(value);
};

const readNumberEnv = (name, defaultValue) => {
  const value = process.env[name];
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name}_MUST_BE_NUMBER`);
  }
  return parsed;
};

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name}_NOT_SET`);
  }
  return value;
};

const terminal = Terminal.fromNodeEnv();

const listDiscoverableTradingAccounts = () => {
  const accountIds = [];
  for (const terminalInfo of terminal.terminalInfos) {
    for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
      if (serviceInfo?.method !== 'QueryPendingOrders') continue;
      const accountId = serviceInfo.schema?.properties?.account_id?.const;
      if (typeof accountId === 'string' && accountId.trim()) {
        accountIds.push({ accountId: accountId.trim(), terminalId: terminalInfo.terminal_id });
      }
    }
  }
  return accountIds.sort((a, b) => a.accountId.localeCompare(b.accountId));
};

const waitForSignalTraderService = async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      await terminal.client.requestForResponseData('SignalTrader/ListRuntimeConfig', {});
      return;
    } catch (_) {
      await sleep(1000);
    }
  }
  throw new Error('WAIT_SIGNAL_TRADER_SERVICE_TIMEOUT');
};

const resolveAccountId = async () => {
  const explicitAccountId = process.env.SIGNAL_TRADER_ACCOUNT_ID?.trim();
  if (explicitAccountId) return explicitAccountId;

  for (let i = 0; i < 60; i += 1) {
    const discoveredAccounts = listDiscoverableTradingAccounts();
    const uniqueAccountIds = [...new Set(discoveredAccounts.map((item) => item.accountId))];
    if (uniqueAccountIds.length === 1) return uniqueAccountIds[0];
    if (uniqueAccountIds.length > 1) {
      throw new Error(
        `MULTIPLE_TRADING_ACCOUNT_IDS_DISCOVERED:${discoveredAccounts
          .map((item) => `${item.accountId}@${item.terminalId}`)
          .join(',')}`,
      );
    }
    await sleep(1000);
  }

  throw new Error('TRADING_ACCOUNT_ID_NOT_DISCOVERED');
};

const main = async () => {
  const runtimeId = readStringEnv('SIGNAL_TRADER_RUNTIME_ID', 'runtime-live');
  const signalKey = readStringEnv('SIGNAL_TRADER_SIGNAL_KEY', 'sig-live');
  const investorId = readStringEnv('SIGNAL_TRADER_INVESTOR_ID', `investor-${runtimeId}`);
  const productId = requiredEnv('SIGNAL_TRADER_PRODUCT_ID');
  const observerBackend = DEFAULT_LIVE_BACKEND;
  const accountId = await resolveAccountId();

  await waitForSignalTraderService();

  const runtimeConfig = {
    runtime_id: runtimeId,
    enabled: true,
    execution_mode: 'live',
    account_id: accountId,
    subscription_id: runtimeId,
    investor_id: investorId,
    signal_key: signalKey,
    product_id: productId,
    vc_budget: readNumberEnv('SIGNAL_TRADER_VC_BUDGET', 100),
    daily_burn_amount: readNumberEnv('SIGNAL_TRADER_DAILY_BURN_AMOUNT', 10),
    subscription_status: readStringEnv('SIGNAL_TRADER_SUBSCRIPTION_STATUS', 'active'),
    observer_backend: observerBackend,
    poll_interval_ms: readNumberEnv('SIGNAL_TRADER_POLL_INTERVAL_MS', 1000),
    reconciliation_interval_ms: readNumberEnv('SIGNAL_TRADER_RECONCILIATION_INTERVAL_MS', 10_000),
    event_batch_size: readNumberEnv('SIGNAL_TRADER_EVENT_BATCH_SIZE', 100),
    metadata: {
      bootstrap: 'local-live-seed',
      source: 'apps/signal-trader/dev/seed-live-runtime.js',
      live_route: 'vex_account_bound',
    },
  };

  const capabilities = await terminal.client.requestForResponseData('SignalTrader/ListLiveCapabilities', {});
  const matchedCapability = (capabilities || []).find(
    (item) => item?.observer_backend === observerBackend || item?.key === observerBackend,
  );
  if (!matchedCapability) {
    throw new Error(`LIVE_CAPABILITY_NOT_DECLARED:${observerBackend}`);
  }
  const upsert = await terminal.client.requestForResponseData(
    'SignalTrader/UpsertRuntimeConfig',
    runtimeConfig,
  );
  const health = await terminal.client.requestForResponseData('SignalTrader/GetRuntimeHealth', {
    runtime_id: runtimeId,
  });

  console.log(
    JSON.stringify(
      {
        runtime_id: runtimeId,
        account_id: accountId,
        product_id: productId,
        upsert,
        health,
        live_capabilities: capabilities,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error('seed-live-runtime failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    terminal.dispose();
  });
