import http from 'node:http';

const port = Number(process.env.DUMMY_SIGNAL_TRADER_PORT || 8899);
const runtimeId = 'runtime-live';
const runtimeConfig = {
  runtime_id: runtimeId,
  enabled: true,
  execution_mode: 'live',
  account_id: 'acct-dummy-live',
  subscription_id: runtimeId,
  investor_id: 'investor-runtime-live',
  signal_key: 'sig-live',
  product_id: 'BINANCE/SWAP/BTC-USDT',
  vc_budget: 100,
  daily_burn_amount: 10,
  subscription_status: 'active',
  observer_backend: 'vex_account_bound_sql_order_history',
  poll_interval_ms: 1000,
  reconciliation_interval_ms: 10000,
  event_batch_size: 100,
};

const events = [
  {
    runtime_id: runtimeId,
    event_type: 'SignalReceived',
    event_offset: 1,
    event_created_at_ms: Date.now() - 30_000,
    signal_id: 'fixture-signal-1',
  },
  {
    runtime_id: runtimeId,
    event_type: 'IntentCreated',
    event_offset: 2,
    event_created_at_ms: Date.now() - 20_000,
    signal_id: 'fixture-signal-1',
  },
];

const auditItems = [
  {
    runtime_id: runtimeId,
    seq: 1,
    action: 'live_capability_validated',
    operator: 'fixture',
    created_at: new Date(Date.now() - 20_000).toISOString(),
  },
  {
    runtime_id: runtimeId,
    seq: 2,
    action: 'observer_cycle',
    operator: 'fixture',
    created_at: new Date(Date.now() - 5_000).toISOString(),
  },
];

const respond = (res, data) => {
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(`${JSON.stringify({ res: { code: 0, message: 'OK', data } })}\n`);
};

const respondError = (res, code, message) => {
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(`${JSON.stringify({ res: { code, message } })}\n`);
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    });
    res.end();
    return;
  }
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.url !== '/request' || req.method !== 'POST') {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const raw = await new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

  const { method } = JSON.parse(raw);

  switch (method) {
    case 'SignalTrader/ListRuntimeConfig':
      respond(res, [runtimeConfig]);
      return;
    case 'SignalTrader/ListLiveCapabilities':
      respond(res, [
        {
          key: 'vex_account_bound_sql_order_history',
          observer_backend: 'vex_account_bound_sql_order_history',
          supports_submit: true,
          supports_account_snapshot: true,
          evidence_source: 'fixture-dummy-live',
        },
      ]);
      return;
    case 'SignalTrader/GetRuntimeHealth':
      respond(res, {
        runtime_id: runtimeId,
        status: 'normal',
        last_account_snapshot_status: 'fresh',
        last_matched_reconciliation_at_ms: Date.now(),
        updated_at: Date.now(),
      });
      return;
    case 'SignalTrader/QueryProjection':
      respond(res, { mode: 'fixture', runtime_id: runtimeId, at: Date.now() });
      return;
    case 'SignalTrader/QueryEventStream':
      respond(res, events);
      return;
    case 'SignalTrader/QueryRuntimeAuditLog':
      respond(res, { items: auditItems });
      return;
    case 'SignalTrader/SubmitSignal':
      respondError(res, 409, 'FIXTURE_FAIL_CLOSE_EXPECTED');
      return;
    default:
      respondError(res, 404, `UNSUPPORTED_METHOD:${method}`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`dummy signal-trader fixture listening on ${port}`);
});
