import { hostname } from 'os';
import { existsSync, readFileSync } from 'fs';
import { parse } from 'toml';
import { DEFAULT_CONTEXT_NAME, DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_RECONNECT_DELAY_MS } from '../constants';
import { mergeSelectors } from '../utils/filters';
import { resolveConfigPath } from './paths';
import type { LoadConfigResult, ResolvedClientConfig, ResolvedHostConfig, YuanCtlConfig } from './types';

export interface LoadOptions {
  configPath?: string;
  env: NodeJS.ProcessEnv;
  overrides: {
    context?: string;
    hostUrl?: string;
    selector?: string;
    fieldSelector?: string;
  };
  readFile?: (path: string) => string;
}

const defaultTerminalId = () => `Yuanctl/${hostname()}`;

const normalizeHostConfig = (
  name: string,
  raw: YuanCtlConfig['hosts'][string],
  overrides: LoadOptions['overrides'],
): ResolvedHostConfig => {
  const hostUrl = overrides.hostUrl ?? raw.host_url;
  if (!hostUrl) {
    throw new Error(`Host "${name}" is missing required field "host_url"`);
  }
  return {
    name,
    hostUrl,
    terminalId: raw.terminal_id || defaultTerminalId(),
    tlsVerify: raw.tls_verify ?? true,
    connectTimeoutMs: raw.connect_timeout_ms ?? DEFAULT_CONNECT_TIMEOUT_MS,
    reconnectDelayMs: raw.reconnect_delay_ms ?? DEFAULT_RECONNECT_DELAY_MS,
  };
};

const ensureContext = (config: YuanCtlConfig): YuanCtlConfig => {
  if (config.contexts && Object.keys(config.contexts).length > 0) {
    return config;
  }
  const firstHostName = Object.keys(config.hosts ?? {})[0];
  if (!firstHostName) {
    return config;
  }
  return {
    ...config,
    contexts: {
      [DEFAULT_CONTEXT_NAME]: {
        host: firstHostName,
        terminal_id: config.hosts[firstHostName].terminal_id,
      },
    },
    current_context: config.current_context ?? DEFAULT_CONTEXT_NAME,
  };
};

export const loadClientConfig = (options: LoadOptions): LoadConfigResult => {
  const env = options.env;
  const configPath = options.configPath ?? resolveConfigPath(env);
  if (!existsSync(configPath)) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  const readFile = options.readFile ?? ((path: string) => readFileSync(path, 'utf-8'));
  let parsed: YuanCtlConfig;
  try {
    const text = readFile(configPath);
    parsed = parse(text) as YuanCtlConfig;
  } catch (err) {
    return { ok: false, reason: 'INVALID', error: err instanceof Error ? err : new Error(String(err)) };
  }

  if (!parsed.hosts || Object.keys(parsed.hosts).length === 0) {
    return {
      ok: false,
      reason: 'INVALID',
      error: new Error('Config missing "hosts" definition'),
    };
  }

  const configWithContexts = ensureContext(parsed);
  const contexts = configWithContexts.contexts ?? {};
  const contextFromOverride =
    options.overrides.context ||
    env.YUANCTL_CONTEXT ||
    configWithContexts.current_context ||
    DEFAULT_CONTEXT_NAME;
  const contextName = contexts[contextFromOverride] ? contextFromOverride : Object.keys(contexts)[0];
  if (!contextName || !contexts[contextName]) {
    return {
      ok: false,
      reason: 'INVALID',
      error: new Error('Unable to determine current context'),
    };
  }
  const context = contexts[contextName];
  const hostEntry = configWithContexts.hosts[context.host];
  if (!hostEntry) {
    return {
      ok: false,
      reason: 'INVALID',
      error: new Error(`Context "${contextName}" references unknown host "${context.host}"`),
    };
  }

  let hostConfig: ResolvedHostConfig;
  try {
    hostConfig = normalizeHostConfig(context.host, hostEntry, options.overrides);
  } catch (err) {
    return {
      ok: false,
      reason: 'INVALID',
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
  if (context.terminal_id) {
    hostConfig = { ...hostConfig, terminalId: context.terminal_id };
  }
  if (context.default_node_unit) {
    hostConfig = { ...hostConfig, defaultNodeUnit: context.default_node_unit };
  }

  const resolved: ResolvedClientConfig = {
    contextName,
    host: hostConfig,
    filters: mergeSelectors({
      selector: options.overrides.selector,
      fieldSelector: options.overrides.fieldSelector,
    }),
  };
  return { ok: true, value: resolved };
};
