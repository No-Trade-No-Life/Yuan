import { IAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { UUID } from '@yuants/utils';
import { createSignalTraderApp } from './app';
import { getSignalTraderQuoteConfig } from './runtime/runtime-config';
import {
  SQLCheckpointRepository,
  SQLEventStore,
  SQLOrderBindingRepository,
  SQLRuntimeAuditLogRepository,
  SQLRuntimeConfigRepository,
} from './storage/repositories';
import {
  LiveExecutionVenue,
  LiveHistoryOrderRecord,
  RuntimeQuoteProvider,
  RuntimeConfigRepository,
  RuntimeObserverProvider,
  SignalTraderLiveCapabilityDescriptor,
  SignalTraderLiveCapabilityRegistry,
  SignalTraderReferencePriceLookupResult,
  SignalTraderRuntimeConfig,
  SignalTraderServicePolicy,
  SignalTraderTransferConfig,
  SignalTraderTransferDirection,
  SignalTraderTransferOrder,
  TypedCredential,
} from './types';

export const DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND = 'vex_account_bound_sql_order_history';
export const DEFAULT_VEX_ACCOUNT_BOUND_EVIDENCE_SOURCE =
  'VEX(account-bound)+QueryPendingOrders+QueryAccountInfo+SQL:"order"(leaf-managed)';
export const DEFAULT_ORDER_HISTORY_TABLE = 'order';
export const DEFAULT_SUBMIT_ORDER_SERVICE_NAME = 'SubmitOrder';
export const DEFAULT_CANCEL_ORDER_SERVICE_NAME = 'CancelOrder';
export const DEFAULT_QUERY_PENDING_ORDERS_SERVICE_NAME = 'QueryPendingOrders';
export const DEFAULT_QUERY_ACCOUNT_INFO_SERVICE_NAME = 'QueryAccountInfo';
export const DEFAULT_TRANSFER_ORDER_TABLE = 'transfer_order';
export const DEFAULT_TRANSFER_POLL_INTERVAL_MS = 1000;
export const DEFAULT_TRANSFER_TIMEOUT_MS = 60_000;
export const DEFAULT_QUOTE_TABLE = 'QUOTE';
export const DEFAULT_OPERATOR_PRINCIPAL = 'host-internal-trusted';

export interface SignalTraderEnvBootstrapConfig {
  observerBackend: string;
  evidenceSource: string;
  orderHistoryTable: string;
  submitOrderServiceName: string;
  cancelOrderServiceName: string;
  queryPendingOrdersServiceName: string;
  queryAccountInfoServiceName: string;
  transferOrderTableName: string;
  transferPollIntervalMs: number;
  transferTimeoutMs: number;
}

export interface SignalTraderLiveRouteContext {
  runtime_id: string;
  account_id: string;
  observer_backend: string;
  target_terminal_id: string;
  submit_order_service_id: string;
  cancel_order_service_id: string;
  query_pending_orders_service_id: string;
  query_account_info_service_id: string;
}

export interface VexAccountBoundRouteProof {
  target_terminal_id: string;
  submit_order_service_id: string;
  cancel_order_service_id: string;
  query_pending_orders_service_id: string;
  query_account_info_service_id: string;
}

const ROUTE_PROOF_METADATA_KEY = 'vex_account_bound_route_proof';

const DEFAULT_SIGNAL_TRADER_ENV_BOOTSTRAP_CONFIG: SignalTraderEnvBootstrapConfig = {
  observerBackend: DEFAULT_VEX_ACCOUNT_BOUND_OBSERVER_BACKEND,
  evidenceSource: DEFAULT_VEX_ACCOUNT_BOUND_EVIDENCE_SOURCE,
  orderHistoryTable: DEFAULT_ORDER_HISTORY_TABLE,
  submitOrderServiceName: DEFAULT_SUBMIT_ORDER_SERVICE_NAME,
  cancelOrderServiceName: DEFAULT_CANCEL_ORDER_SERVICE_NAME,
  queryPendingOrdersServiceName: DEFAULT_QUERY_PENDING_ORDERS_SERVICE_NAME,
  queryAccountInfoServiceName: DEFAULT_QUERY_ACCOUNT_INFO_SERVICE_NAME,
  transferOrderTableName: DEFAULT_TRANSFER_ORDER_TABLE,
  transferPollIntervalMs: DEFAULT_TRANSFER_POLL_INTERVAL_MS,
  transferTimeoutMs: DEFAULT_TRANSFER_TIMEOUT_MS,
};

export const readSignalTraderEnvBootstrapConfig = (
  _env: NodeJS.ProcessEnv = process.env,
): SignalTraderEnvBootstrapConfig => ({ ...DEFAULT_SIGNAL_TRADER_ENV_BOOTSTRAP_CONFIG });

export const createVexAccountBoundLiveCapabilityDescriptor = (
  config: Pick<SignalTraderEnvBootstrapConfig, 'observerBackend' | 'evidenceSource'>,
): SignalTraderLiveCapabilityDescriptor => ({
  key: config.observerBackend,
  supports_submit: true,
  supports_cancel_by_external_operate_order_id: true,
  supports_closed_order_history: true,
  supports_open_orders: true,
  supports_account_snapshot: true,
  supports_authorize_order_account_check: true,
  evidence_source: config.evidenceSource,
});

const normalizeClosedOrderStatus = (status?: string) => {
  switch (String(status || '').toUpperCase()) {
    case 'TRADED':
      return 'FILLED';
    case 'ACCEPTED':
      return 'ACCEPTED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'PARTIALLY_FILLED':
      return 'PARTIALLY_FILLED';
    case 'REJECTED':
      return 'REJECTED';
    case 'LIVE':
      return 'LIVE';
    case 'OPEN':
      return 'OPEN';
    default:
      return status ? String(status).toUpperCase() : undefined;
  }
};

const formatOrderHistoryTable = (tableName: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error('ORDER_HISTORY_TABLE_INVALID');
  }
  return `"${tableName}"`;
};

const formatTransferOrderTable = (tableName: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error('TRANSFER_ORDER_TABLE_INVALID');
  }
  return `"${tableName}"`;
};

const formatQuoteTable = (tableName: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error('QUOTE_TABLE_INVALID');
  }
  return `"${tableName}"`;
};

const parseQuoteNumeric = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
};

const isTransferTerminalStatus = (status: string) =>
  ['COMPLETE', 'ERROR'].includes(String(status).toUpperCase());

const mapTransferOrderRow = (row: Record<string, unknown>): SignalTraderTransferOrder => ({
  order_id: String(row.order_id),
  created_at: String(row.created_at),
  updated_at: String(row.updated_at),
  runtime_id: row.runtime_id ? String(row.runtime_id) : undefined,
  credit_account_id: String(row.credit_account_id),
  debit_account_id: String(row.debit_account_id),
  currency: String(row.currency),
  expected_amount: Number(row.expected_amount),
  status: String(row.status),
  error_message: row.error_message ? String(row.error_message) : undefined,
});

const getTransferAccounts = (
  runtime: SignalTraderRuntimeConfig,
  transfer: SignalTraderTransferConfig,
  direction: SignalTraderTransferDirection,
) =>
  direction === 'funding_to_trading'
    ? {
        credit_account_id: transfer.funding_account_id,
        debit_account_id: runtime.account_id,
      }
    : {
        credit_account_id: runtime.account_id,
        debit_account_id: transfer.funding_account_id,
      };

const getServiceInfoEntries = (terminalInfo: { serviceInfo?: Record<string, unknown> }) =>
  Object.values(terminalInfo.serviceInfo || {}) as Array<{
    method?: string;
    service_id?: string;
    schema?: { properties?: { account_id?: { const?: unknown } } };
  }>;

const resolveAccountBoundServiceForRuntime = (
  terminalInfo: { serviceInfo?: Record<string, unknown> },
  method: string,
  accountId: string,
) =>
  getServiceInfoEntries(terminalInfo).find(
    (serviceInfo) =>
      serviceInfo?.method === method && serviceInfo.schema?.properties?.account_id?.const === accountId,
  );

const resolveVerifiedAccountBoundTargets = (
  terminal: Terminal,
  config: Pick<
    SignalTraderEnvBootstrapConfig,
    | 'submitOrderServiceName'
    | 'cancelOrderServiceName'
    | 'queryPendingOrdersServiceName'
    | 'queryAccountInfoServiceName'
  >,
  accountId: string,
) => {
  for (const terminalInfo of terminal.terminalInfos || []) {
    const methods = new Set(
      getServiceInfoEntries(terminalInfo as any)
        .map((item) => item?.method)
        .filter(Boolean),
    );
    const exposesVexIdentity =
      methods.has('VEX/ListCredentials') || methods.has('VEX/ListExchangeCredential');
    if (!exposesVexIdentity) continue;
    const submitOrderService = resolveAccountBoundServiceForRuntime(
      terminalInfo as any,
      config.submitOrderServiceName,
      accountId,
    );
    const cancelOrderService = resolveAccountBoundServiceForRuntime(
      terminalInfo as any,
      config.cancelOrderServiceName,
      accountId,
    );
    const queryPendingOrdersService = resolveAccountBoundServiceForRuntime(
      terminalInfo as any,
      config.queryPendingOrdersServiceName,
      accountId,
    );
    const queryAccountInfoService = resolveAccountBoundServiceForRuntime(
      terminalInfo as any,
      config.queryAccountInfoServiceName,
      accountId,
    );
    if (
      submitOrderService?.service_id &&
      cancelOrderService?.service_id &&
      queryPendingOrdersService?.service_id &&
      queryAccountInfoService?.service_id
    ) {
      const terminalId = (terminalInfo as { terminal_id?: unknown }).terminal_id;
      if (typeof terminalId !== 'string') continue;
      return {
        target_terminal_id: terminalId,
        submit_order_service_id: submitOrderService.service_id,
        cancel_order_service_id: cancelOrderService.service_id,
        query_pending_orders_service_id: queryPendingOrdersService.service_id,
        query_account_info_service_id: queryAccountInfoService.service_id,
      };
    }
  }
  return undefined;
};

const readPersistedRouteProof = (
  runtime: SignalTraderRuntimeConfig,
): VexAccountBoundRouteProof | undefined => {
  const proof = runtime.metadata?.[ROUTE_PROOF_METADATA_KEY];
  if (!proof || typeof proof !== 'object') return undefined;
  const candidate = proof as Record<string, unknown>;
  if (
    typeof candidate.target_terminal_id !== 'string' ||
    typeof candidate.submit_order_service_id !== 'string' ||
    typeof candidate.cancel_order_service_id !== 'string' ||
    typeof candidate.query_pending_orders_service_id !== 'string' ||
    typeof candidate.query_account_info_service_id !== 'string'
  ) {
    return undefined;
  }
  return {
    target_terminal_id: candidate.target_terminal_id,
    submit_order_service_id: candidate.submit_order_service_id,
    cancel_order_service_id: candidate.cancel_order_service_id,
    query_pending_orders_service_id: candidate.query_pending_orders_service_id,
    query_account_info_service_id: candidate.query_account_info_service_id,
  };
};

const isPersistedRouteProofValid = (
  terminal: Terminal,
  config: Pick<
    SignalTraderEnvBootstrapConfig,
    | 'submitOrderServiceName'
    | 'cancelOrderServiceName'
    | 'queryPendingOrdersServiceName'
    | 'queryAccountInfoServiceName'
  >,
  runtime: SignalTraderRuntimeConfig,
  proof: VexAccountBoundRouteProof,
) => {
  const terminalInfo = (terminal.terminalInfos || []).find(
    (item) => item.terminal_id === proof.target_terminal_id,
  ) as { serviceInfo?: Record<string, unknown> } | undefined;
  if (!terminalInfo) return false;
  const methods = new Set(
    getServiceInfoEntries(terminalInfo)
      .map((item) => item?.method)
      .filter(Boolean),
  );
  const exposesVexIdentity = methods.has('VEX/ListCredentials') || methods.has('VEX/ListExchangeCredential');
  if (!exposesVexIdentity) return false;
  const matches = [
    [config.submitOrderServiceName, proof.submit_order_service_id],
    [config.cancelOrderServiceName, proof.cancel_order_service_id],
    [config.queryPendingOrdersServiceName, proof.query_pending_orders_service_id],
    [config.queryAccountInfoServiceName, proof.query_account_info_service_id],
  ] as const;
  return matches.every(([method, serviceId]) =>
    getServiceInfoEntries(terminalInfo).some(
      (serviceInfo) =>
        serviceInfo?.method === method &&
        serviceInfo?.service_id === serviceId &&
        serviceInfo.schema?.properties?.account_id?.const === runtime.account_id,
    ),
  );
};

const resolveStoredRouteProof = (
  terminal: Terminal,
  config: Pick<
    SignalTraderEnvBootstrapConfig,
    | 'submitOrderServiceName'
    | 'cancelOrderServiceName'
    | 'queryPendingOrdersServiceName'
    | 'queryAccountInfoServiceName'
  >,
  runtime: SignalTraderRuntimeConfig,
) => {
  const proof = readPersistedRouteProof(runtime);
  if (!proof) return undefined;
  if (!isPersistedRouteProofValid(terminal, config, runtime, proof)) {
    return undefined;
  }
  return proof;
};

const createVerifiedVexAccountBoundRegistry = (
  terminal: Terminal,
  config: Pick<
    SignalTraderEnvBootstrapConfig,
    | 'observerBackend'
    | 'evidenceSource'
    | 'submitOrderServiceName'
    | 'cancelOrderServiceName'
    | 'queryPendingOrdersServiceName'
    | 'queryAccountInfoServiceName'
  >,
): SignalTraderLiveCapabilityRegistry => {
  const baseDescriptor = createVexAccountBoundLiveCapabilityDescriptor(config);
  return {
    list: async () => [baseDescriptor],
    resolve: async ({ observer_backend, runtime }) => {
      if (observer_backend !== config.observerBackend) return undefined;
      if (!runtime?.account_id) return undefined;
      const proof = resolveStoredRouteProof(terminal, config, runtime);
      if (!proof) return undefined;
      return {
        ...baseDescriptor,
        evidence_source: `${config.evidenceSource}#terminal:${proof.target_terminal_id}`,
      } satisfies SignalTraderLiveCapabilityDescriptor;
    },
  };
};

export const createSignalTraderServicePolicyFromEnv = (
  _env: NodeJS.ProcessEnv = process.env,
): SignalTraderServicePolicy => {
  const allowAnonymousRead = _env.SIGNAL_TRADER_ALLOW_ANONYMOUS_READ === '1';
  const enableMutatingServices = _env.SIGNAL_TRADER_ENABLE_MUTATING_SERVICES === '1';
  const enableOperatorServices = _env.SIGNAL_TRADER_ENABLE_OPERATOR_SERVICES === '1';
  const allowTrustedMutation = _env.SIGNAL_TRADER_ASSUME_INTERNAL_TRUSTED === '1';
  return {
    allowAnonymousRead,
    enableMutatingServices,
    enableOperatorServices,
    authorizeRead: async () => allowAnonymousRead,
    authorize: async () => allowTrustedMutation,
    resolveOperatorAuditContext: async ({ request }) =>
      allowTrustedMutation
        ? {
            principal: DEFAULT_OPERATOR_PRINCIPAL,
            display_name: DEFAULT_OPERATOR_PRINCIPAL,
            source: 'apps/signal-trader/src/bootstrap-from-env.ts',
            requested_operator:
              request && typeof request === 'object' && 'operator' in request && request.operator
                ? String(request.operator)
                : undefined,
          }
        : undefined,
  };
};

export const createVexAccountBoundLiveDeps = (
  terminal: Terminal,
  config: SignalTraderEnvBootstrapConfig,
  deps: { requestSql?: typeof requestSQL } = {},
): {
  resolveLiveCredential: (
    runtime: SignalTraderRuntimeConfig,
  ) => Promise<TypedCredential<SignalTraderLiveRouteContext>>;
  liveVenue: LiveExecutionVenue<SignalTraderLiveRouteContext>;
  observerProvider: RuntimeObserverProvider;
  quoteProvider: RuntimeQuoteProvider;
  liveCapabilityDescriptor: SignalTraderLiveCapabilityDescriptor;
  liveCapabilityRegistry: SignalTraderLiveCapabilityRegistry;
} => {
  const requestSql = deps.requestSql ?? requestSQL;
  const quoteTable = formatQuoteTable(DEFAULT_QUOTE_TABLE);
  const resolveRouteProofOrThrow = (runtime: SignalTraderRuntimeConfig) => {
    const proof = resolveStoredRouteProof(terminal, config, runtime);
    if (!proof) {
      throw new Error('LIVE_VEX_ACCOUNT_BOUND_TARGET_NOT_VERIFIED');
    }
    return proof;
  };

  const loadClosedOrdersByExternalId = async (accountId: string, externalOrderIds: string[]) => {
    const dedupedIds = [...new Set(externalOrderIds.filter(Boolean))];
    if (dedupedIds.length === 0) return new Map<string, LiveHistoryOrderRecord>();
    const rows = (await requestSql(
      terminal,
      `
        SELECT DISTINCT ON (order_id) *
        FROM ${formatOrderHistoryTable(config.orderHistoryTable)}
        WHERE account_id = ${escapeSQL(accountId)}
          AND order_id IN (${dedupedIds.map((item) => escapeSQL(item)).join(', ')})
        ORDER BY order_id, updated_at DESC NULLS LAST, filled_at DESC NULLS LAST, submit_at DESC NULLS LAST
      `,
    )) as Array<Record<string, unknown>>;
    return new Map(
      rows
        .filter((item: Record<string, unknown>) => item?.order_id)
        .map((item: Record<string, unknown>) => [
          String(item.order_id),
          {
            order_id: String(item.order_id),
            account_id: String(item.account_id),
            product_id: String(item.product_id),
            order_status: normalizeClosedOrderStatus(
              item.order_status ? String(item.order_status) : undefined,
            ),
            traded_volume: item.traded_volume as string | number | undefined,
            traded_price: item.traded_price as string | number | undefined,
            filled_at: item.filled_at as string | number | undefined,
            updated_at: item.updated_at ? String(item.updated_at) : undefined,
          } satisfies LiveHistoryOrderRecord,
        ]),
    );
  };
  const transferOrderTable = formatTransferOrderTable(config.transferOrderTableName);
  const getLatestReferencePrice = async (
    runtime: SignalTraderRuntimeConfig,
  ): Promise<SignalTraderReferencePriceLookupResult> => {
    const quoteConfig = getSignalTraderQuoteConfig(runtime);
    const datasourceFilter = quoteConfig?.datasource_id
      ? `AND datasource_id = ${escapeSQL(quoteConfig.datasource_id)}`
      : '';
    const rows = await requestSql<Record<string, unknown>[]>(
      terminal,
      `SELECT datasource_id, product_id, updated_at, last_price, ask_price, bid_price
       FROM ${quoteTable}
       WHERE product_id = ${escapeSQL(runtime.product_id)}
         ${datasourceFilter}
       ORDER BY updated_at DESC
       LIMIT 2`,
    );
    if (rows.length === 0) {
      return { reason: 'QUOTE_MISSING' };
    }
    if (!quoteConfig?.datasource_id && rows.length > 1) {
      return { reason: 'QUOTE_AMBIGUOUS_DATASOURCE' };
    }
    const row = rows[0];
    const bid = parseQuoteNumeric(row.bid_price);
    const ask = parseQuoteNumeric(row.ask_price);
    const last = parseQuoteNumeric(row.last_price);
    const price = bid !== undefined && ask !== undefined ? (bid + ask) / 2 : last;
    if (price === undefined) {
      return { reason: 'QUOTE_INVALID' };
    }
    return {
      evidence: {
        product_id: String(row.product_id),
        price,
        source: bid !== undefined && ask !== undefined ? 'sql.quote.bid_ask_mid' : 'sql.quote.last_price',
        datasource_id: row.datasource_id ? String(row.datasource_id) : undefined,
        quote_updated_at: row.updated_at ? String(row.updated_at) : undefined,
      },
    };
  };
  const loadTransferOrder = async (orderId: string) => {
    const rows = await requestSql<Record<string, unknown>[]>(
      terminal,
      `SELECT * FROM ${transferOrderTable} WHERE order_id = ${escapeSQL(orderId)} LIMIT 1`,
    );
    return rows[0] ? mapTransferOrderRow(rows[0]) : undefined;
  };

  return {
    resolveLiveCredential: async (runtime) => ({
      type: 'signal_trader_live_route_context',
      payload: {
        runtime_id: runtime.runtime_id,
        account_id: runtime.account_id,
        observer_backend: runtime.observer_backend,
        ...resolveRouteProofOrThrow(runtime),
      },
    }),
    liveVenue: {
      authorizeOrder: async ({ credential }) => {
        const accountId = credential.payload.account_id;
        const accountSnapshot = (await terminal.client.requestForResponseData(
          credential.payload.query_account_info_service_id,
          {
            account_id: accountId,
            force_update: false,
          },
        )) as IAccountInfo;
        return { account_id: accountSnapshot.account_id };
      },
      submitOrder: async ({ credential, internal_order_id, product_id, size, stop_loss_price }) => {
        const accountId = credential.payload.account_id;
        const response = (await terminal.client.requestForResponseData(
          credential.payload.submit_order_service_id,
          {
            order_id: internal_order_id,
            account_id: accountId,
            product_id,
            order_type: 'MARKET',
            volume: Math.abs(Number(size)),
            size: String(size),
            stop_loss_price,
          },
        )) as { order_id?: string };
        const externalOrderId = String(response.order_id ?? '');
        if (!externalOrderId) {
          throw new Error('LIVE_SUBMIT_ORDER_ID_MISSING');
        }
        return {
          external_submit_order_id: externalOrderId,
          external_operate_order_id: externalOrderId,
        };
      },
      cancelOrder: async ({ credential, external_operate_order_id, product_id }) => {
        const accountId = credential.payload.account_id;
        await terminal.client.requestForResponseData(credential.payload.cancel_order_service_id, {
          order_id: external_operate_order_id,
          account_id: accountId,
          product_id,
          volume: 0,
        });
      },
      queryTradingBalance: async ({ credential }) => {
        const accountSnapshot = (await terminal.client.requestForResponseData(
          credential.payload.query_account_info_service_id,
          {
            account_id: credential.payload.account_id,
            force_update: false,
          },
        )) as IAccountInfo;
        return {
          balance: Number(accountSnapshot.money.free ?? accountSnapshot.money.balance),
          currency: accountSnapshot.money.currency,
        };
      },
      findActiveTransfer: async ({ runtime, transfer }) => {
        const rows = await requestSql<Record<string, unknown>[]>(
          terminal,
          `SELECT * FROM ${transferOrderTable}
           WHERE runtime_id = ${escapeSQL(runtime.runtime_id)}
             AND currency = ${escapeSQL(transfer.currency)}
              AND (
                (credit_account_id = ${escapeSQL(
                  transfer.funding_account_id,
                )} AND debit_account_id = ${escapeSQL(runtime.account_id)})
                OR
               (credit_account_id = ${escapeSQL(runtime.account_id)} AND debit_account_id = ${escapeSQL(
            transfer.funding_account_id,
          )})
             )
             AND status NOT IN ('COMPLETE', 'ERROR')
             ORDER BY created_at DESC, order_id DESC
             LIMIT 2`,
        );
        if (rows.length > 1) {
          throw new Error('TRANSFER_ACTIVE_ORDER_CONFLICT');
        }
        return rows[0] ? mapTransferOrderRow(rows[0]) : undefined;
      },
      submitTransfer: async ({ runtime, transfer, direction, amount }) => {
        const now = new Date().toISOString();
        const accounts = getTransferAccounts(runtime, transfer, direction);
        const order: SignalTraderTransferOrder = {
          order_id: UUID(),
          created_at: now,
          updated_at: now,
          runtime_id: runtime.runtime_id,
          currency: transfer.currency,
          expected_amount: amount,
          status: 'INIT',
          ...accounts,
        };
        await requestSql(terminal, buildInsertManyIntoTableSQL([order], config.transferOrderTableName));
        return order;
      },
      pollTransfer: async ({ order_id }) => {
        const deadline = Date.now() + config.transferTimeoutMs;
        while (Date.now() <= deadline) {
          const record = await loadTransferOrder(order_id);
          if (!record) {
            throw new Error('TRANSFER_ERROR');
          }
          if (isTransferTerminalStatus(record.status)) {
            return record;
          }
          await new Promise((resolve) => setTimeout(resolve, config.transferPollIntervalMs));
        }
        throw new Error('TRANSFER_TIMEOUT');
      },
    },
    quoteProvider: {
      getLatestReferencePrice: (runtime) => getLatestReferencePrice(runtime),
    },
    observerProvider: {
      observe: async ({ runtime, bindings }) => {
        let degradedReason: string | undefined;
        const markDegraded = (reason: string) => {
          degradedReason = degradedReason || reason;
        };
        const routeProof = resolveStoredRouteProof(terminal, config, runtime);
        if (!routeProof) {
          return {
            observations: bindings.map((binding) => ({ binding })),
            lock_reason: 'LIVE_VEX_ACCOUNT_BOUND_TARGET_NOT_VERIFIED',
          };
        }
        const externalOrderIds = bindings.map((item) => item.external_operate_order_id || '');
        const [closedOrdersResult, pendingOrdersResult, accountSnapshotResult] = await Promise.allSettled([
          loadClosedOrdersByExternalId(runtime.account_id, externalOrderIds),
          terminal.client.requestForResponseData(routeProof.query_pending_orders_service_id, {
            account_id: runtime.account_id,
            force_update: false,
          }) as Promise<IOrder[]>,
          terminal.client.requestForResponseData(routeProof.query_account_info_service_id, {
            account_id: runtime.account_id,
            force_update: false,
          }) as Promise<Pick<IAccountInfo, 'account_id' | 'money' | 'updated_at'>>,
        ]);

        const closedOrdersById =
          closedOrdersResult.status === 'fulfilled'
            ? closedOrdersResult.value
            : (markDegraded('ORDER_HISTORY_SOURCE_UNAVAILABLE'), new Map<string, LiveHistoryOrderRecord>());
        const pendingOrdersById =
          pendingOrdersResult.status === 'fulfilled'
            ? new Map(
                ((pendingOrdersResult.value || []) as IOrder[])
                  .filter((item) => item?.order_id)
                  .map((item) => [String(item.order_id), item]),
              )
            : (markDegraded('OPEN_ORDERS_SOURCE_UNAVAILABLE'), new Map<string, IOrder>());
        const accountSnapshot =
          accountSnapshotResult.status === 'fulfilled'
            ? accountSnapshotResult.value
            : (markDegraded('ACCOUNT_SNAPSHOT_SOURCE_UNAVAILABLE'), undefined);

        return {
          observations: bindings.map((binding) => {
            const externalOrderId = binding.external_operate_order_id;
            return {
              binding,
              history_order: externalOrderId ? closedOrdersById.get(externalOrderId) : undefined,
              open_order: externalOrderId ? pendingOrdersById.get(externalOrderId) : undefined,
            };
          }),
          account_snapshot: accountSnapshot,
          degraded_reason: degradedReason,
        };
      },
    },
    liveCapabilityDescriptor: createVexAccountBoundLiveCapabilityDescriptor(config),
    liveCapabilityRegistry: createVerifiedVexAccountBoundRegistry(terminal, config),
  };
};

export const createSignalTraderAppFromEnv = (
  options: {
    terminal?: Terminal;
    env?: NodeJS.ProcessEnv;
    requestSql?: typeof requestSQL;
  } = {},
) => {
  const terminal = options.terminal ?? Terminal.fromNodeEnv();
  const config = readSignalTraderEnvBootstrapConfig(options.env);
  const baseRuntimeConfigRepository = new SQLRuntimeConfigRepository(terminal);
  const runtimeConfigRepository: RuntimeConfigRepository = {
    upsert: async (runtime) => {
      const metadata = { ...(runtime.metadata ?? {}) };
      const targets = resolveVerifiedAccountBoundTargets(terminal, config, runtime.account_id);
      if (
        runtime.execution_mode === 'live' &&
        runtime.observer_backend === config.observerBackend &&
        targets
      ) {
        metadata[ROUTE_PROOF_METADATA_KEY] = targets;
      } else {
        delete metadata[ROUTE_PROOF_METADATA_KEY];
      }
      return baseRuntimeConfigRepository.upsert({
        ...runtime,
        metadata,
      });
    },
    get: (runtime_id) => baseRuntimeConfigRepository.get(runtime_id),
    list: () => baseRuntimeConfigRepository.list(),
    disable: (runtime_id) => baseRuntimeConfigRepository.disable(runtime_id),
  };
  const live = createVexAccountBoundLiveDeps(terminal, config, { requestSql: options.requestSql });
  const servicePolicy = createSignalTraderServicePolicyFromEnv();
  const app = createSignalTraderApp({
    terminal,
    repositories: {
      runtimeConfigRepository,
      eventStore: new SQLEventStore(terminal),
      orderBindingRepository: new SQLOrderBindingRepository(terminal),
      checkpointRepository: new SQLCheckpointRepository(terminal),
      auditLogRepository: new SQLRuntimeAuditLogRepository(terminal),
    },
    resolveLiveCredential: live.resolveLiveCredential,
    liveVenue: live.liveVenue,
    observerProvider: live.observerProvider,
    liveCapabilityRegistry: live.liveCapabilityRegistry,
    quoteProvider: live.quoteProvider,
    servicePolicy,
  });
  return { terminal, app, config, live };
};
