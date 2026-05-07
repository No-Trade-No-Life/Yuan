#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Terminal } = require('@yuants/protocol');
const { escapeSQL, requestSQL } = require('@yuants/sql');

const terminal = Terminal.fromNodeEnv();

const ACCOUNT_ID = process.env.DUMMY_LIVE_ACCOUNT_ID?.trim() || 'acct-dummy-live';
const DEFAULT_PRODUCT_ID = process.env.DUMMY_LIVE_PRODUCT_ID?.trim() || 'BINANCE/SWAP/BTC-USDT';
const ORDER_HISTORY_TABLE = process.env.DUMMY_LIVE_ORDER_HISTORY_TABLE?.trim() || 'order';
const OUTPUT_DIR = process.env.DUMMY_LIVE_OUTPUT_DIR?.trim() || '/tmp/yuants-signal-trader-dummy-live';
const REQUEST_LOG_PATH =
  process.env.DUMMY_LIVE_REQUEST_LOG_PATH?.trim() || path.join(OUTPUT_DIR, 'requests.ndjson');
const STATE_PATH = process.env.DUMMY_LIVE_STATE_PATH?.trim() || path.join(OUTPUT_DIR, 'state.json');
const LOG_READS = ['1', 'true', 'yes'].includes(String(process.env.DUMMY_LIVE_LOG_READS || '').toLowerCase());
const BALANCE = Number(process.env.DUMMY_LIVE_BALANCE || '100000');

const ensureParent = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const loadOpenOrders = () => {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return new Map((parsed.openOrders || []).map((item) => [item.order_id, item]));
  } catch {
    return new Map();
  }
};

const openOrders = loadOpenOrders();

const persistState = () => {
  ensureParent(STATE_PATH);
  fs.writeFileSync(
    STATE_PATH,
    JSON.stringify(
      {
        account_id: ACCOUNT_ID,
        updated_at: Date.now(),
        openOrders: Array.from(openOrders.values()),
      },
      null,
      2,
    ),
  );
};

const appendRequestLog = (service, req, res) => {
  if (!LOG_READS && service !== 'SubmitOrder' && service !== 'CancelOrder') return;
  ensureParent(REQUEST_LOG_PATH);
  fs.appendFileSync(
    REQUEST_LOG_PATH,
    `${JSON.stringify({ ts: new Date().toISOString(), service, req, res })}\n`,
  );
};

const nowIso = () => new Date().toISOString();

const upsertOrderHistory = async (order) => {
  const query = `
    INSERT INTO "${ORDER_HISTORY_TABLE}" (
      order_id,
      account_id,
      product_id,
      order_type,
      volume,
      submit_at,
      created_at,
      updated_at,
      filled_at,
      traded_volume,
      traded_price,
      order_status,
      stop_loss_price,
      comment
    ) VALUES (
      ${escapeSQL(order.order_id)},
      ${escapeSQL(order.account_id)},
      ${escapeSQL(order.product_id)},
      ${escapeSQL(order.order_type)},
      ${escapeSQL(order.volume)},
      ${escapeSQL(order.submit_at)},
      ${escapeSQL(order.created_at)},
      ${escapeSQL(order.updated_at)},
      ${escapeSQL(order.filled_at)},
      ${escapeSQL(order.traded_volume)},
      ${escapeSQL(order.traded_price)},
      ${escapeSQL(order.order_status)},
      ${escapeSQL(order.stop_loss_price)},
      ${escapeSQL('dummy-live-backend')}
    )
    ON CONFLICT (account_id, order_id) DO UPDATE SET
      product_id = EXCLUDED.product_id,
      order_type = EXCLUDED.order_type,
      volume = EXCLUDED.volume,
      submit_at = EXCLUDED.submit_at,
      updated_at = EXCLUDED.updated_at,
      filled_at = EXCLUDED.filled_at,
      traded_volume = EXCLUDED.traded_volume,
      traded_price = EXCLUDED.traded_price,
      order_status = EXCLUDED.order_status,
      stop_loss_price = EXCLUDED.stop_loss_price,
      comment = EXCLUDED.comment
  `;
  await requestSQL(terminal, query);
};

const createAcceptedOrder = (req) => {
  const submittedAt = Date.now();
  const externalOrderId = req.order_id ? `dummy-${req.order_id}` : `dummy-${submittedAt}`;
  return {
    order_id: externalOrderId,
    account_id: ACCOUNT_ID,
    product_id: req.product_id || DEFAULT_PRODUCT_ID,
    order_type: req.order_type || 'MARKET',
    volume: Number(req.volume ?? (Math.abs(Number(req.size ?? 0)) || 0)),
    submit_at: submittedAt,
    created_at: nowIso(),
    updated_at: nowIso(),
    filled_at: undefined,
    traded_volume: 0,
    traded_price: undefined,
    order_status: 'ACCEPTED',
    stop_loss_price: req.stop_loss_price,
  };
};

const serviceSchema = {
  type: 'object',
  required: ['account_id'],
  properties: {
    account_id: { type: 'string', const: ACCOUNT_ID },
    force_update: { type: 'boolean' },
  },
};

terminal.server.provideService('VEX/ListCredentials', { type: 'object' }, async () => {
  const res = { code: 0, message: 'OK', data: [ACCOUNT_ID] };
  appendRequestLog('VEX/ListCredentials', {}, res.data);
  return { res };
});

terminal.server.provideService('QueryAccountInfo', serviceSchema, async (msg) => {
  const data = {
    account_id: ACCOUNT_ID,
    money: {
      currency: 'USDT',
      equity: BALANCE,
      balance: BALANCE,
      profit: 0,
      free: BALANCE,
      used: 0,
    },
    positions: [],
    updated_at: Date.now(),
  };
  appendRequestLog('QueryAccountInfo', msg.req, data);
  return { res: { code: 0, message: 'OK', data } };
});

terminal.server.provideService('QueryPendingOrders', serviceSchema, async (msg) => {
  const data = Array.from(openOrders.values());
  appendRequestLog('QueryPendingOrders', msg.req, { count: data.length });
  return { res: { code: 0, message: 'OK', data } };
});

terminal.server.provideService(
  'SubmitOrder',
  {
    ...serviceSchema,
    required: ['account_id', 'product_id'],
    properties: {
      ...serviceSchema.properties,
      product_id: { type: 'string' },
      order_id: { type: 'string' },
      order_type: { type: 'string' },
      volume: { type: 'number' },
      size: { type: 'string' },
      stop_loss_price: { type: 'number' },
    },
  },
  async (msg) => {
    const order = createAcceptedOrder(msg.req);
    openOrders.set(order.order_id, order);
    persistState();
    try {
      await upsertOrderHistory(order);
      const data = { order_id: order.order_id };
      appendRequestLog('SubmitOrder', msg.req, data);
      return { res: { code: 0, message: 'OK', data } };
    } catch (error) {
      openOrders.delete(order.order_id);
      persistState();
      appendRequestLog('SubmitOrder', msg.req, {
        order_id: order.order_id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);

terminal.server.provideService(
  'CancelOrder',
  {
    ...serviceSchema,
    required: ['account_id', 'order_id', 'product_id'],
    properties: {
      ...serviceSchema.properties,
      order_id: { type: 'string' },
      product_id: { type: 'string' },
      volume: { type: 'number' },
    },
  },
  async (msg) => {
    const existing = openOrders.get(msg.req.order_id);
    if (!existing) {
      appendRequestLog('CancelOrder', msg.req, { error: 'ORDER_NOT_FOUND' });
      return { res: { code: 404, message: 'ORDER_NOT_FOUND' } };
    }
    openOrders.delete(msg.req.order_id);
    persistState();
    const order = {
      ...existing,
      updated_at: nowIso(),
      filled_at: Date.now(),
      order_status: 'CANCELLED',
    };
    try {
      await upsertOrderHistory(order);
      appendRequestLog('CancelOrder', msg.req, { order_id: msg.req.order_id });
      return { res: { code: 0, message: 'OK', data: {} } };
    } catch (error) {
      openOrders.set(existing.order_id, existing);
      persistState();
      appendRequestLog('CancelOrder', msg.req, {
        order_id: msg.req.order_id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
);

const shutdown = (signal) => {
  persistState();
  console.info(`[dummy-live-backend] received ${signal}, exiting`);
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

persistState();
console.info('[dummy-live-backend] started', {
  account_id: ACCOUNT_ID,
  request_log_path: REQUEST_LOG_PATH,
  state_path: STATE_PATH,
  order_history_table: ORDER_HISTORY_TABLE,
});
