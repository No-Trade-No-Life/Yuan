import { GlobalPrometheusRegistry, Terminal, type ITerminalInfo } from '@yuants/protocol';
import {
  encodePath,
  formatTime,
  listWatchEvent,
  newError,
  tokenBucket,
  type TokenBucketOptions,
} from '@yuants/utils';
import { isIP } from 'net';

const DEFAULT_IP_FETCH_URL = 'https://ifconfig.me/ip';
const MISSING_IP_LOG_INTERVAL = 3_600_000;
const TRUSTED_PROXY_IP_SOURCE = 'http-services';
const TRUSTED_PROXY_TERMINAL_IDS_ENV = 'TRUSTED_HTTP_PROXY_TERMINAL_IDS';
const PROXY_IP_WAIT_TIMEOUT_MS = 30_000;
const BucketOptionsConflictTotal = GlobalPrometheusRegistry.counter('bucket_options_conflict_total', '');
const MAX_BASE_KEY_CURSOR_STATES = 1024;
const DEFAULT_BUCKET_OPTIONS_FINGERPRINT_MAX_SIZE = 10_000;
const DEFAULT_BUCKET_OPTIONS_FINGERPRINT_TTL_MS = 86_400_000;

type BucketOptionsFingerprintState = {
  fingerprint: string;
  updatedAt: number;
};

type HTTPProxyTarget = {
  terminalId: string;
  ip: string;
};

const parseBoundedPositiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const BUCKET_OPTIONS_FINGERPRINT_MAX_SIZE = parseBoundedPositiveInteger(
  process.env.BUCKET_OPTIONS_FINGERPRINT_MAX_SIZE,
  DEFAULT_BUCKET_OPTIONS_FINGERPRINT_MAX_SIZE,
);
const BUCKET_OPTIONS_FINGERPRINT_TTL_MS = parseBoundedPositiveInteger(
  process.env.BUCKET_OPTIONS_FINGERPRINT_TTL_MS,
  DEFAULT_BUCKET_OPTIONS_FINGERPRINT_TTL_MS,
);

const bucketOptionsFingerprintByKey = new Map<string, BucketOptionsFingerprintState>();

let trustedProxyTerminalIdsCache = {
  raw: '',
  ids: new Set<string>(),
};

const getTrustedProxyTerminalIds = (): Set<string> => {
  const raw = (process.env[TRUSTED_PROXY_TERMINAL_IDS_ENV] ?? '').trim();
  if (raw === trustedProxyTerminalIdsCache.raw) {
    return trustedProxyTerminalIdsCache.ids;
  }
  const ids = new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );
  trustedProxyTerminalIdsCache = { raw, ids };
  return ids;
};

const cleanupBucketOptionsFingerprints = (now: number): void => {
  if (bucketOptionsFingerprintByKey.size > 0) {
    for (const [bucketKey, state] of bucketOptionsFingerprintByKey) {
      if (now - state.updatedAt > BUCKET_OPTIONS_FINGERPRINT_TTL_MS) {
        bucketOptionsFingerprintByKey.delete(bucketKey);
      }
    }
  }

  while (bucketOptionsFingerprintByKey.size > BUCKET_OPTIONS_FINGERPRINT_MAX_SIZE) {
    const oldestKey = bucketOptionsFingerprintByKey.keys().next().value;
    if (!oldestKey) break;
    bucketOptionsFingerprintByKey.delete(oldestKey);
  }
};

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
};

const isSemaphoreInsufficientPermsError = (error: unknown): boolean => {
  if (!error) return false;
  if (typeof error === 'string') {
    return error.includes('SEMAPHORE_INSUFFICIENT_PERMS');
  }
  if (error instanceof Error) {
    if (error.message.includes('SEMAPHORE_INSUFFICIENT_PERMS')) return true;
    return isSemaphoreInsufficientPermsError((error as Error & { cause?: unknown }).cause);
  }
  if (typeof error === 'object' && 'cause' in error) {
    return isSemaphoreInsufficientPermsError((error as { cause?: unknown }).cause);
  }
  return false;
};

const getRoundRobinStartIndex = (terminal: Terminal, baseKey: string, size: number): number => {
  if (size <= 0) return 0;
  const cache = getCache(terminal.terminal_id);
  if (!cache.cursorByBaseKey.has(baseKey) && cache.cursorByBaseKey.size >= MAX_BASE_KEY_CURSOR_STATES) {
    const oldestBaseKey = cache.cursorByBaseKey.keys().next().value;
    if (oldestBaseKey) {
      cache.cursorByBaseKey.delete(oldestBaseKey);
    }
  }
  const cursor = cache.cursorByBaseKey.get(baseKey) ?? 0;
  const index = cursor % size;
  cache.cursorByBaseKey.set(baseKey, (index + 1) % size);
  return index;
};

const getRoundRobinOrderedIps = (terminal: Terminal, baseKey: string, ips: string[]): string[] => {
  if (!ips.length) return ips;
  const index = getRoundRobinStartIndex(terminal, baseKey, ips.length);
  return [...ips.slice(index), ...ips.slice(0, index)];
};

const getRoundRobinOrderedTargets = (
  terminal: Terminal,
  baseKey: string,
  targets: HTTPProxyTarget[],
): HTTPProxyTarget[] => {
  if (!targets.length) return targets;
  const index = getRoundRobinStartIndex(terminal, baseKey, targets.length);
  return [...targets.slice(index), ...targets.slice(0, index)];
};

const ensureBucketOptionsConsistent = (
  baseKey: string,
  bucketKey: string,
  options: TokenBucketOptions,
): void => {
  const now = Date.now();
  cleanupBucketOptionsFingerprints(now);

  const fingerprint = stableStringify(options);
  const existing = bucketOptionsFingerprintByKey.get(bucketKey);
  if (existing && existing.fingerprint !== fingerprint) {
    BucketOptionsConflictTotal.labels({ base_key: baseKey, bucket_key: bucketKey }).inc();
    throw newError('E_BUCKET_OPTIONS_CONFLICT', {
      stage: 'acquire',
      reason: 'bucket_options_conflict',
      base_key: baseKey,
      bucket_key: bucketKey,
    });
  }
  if (existing) {
    existing.updatedAt = now;
  } else {
    bucketOptionsFingerprintByKey.set(bucketKey, {
      fingerprint,
      updatedAt: now,
    });
  }
};

/**
 * @public
 */
export type AcquireProxyBucketInput = {
  baseKey: string;
  weight: number;
  terminal: Terminal;
  getBucketOptions: (baseKey: string) => TokenBucketOptions;
};

/**
 * @public
 */
export type AcquireProxyBucketResult = {
  ip: string;
  terminalId: string;
  bucketKey: string;
};

const listTrustedHTTPProxyTargetsSnapshot = (terminal: Terminal): HTTPProxyTarget[] => {
  const trustedProxyTerminalIds = getTrustedProxyTerminalIds();
  if (!trustedProxyTerminalIds.size) return [];

  return terminal.terminalInfos
    .filter((terminalInfo) => isHttpProxyTerminal(terminalInfo))
    .map((terminalInfo) => ({
      terminalInfo,
      ip: normalizeIp(terminalInfo.tags?.ip),
      ipSource: terminalInfo.tags?.ip_source,
    }))
    .filter(
      ({ terminalInfo, ip, ipSource }) =>
        trustedProxyTerminalIds.has(terminalInfo.terminal_id) &&
        ipSource === TRUSTED_PROXY_IP_SOURCE &&
        ip.length > 0,
    )
    .sort((a, b) => a.terminalInfo.terminal_id.localeCompare(b.terminalInfo.terminal_id))
    .map(({ terminalInfo, ip }) => ({
      terminalId: terminalInfo.terminal_id,
      ip,
    }));
};

/**
 * @public
 */
export const acquireProxyBucket = (input: AcquireProxyBucketInput): AcquireProxyBucketResult => {
  const { baseKey, weight, terminal, getBucketOptions } = input;
  if (typeof getBucketOptions !== 'function') {
    throw newError('E_BUCKET_OPTIONS_CONFLICT', {
      stage: 'acquire',
      reason: 'missing_getBucketOptions',
      base_key: baseKey,
    });
  }
  const bucketOptions = getBucketOptions(baseKey);
  if (!bucketOptions) {
    throw newError('E_BUCKET_OPTIONS_CONFLICT', {
      stage: 'acquire',
      reason: 'missing_bucket_options',
      base_key: baseKey,
    });
  }

  const targets = listTrustedHTTPProxyTargetsSnapshot(terminal);
  if (!targets.length) {
    throw newError('E_PROXY_TARGET_NOT_FOUND', {
      stage: 'pool',
      reason: 'empty_pool',
      base_key: baseKey,
      terminal_id: terminal.terminal_id,
    });
  }

  const orderedTargets = getRoundRobinOrderedTargets(terminal, baseKey, targets);
  const seenBucketKeys = new Set<string>();
  const candidates = orderedTargets
    .map((target) => {
      const bucketKey = encodePath([baseKey, target.ip]);
      if (seenBucketKeys.has(bucketKey)) return undefined;
      seenBucketKeys.add(bucketKey);

      ensureBucketOptionsConsistent(baseKey, bucketKey, bucketOptions);
      const bucket = tokenBucket(bucketKey, bucketOptions);
      return {
        target,
        bucketKey,
        bucket,
        available: bucket.read(),
      };
    })
    .filter((candidate): candidate is Exclude<typeof candidate, undefined> => candidate !== undefined);
  const preferred = candidates.filter((candidate) => candidate.available >= weight);
  const fallback = candidates.filter((candidate) => candidate.available < weight);

  let lastError: unknown;
  for (const candidate of [...preferred, ...fallback]) {
    try {
      candidate.bucket.acquireSync(weight);
      return {
        ip: candidate.target.ip,
        terminalId: candidate.target.terminalId,
        bucketKey: candidate.bucketKey,
      };
    } catch (error) {
      lastError = error;
      if (isSemaphoreInsufficientPermsError(error)) {
        continue;
      }
      throw newError(
        'E_PROXY_ACQUIRE_INTERNAL_ERROR',
        {
          stage: 'acquire',
          reason: 'unexpected_acquire_error',
          base_key: baseKey,
          bucket_key: candidate.bucketKey,
          terminal_id: candidate.target.terminalId,
          ip: candidate.target.ip,
          weight,
        },
        error,
      );
    }
  }

  throw newError(
    'E_PROXY_BUCKET_EXHAUSTED',
    {
      stage: 'acquire',
      reason: 'all_candidates_failed',
      base_key: baseKey,
      weight,
      candidate_count: candidates.length,
    },
    lastError,
  );
};

type ProxyIpCache = {
  signature: string;
  ips: string[];
  cursor: number;
  cursorByBaseKey: Map<string, number>;
  lastMissingIpLogAt: Map<string, number>;
  lastTimeoutLogAt: number;
  subscription?: { unsubscribe: () => void };
  disposeBound: boolean;
  ready: boolean;
};

const proxyIpCachesByTerminalId = new Map<string, ProxyIpCache>();

const getCache = (terminalId: string): ProxyIpCache => {
  let cache = proxyIpCachesByTerminalId.get(terminalId);
  if (!cache) {
    cache = {
      signature: '',
      ips: [],
      cursor: 0,
      cursorByBaseKey: new Map(),
      lastMissingIpLogAt: new Map(),
      lastTimeoutLogAt: 0,
      disposeBound: false,
      ready: false,
    };
    proxyIpCachesByTerminalId.set(terminalId, cache);
  }
  return cache;
};

const normalizeIp = (value?: string): string => {
  if (!value) return '';
  const ip = value.trim();
  if (!ip) return '';
  return isIP(ip) ? ip : '';
};

const normalizeHttpsUrl = (value?: string): string => {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
};

/**
 * @public
 */
export const computeAndInjectProxyIp = async (
  terminal: Terminal,
  options?: { proxyIp?: string; fetchUrl?: string },
): Promise<string> => {
  const tags = (terminal.terminalInfo.tags ??= {});
  const currentIp = normalizeIp(tags.ip);
  let ip = normalizeIp(options?.proxyIp ?? process.env.PROXY_IP);

  if (!ip) {
    const fetchUrl = normalizeHttpsUrl(
      options?.fetchUrl ?? process.env.PROXY_IP_FETCH_URL ?? DEFAULT_IP_FETCH_URL,
    );
    if (!fetchUrl) {
      console.info(formatTime(Date.now()), '[http-services] proxy ip fetch url must be https');
    } else {
      try {
        const response = await fetch(fetchUrl);
        const text = await response.text();
        ip = normalizeIp(text);
      } catch (error) {
        console.info(formatTime(Date.now()), '[http-services] failed to fetch public IP:', error);
      }
    }
  }

  if (!ip) {
    console.info(formatTime(Date.now()), '[http-services] proxy ip is empty, skip inject');
    return currentIp;
  }

  if (ip !== currentIp || tags.ip_source !== TRUSTED_PROXY_IP_SOURCE) {
    tags.ip = ip;
    tags.ip_source = TRUSTED_PROXY_IP_SOURCE;
    terminal.terminalInfoUpdated$.next();
  }
  return ip;
};

/**
 * @public
 */
export const listHTTPProxyIps = (terminal: Terminal): string[] => {
  const cache = getCache(terminal.terminal_id);
  if (!terminal.terminalInfos$ || typeof terminal.terminalInfos$.pipe !== 'function') {
    bindDispose(terminal, cache);
    rebuildProxyIpCache(terminal, cache);
    return cache.ips;
  }
  ensureProxyIpWatch(terminal, cache);
  if (!cache.ready) {
    rebuildProxyIpCache(terminal, cache);
  }
  return cache.ips;
};

/**
 * @public
 */
export const selectHTTPProxyIpRoundRobin = (terminal: Terminal): string => {
  const cache = getCache(terminal.terminal_id);
  const ips = listHTTPProxyIps(terminal);
  if (!ips.length) {
    throw newError('E_PROXY_TARGET_NOT_FOUND', { reason: 'Proxy IP pool empty' });
  }
  const index = cache.cursor % ips.length;
  cache.cursor = (index + 1) % ips.length;
  return ips[index];
};

/**
 * @public
 */
export const waitForHTTPProxyIps = (terminal: Terminal): Promise<string[]> => {
  const terminalId = terminal.terminal_id || 'unknown';
  const ips = listHTTPProxyIps(terminal);
  if (ips.length) return Promise.resolve(ips);
  if (!terminal.terminalInfos$ || typeof terminal.terminalInfos$.subscribe !== 'function') {
    throw newError('E_PROXY_TARGET_NOT_FOUND', {
      reason: 'empty_pool',
      terminal_id: terminalId,
      timeoutMs: PROXY_IP_WAIT_TIMEOUT_MS,
    });
  }
  const cache = getCache(terminalId);
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
    const timeoutId = setTimeout(() => {
      const now = Date.now();
      if (now - cache.lastTimeoutLogAt > MISSING_IP_LOG_INTERVAL) {
        cache.lastTimeoutLogAt = now;
        console.info(formatTime(Date.now()), '[http-services] proxy ip wait timeout', {
          terminal_id: terminalId,
          timeoutMs: PROXY_IP_WAIT_TIMEOUT_MS,
        });
      }
      cleanup();
      reject(
        newError('E_PROXY_TARGET_NOT_FOUND', {
          reason: 'timeout',
          terminal_id: terminalId,
          timeoutMs: PROXY_IP_WAIT_TIMEOUT_MS,
        }),
      );
    }, PROXY_IP_WAIT_TIMEOUT_MS);
    const subscription = terminal.terminalInfos$.subscribe(() => {
      const nextIps = listHTTPProxyIps(terminal);
      if (!nextIps.length) return;
      cleanup();
      resolve(nextIps);
    });
  });
};

/**
 * @public
 */
export const selectHTTPProxyIpRoundRobinAsync = async (terminal: Terminal): Promise<string> => {
  const terminalId = terminal.terminal_id || 'unknown';
  const cache = getCache(terminalId);
  const ips = await waitForHTTPProxyIps(terminal);
  const index = cache.cursor % ips.length;
  cache.cursor = (index + 1) % ips.length;
  return ips[index];
};

const isHttpProxyTerminal = (terminalInfo?: ITerminalInfo): boolean => {
  if (!terminalInfo) return false;
  return Object.values(terminalInfo.serviceInfo || {}).some(
    (serviceInfo) => serviceInfo.method === 'HTTPProxy',
  );
};

const isSameProxyTerminal = (a: ITerminalInfo, b: ITerminalInfo): boolean => {
  const aIsProxy = isHttpProxyTerminal(a);
  const bIsProxy = isHttpProxyTerminal(b);
  if (aIsProxy !== bIsProxy) return false;
  if (!aIsProxy) return true;
  return (
    normalizeIp(a.tags?.ip) === normalizeIp(b.tags?.ip) &&
    (a.tags?.ip_source ?? '') === (b.tags?.ip_source ?? '')
  );
};

const shouldRefreshFromEvents = (
  events: Array<[ITerminalInfo | undefined, ITerminalInfo | undefined]>,
): boolean =>
  events.some(([oldInfo, newInfo]) => isHttpProxyTerminal(oldInfo) || isHttpProxyTerminal(newInfo));

const rebuildProxyIpCache = (terminal: Terminal, cache: ProxyIpCache) => {
  const trustedProxyTerminalIds = getTrustedProxyTerminalIds();
  const candidates = terminal.terminalInfos
    .filter((terminalInfo) => isHttpProxyTerminal(terminalInfo))
    .map((terminalInfo) => ({
      terminalInfo,
      ip: normalizeIp(terminalInfo.tags?.ip),
      ipSource: terminalInfo.tags?.ip_source,
    }))
    .sort((a, b) => a.terminalInfo.terminal_id.localeCompare(b.terminalInfo.terminal_id));

  const signature = candidates
    .map(({ terminalInfo, ip, ipSource }) => `${terminalInfo.terminal_id}:${ip}:${ipSource ?? ''}`)
    .join('|');
  if (signature === cache.signature) {
    cache.ready = true;
    return;
  }

  const nextIps: string[] = [];
  const now = Date.now();
  if (trustedProxyTerminalIds.size === 0) {
    const lastLoggedAt = cache.lastMissingIpLogAt.get('__trusted_proxy_terminal_ids_missing__') ?? 0;
    if (now - lastLoggedAt > MISSING_IP_LOG_INTERVAL) {
      cache.lastMissingIpLogAt.set('__trusted_proxy_terminal_ids_missing__', now);
      console.info(
        formatTime(Date.now()),
        '[http-services] TRUSTED_HTTP_PROXY_TERMINAL_IDS is empty, deny all proxy terminals',
      );
    }
  }
  for (const { terminalInfo, ip, ipSource } of candidates) {
    if (!trustedProxyTerminalIds.has(terminalInfo.terminal_id)) {
      const lastLoggedAt =
        cache.lastMissingIpLogAt.get(`__untrusted_terminal__:${terminalInfo.terminal_id}`) ?? 0;
      if (now - lastLoggedAt > MISSING_IP_LOG_INTERVAL) {
        cache.lastMissingIpLogAt.set(`__untrusted_terminal__:${terminalInfo.terminal_id}`, now);
        console.info(
          formatTime(Date.now()),
          '[http-services] http-proxy terminal not in trusted allowlist',
          terminalInfo.terminal_id,
        );
      }
      continue;
    }

    if (ip && ipSource === TRUSTED_PROXY_IP_SOURCE) {
      nextIps.push(ip);
      continue;
    }
    const lastLoggedAt = cache.lastMissingIpLogAt.get(terminalInfo.terminal_id) ?? 0;
    if (now - lastLoggedAt > MISSING_IP_LOG_INTERVAL) {
      cache.lastMissingIpLogAt.set(terminalInfo.terminal_id, now);
      console.info(
        formatTime(Date.now()),
        ip
          ? '[http-services] http-proxy terminal ip source not trusted'
          : '[http-services] http-proxy terminal missing ip label',
        terminalInfo.terminal_id,
      );
    }
  }

  cache.signature = signature;
  cache.ips = Array.from(new Set(nextIps));
  if (cache.cursor >= cache.ips.length) {
    cache.cursor = 0;
  }
  cache.ready = true;
};

const bindDispose = (terminal: Terminal, cache: ProxyIpCache) => {
  if (cache.disposeBound || typeof terminal.dispose$?.subscribe !== 'function') return;
  cache.disposeBound = true;
  terminal.dispose$.subscribe(() => {
    cache.subscription?.unsubscribe();
    proxyIpCachesByTerminalId.delete(terminal.terminal_id);
  });
};

const ensureProxyIpWatch = (terminal: Terminal, cache: ProxyIpCache) => {
  if (cache.subscription) return;
  if (!terminal.terminalInfos$ || typeof terminal.terminalInfos$.pipe !== 'function') {
    rebuildProxyIpCache(terminal, cache);
    return;
  }
  cache.subscription = terminal.terminalInfos$
    .pipe(listWatchEvent((info) => info.terminal_id, isSameProxyTerminal))
    .subscribe((events) => {
      if (shouldRefreshFromEvents(events)) {
        rebuildProxyIpCache(terminal, cache);
      }
    });
  bindDispose(terminal, cache);
  rebuildProxyIpCache(terminal, cache);
};
