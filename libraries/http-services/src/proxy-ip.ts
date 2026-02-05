import { Terminal, type ITerminalInfo } from '@yuants/protocol';
import { formatTime, listWatchEvent, newError } from '@yuants/utils';
import { isIP } from 'net';

const DEFAULT_IP_FETCH_URL = 'https://ifconfig.me/ip';
const MISSING_IP_LOG_INTERVAL = 3_600_000;
const TRUSTED_PROXY_IP_SOURCE = 'http-services';
const PROXY_IP_WAIT_TIMEOUT_MS = 30_000;

type ProxyIpCache = {
  signature: string;
  ips: string[];
  cursor: number;
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
  for (const { terminalInfo, ip, ipSource } of candidates) {
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
