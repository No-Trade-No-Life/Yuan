#!/usr/bin/env bash

set -euo pipefail

HOST_PORT="${HOST_PORT:-8888}"

node - "$HOST_PORT" <<'NODE'
const http = require('http');

const hostPort = Number(process.argv[2]);
const hostToken = process.env.HOST_TOKEN;

const call = (method, req) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify({ method, req });
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port: hostPort,
        path: '/request',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(hostToken ? { host_token: hostToken } : {}),
        },
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          const lines = raw
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);
          if (lines.length === 0) {
            reject(new Error(`${method}: EMPTY_RESPONSE`));
            return;
          }
          const payload = JSON.parse(lines[lines.length - 1]);
          if (payload?.res?.code !== 0) {
            reject(new Error(`${method}: ${payload?.res?.message ?? 'UNKNOWN_ERROR'}`));
            return;
          }
          resolve(payload.res.data);
        });
      },
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

(async () => {
  const runtimeId = 'runtime-mock';
  const signalId = `signal-${Date.now()}`;

  const runtimeConfig = {
    runtime_id: runtimeId,
    enabled: true,
    execution_mode: 'paper',
    account_id: 'acct-mock',
    subscription_id: runtimeId,
    investor_id: 'investor-mock',
    signal_key: 'sig-mock',
    product_id: 'BTC-USDT',
    vc_budget: 100,
    daily_burn_amount: 10,
    subscription_status: 'active',
    observer_backend: 'paper_simulated',
    poll_interval_ms: 1000,
    reconciliation_interval_ms: 5000,
    event_batch_size: 100,
    metadata: {
      bootstrap: 'local-mock-smoke',
    },
  };

  const upsert = await call('SignalTrader/UpsertRuntimeConfig', runtimeConfig);
  assert(upsert.runtime_id === runtimeId, 'UpsertRuntimeConfig 返回 runtime_id 不匹配');

  const submit = await call('SignalTrader/SubmitSignal', {
    runtime_id: runtimeId,
    command: {
      command_type: 'submit_signal',
      signal_id: signalId,
      signal_key: 'sig-mock',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'manual',
      entry_price: 100,
      stop_loss_price: 90,
      metadata: {
        bootstrap: 'local-mock-smoke',
      },
    },
  });
  assert(submit.accepted === true, 'SubmitSignal 未被接受');

  const projection = await call('SignalTrader/QueryProjection', {
    runtime_id: runtimeId,
    query: {
      type: 'product',
      product_id: 'BTC-USDT',
    },
  });
  assert(Number(projection?.current_net_qty) > 0, 'QueryProjection 未返回正向仓位');

  const events = await call('SignalTrader/QueryEventStream', {
    runtime_id: runtimeId,
    query: {
      signal_id: signalId,
    },
  });
  const eventTypes = Array.isArray(events) ? events.map((item) => item.event_type) : [];
  for (const eventType of ['SignalReceived', 'OrderSubmitted', 'OrderAccepted', 'OrderFilled']) {
    assert(eventTypes.includes(eventType), `QueryEventStream 缺少 ${eventType}`);
  }

  const health = await call('SignalTrader/GetRuntimeHealth', {
    runtime_id: runtimeId,
  });
  assert(health.runtime_id === runtimeId, 'GetRuntimeHealth 返回 runtime_id 不匹配');
  assert(health.status === 'normal', `GetRuntimeHealth 状态异常: ${health.status}`);

  console.log('smoke passed');
  console.log(
    JSON.stringify(
      {
        runtime_id: runtimeId,
        signal_id: signalId,
        current_net_qty: projection.current_net_qty,
        event_types: eventTypes,
        health_status: health.status,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error('smoke failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
NODE
