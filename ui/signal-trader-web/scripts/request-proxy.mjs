const MAX_PROXY_BODY_BYTES = 1_048_576;
const MAX_RUNTIME_CONFIRMATION_BYTES = 256;

const readBody = async (req) => {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const normalized = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    total += normalized.length;
    if (total > MAX_PROXY_BODY_BYTES) {
      throw new Error('PROXY_REQUEST_BODY_TOO_LARGE');
    }
    chunks.push(normalized);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const sendJson = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(data));
};

const sendNdjsonResponse = (res, code, message) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(`${JSON.stringify({ res: { code, message } })}\n`);
};

const normalizeHeader = (value) => {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
};

const resolveCapability = (runtime, capabilities) =>
  capabilities.find(
    (item) => item?.observer_backend === runtime?.observer_backend || item?.key === runtime?.observer_backend,
  );

const inferRiskTier = (config, runtime, capability) => {
  if (!runtime) return 'live';
  const isPaperRuntime = runtime.execution_mode === 'paper' && runtime.observer_backend === 'paper_simulated';
  if (config.envProfile === 'paper' && isPaperRuntime) return 'paper';
  if (config.envProfile === 'dummy-live' && runtime.execution_mode === 'live' && capability)
    return 'dummy-live';
  if (config.envProfile === 'live' && runtime.execution_mode === 'live' && capability) return 'live';
  return 'live';
};

const callHost = async (config, method, req) => {
  const response = await fetch(new URL('/request', config.hostOrigin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.hostToken ? { host_token: config.hostToken } : {}),
    },
    body: JSON.stringify({ method, req }),
  });
  if (!response.ok) {
    throw new Error(`${method}: HTTP_${response.status}`);
  }
  const raw = await response.text();
  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    throw new Error(`${method}: EMPTY_RESPONSE`);
  }
  const payload = JSON.parse(lines[lines.length - 1]);
  if (payload?.res?.code !== 0) {
    throw new Error(`${method}: ${payload?.res?.message || 'UNKNOWN_ERROR'}`);
  }
  return payload.res.data;
};

const validateSubmitRequest = async (config, reqMsg, headers) => {
  if (config.enableMutation !== true) {
    return { code: 403, message: 'PROXY_MUTATION_DISABLED' };
  }
  const runtimeId = reqMsg?.req?.runtime_id;
  if (typeof runtimeId !== 'string' || runtimeId.trim() === '') {
    return { code: 400, message: 'RUNTIME_ID_REQUIRED' };
  }

  const [runtimeConfigs, capabilities, health] = await Promise.all([
    callHost(config, 'SignalTrader/ListRuntimeConfig', {}),
    callHost(config, 'SignalTrader/ListLiveCapabilities', {}),
    callHost(config, 'SignalTrader/GetRuntimeHealth', { runtime_id: runtimeId }),
  ]);

  const runtime = (runtimeConfigs || []).find((item) => item?.runtime_id === runtimeId);
  if (!runtime) {
    return { code: 404, message: 'RUNTIME_NOT_FOUND' };
  }

  const capability = resolveCapability(runtime, capabilities || []);
  const tier = inferRiskTier(config, runtime, capability);
  const isPaper = tier === 'paper';

  const expectedPaper = runtime.execution_mode === 'paper' && runtime.observer_backend === 'paper_simulated';
  if (config.envProfile === 'paper' && !expectedPaper) {
    return { code: 409, message: 'PROXY_PROFILE_RUNTIME_CONFLICT' };
  }
  if (!isPaper && runtime.execution_mode !== 'live') {
    return { code: 409, message: 'PROXY_RUNTIME_NOT_LIVE' };
  }
  if (!isPaper && !capability?.supports_submit) {
    return { code: 409, message: 'PROXY_CAPABILITY_DENIED' };
  }
  if (health?.status !== 'normal' || health?.lock_reason) {
    return { code: 409, message: 'PROXY_HEALTH_NOT_READY' };
  }
  if (!isPaper) {
    const confirmation = normalizeHeader(headers['x-runtime-confirmation']);
    if (!confirmation || confirmation.length > MAX_RUNTIME_CONFIRMATION_BYTES || confirmation !== runtimeId) {
      return { code: 409, message: 'PROXY_RUNTIME_CONFIRMATION_REQUIRED' };
    }
    const snapshotFresh = health?.last_account_snapshot_status === 'fresh';
    const reconciliationThreshold = Math.max(Number(runtime.reconciliation_interval_ms || 0) * 3, 30_000);
    const reconciliationFresh =
      typeof health?.last_matched_reconciliation_at_ms === 'number' &&
      Date.now() - health.last_matched_reconciliation_at_ms <= reconciliationThreshold;
    if (!snapshotFresh || !reconciliationFresh) {
      return { code: 409, message: 'PROXY_FRESHNESS_NOT_READY' };
    }
  }

  return null;
};

export const toProxyConfig = (input) => ({
  envProfile: input.SIGNAL_TRADER_ENV_PROFILE || 'paper',
  hostOrigin: input.SIGNAL_TRADER_HOST_ORIGIN || 'http://127.0.0.1:8888',
  hostToken: input.HOST_TOKEN || '',
  enableMutation: input.SIGNAL_TRADER_ENABLE_MUTATION === '1',
});

export const handleProxyRequest = async (req, res, config) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  let rawBody;
  try {
    rawBody = await readBody(req);
  } catch (error) {
    sendNdjsonResponse(res, 413, error instanceof Error ? error.message : String(error));
    return;
  }
  let reqMsg;
  try {
    reqMsg = JSON.parse(rawBody);
  } catch {
    sendNdjsonResponse(res, 400, 'INVALID_JSON');
    return;
  }

  if (!reqMsg?.method || !Object.prototype.hasOwnProperty.call(reqMsg, 'req')) {
    sendNdjsonResponse(res, 400, 'INVALID_REQUEST');
    return;
  }

  if (reqMsg.method === 'SignalTrader/SubmitSignal') {
    try {
      const validation = await validateSubmitRequest(config, reqMsg, req.headers);
      if (validation) {
        sendNdjsonResponse(res, validation.code, validation.message);
        return;
      }
    } catch (error) {
      sendNdjsonResponse(res, 500, error instanceof Error ? error.message : String(error));
      return;
    }
  }

  const upstream = await fetch(new URL('/request', config.hostOrigin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.hostToken ? { host_token: config.hostToken } : {}),
    },
    body: JSON.stringify({ method: reqMsg.method, req: reqMsg.req }),
  });
  const text = await upstream.text();
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/x-ndjson; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(text);
};
