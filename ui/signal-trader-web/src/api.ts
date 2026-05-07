import { encodePath } from '@yuants/utils';
import type {
  AppConfig,
  AuditLogResponse,
  LiveCapabilitySummary,
  MockAccountInfo,
  PersistedEvent,
  RuntimeConfig,
  RuntimeHealth,
  SubmitSignalFormState,
  WriteResponse,
} from './types';

interface Envelope<T> {
  res?: {
    code?: number;
    message?: string;
    data?: T;
  };
}

const asError = (value: unknown) => (value instanceof Error ? value : new Error(String(value)));

export const emptyState = <T>(): { loading: boolean; data?: T; error?: string } => ({ loading: false });

export const fetchAppConfig = async (): Promise<AppConfig> => {
  const response = await fetch('/app-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`APP_CONFIG_${response.status}`);
  return response.json();
};

const request = async <T>(method: string, req: unknown, headers?: Record<string, string>): Promise<T> => {
  const response = await fetch('/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
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
  if (lines.length === 0) throw new Error(`${method}: EMPTY_RESPONSE`);
  let envelope: Envelope<T> | undefined;
  for (const line of lines) {
    envelope = JSON.parse(line) as Envelope<T>;
  }
  if (envelope?.res?.code !== 0) {
    throw new Error(`${method}: ${envelope?.res?.message ?? 'UNKNOWN_ERROR'}`);
  }
  return envelope.res?.data as T;
};

export const signalTraderApi = {
  listRuntimeConfig: () => request<RuntimeConfig[]>('SignalTrader/ListRuntimeConfig', {}),
  listLiveCapabilities: () => request<LiveCapabilitySummary[]>('SignalTrader/ListLiveCapabilities', {}),
  getRuntimeHealth: (runtimeId: string) =>
    request<RuntimeHealth>('SignalTrader/GetRuntimeHealth', { runtime_id: runtimeId }),
  getMockAccountInfo: (runtimeId: string) =>
    request<MockAccountInfo>('SignalTrader/GetMockAccountInfo', { runtime_id: runtimeId }),
  queryProjection: <T = unknown>(runtimeId: string, query: unknown) =>
    request<T>('SignalTrader/QueryProjection', { runtime_id: runtimeId, query }),
  queryEventStream: (runtimeId: string, query: unknown = {}) =>
    request<PersistedEvent[]>('SignalTrader/QueryEventStream', { runtime_id: runtimeId, query }),
  queryRuntimeAuditLog: (runtimeId: string) =>
    request<AuditLogResponse>('SignalTrader/QueryRuntimeAuditLog', { runtime_id: runtimeId, limit: 40 }),
  submitSignal: (runtime: RuntimeConfig, form: SubmitSignalFormState) => {
    const parsedMetadata = normalizeMetadata(form.metadataText);
    const runtimeConfirmation = form.runtimeConfirmation.trim();
    return request<WriteResponse>(
      'SignalTrader/SubmitSignal',
      {
        runtime_id: runtime.runtime_id,
        command: {
          command_type: 'submit_signal',
          signal_id: encodePath(runtime.runtime_id, `${Date.now()}`),
          signal_key: runtime.signal_key,
          product_id: runtime.product_id,
          signal: form.signal,
          source: 'manual',
          entry_price: parseOptionalNumber(form.entryPrice),
          stop_loss_price: parseOptionalNumber(form.stopLossPrice),
          upstream_emitted_at: Date.now(),
          metadata: parsedMetadata,
        },
      },
      runtimeConfirmation ? { 'x-runtime-confirmation': runtimeConfirmation } : undefined,
    );
  },
};

export const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error('价格字段必须是数字');
  }
  return parsed;
};

export const normalizeMetadata = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw asError(new Error(`metadata 不是合法 JSON: ${asError(error).message}`));
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('metadata 必须是 JSON object');
  }
  const serialized = JSON.stringify(parsed);
  if (serialized.length > 4000) {
    throw new Error('metadata 体积不能超过 4000 字符');
  }
  return parsed as Record<string, unknown>;
};

export const formatTime = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

export const formatRelative = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return '-';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return String(value);
  const delta = Date.now() - timestamp;
  const sign = delta >= 0 ? '前' : '后';
  const abs = Math.abs(delta);
  if (abs < 1000) return '刚刚';
  if (abs < 60_000) return `${Math.round(abs / 1000)} 秒${sign}`;
  if (abs < 3_600_000) return `${Math.round(abs / 60_000)} 分钟${sign}`;
  return `${Math.round(abs / 3_600_000)} 小时${sign}`;
};

export const summarizeJson = (value: unknown) => JSON.stringify(value ?? null, null, 2);
