import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { parse } from 'toml';
import { generateDefaultToml } from '../../config/defaultConfig';
import type { YuanCtlConfig } from '../../config/types';
import { createError } from '../../cli/error';
import type { YuanctlCommandResult } from '../../cli/output';
import type { YuanctlResolvedCommand, YuanctlStaticRegistryModule } from '../../cli/static-registry';
import type { YuanctlRuntimeContext } from '../../cli/runtime-context';

const readConfigDocument = (context: YuanctlRuntimeContext): YuanCtlConfig => {
  if (!existsSync(context.configPath)) {
    throw createError('E_CONFIG_NOT_FOUND', 'config', 'Config not found. Run "yuanctl config init" first.');
  }
  try {
    return parse(readFileSync(context.configPath, 'utf-8')) as YuanCtlConfig;
  } catch {
    throw createError('E_CONFIG_INVALID', 'config', 'Invalid configuration file');
  }
};

const ensureConfigDocument = async (context: YuanctlRuntimeContext): Promise<YuanCtlConfig> => {
  if (!existsSync(context.configPath)) {
    await mkdir(dirname(context.configPath), { recursive: true });
    saveConfigDocument(context, parse(generateDefaultToml()) as YuanCtlConfig);
  }
  return readConfigDocument(context);
};

const serializeConfig = (config: YuanCtlConfig): string => {
  const lines: string[] = [];
  if (config.current_context) {
    lines.push(`current_context = ${JSON.stringify(config.current_context)}`);
    lines.push('');
  }

  for (const [name, host] of Object.entries(config.hosts ?? {})) {
    lines.push(`[hosts.${name}]`);
    lines.push(`host_url = ${JSON.stringify(host.host_url)}`);
    if (host.terminal_id) lines.push(`terminal_id = ${JSON.stringify(host.terminal_id)}`);
    if (host.tls_verify !== undefined) lines.push(`tls_verify = ${host.tls_verify ? 'true' : 'false'}`);
    if (host.connect_timeout_ms !== undefined) lines.push(`connect_timeout_ms = ${host.connect_timeout_ms}`);
    if (host.reconnect_delay_ms !== undefined) lines.push(`reconnect_delay_ms = ${host.reconnect_delay_ms}`);
    lines.push('');
  }

  for (const [name, value] of Object.entries(config.contexts ?? {})) {
    lines.push(`[contexts.${name}]`);
    lines.push(`host = ${JSON.stringify(value.host)}`);
    if (value.default_node_unit) lines.push(`default_node_unit = ${JSON.stringify(value.default_node_unit)}`);
    if (value.terminal_id) lines.push(`terminal_id = ${JSON.stringify(value.terminal_id)}`);
    lines.push('');
  }

  return lines.join('\n');
};

const assertSafeConfigKey = (type: 'host' | 'context', name: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw createError(
      'E_USAGE_INVALID_ARGS',
      'usage',
      `Invalid ${type} name "${name}". Use only letters, numbers, hyphen, and underscore.`,
    );
  }
};

const assertSafeHostUrl = (hostUrl: string) => {
  let parsed: URL;
  try {
    parsed = new URL(hostUrl);
  } catch {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', `Invalid host URL "${hostUrl}"`);
  }
  if (parsed.username || parsed.password) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', 'Host URL must not include embedded credentials');
  }
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', 'Host URL must use ws:// or wss://');
  }
};

const saveConfigDocument = (context: YuanctlRuntimeContext, config: YuanCtlConfig) => {
  const content = serializeConfig(config);
  const tmpPath = `${context.configPath}.tmp`;
  writeFileSync(tmpPath, content, { encoding: 'utf-8', mode: 0o600 });
  chmodSync(tmpPath, 0o600);
  renameSync(tmpPath, context.configPath);
};

const configInit = async (
  _context: YuanctlRuntimeContext,
  command: YuanctlResolvedCommand,
): Promise<YuanctlCommandResult> => ({
  ok: true,
  kind: 'config.template',
  data: generateDefaultToml({
    hostUrl: (() => {
      const hostUrl = command.flags.hostUrl as string | undefined;
      if (hostUrl) {
        assertSafeHostUrl(hostUrl);
      }
      return hostUrl;
    })(),
    terminalId: command.flags.terminalId as string | undefined,
  }),
});

const configCurrent = async (context: YuanctlRuntimeContext): Promise<YuanctlCommandResult> => {
  const document = readConfigDocument(context);
  const contexts = document.contexts ?? {};
  const currentContextName = document.current_context ?? Object.keys(contexts)[0];
  if (!currentContextName) {
    throw createError('E_CONTEXT_NOT_FOUND', 'config', 'No current context is configured');
  }
  const currentContext = contexts[currentContextName];
  if (!currentContext) {
    throw createError('E_CONTEXT_NOT_FOUND', 'config', `Context "${currentContextName}" not found`);
  }
  const host = document.hosts?.[currentContext.host];
  if (!host) {
    throw createError('E_CONFIG_INVALID', 'config', `Host "${currentContext.host}" does not exist`);
  }
  return {
    ok: true,
    kind: 'config.current',
    data: {
      currentContextName,
      hostName: currentContext.host,
      hostUrl: host.host_url,
      terminalId: currentContext.terminal_id ?? host.terminal_id ?? '',
    },
  };
};

const configGetContexts = async (context: YuanctlRuntimeContext): Promise<YuanctlCommandResult> => {
  const document = readConfigDocument(context);
  const items = Object.entries(document.contexts ?? {}).map(([name, value]) => ({
    name,
    host: value.host,
    terminal_id: value.terminal_id ?? '',
  }));
  return { ok: true, kind: 'config.contexts', data: items };
};

const configUseContext = async (
  context: YuanctlRuntimeContext,
  command: YuanctlResolvedCommand,
): Promise<YuanctlCommandResult> => {
  const name = command.positionals[0];
  const document = readConfigDocument(context);
  if (!name || !document.contexts?.[name]) {
    throw createError('E_CONTEXT_NOT_FOUND', 'config', `Context "${name}" not found`);
  }
  document.current_context = name;
  saveConfigDocument(context, document);
  return { ok: true, kind: 'mutation.summary', data: { action: 'use-context', target: name, count: 1 } };
};

const configSetHost = async (
  context: YuanctlRuntimeContext,
  command: YuanctlResolvedCommand,
): Promise<YuanctlCommandResult> => {
  const [name, hostUrl] = command.positionals;
  if (!name || !hostUrl) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', 'config set-host requires <name> <host-url>');
  }
  assertSafeConfigKey('host', name);
  assertSafeHostUrl(hostUrl);
  const document = await ensureConfigDocument(context);
  document.hosts = document.hosts ?? {};
  document.hosts[name] = {
    ...document.hosts[name],
    host_url: hostUrl,
  };
  saveConfigDocument(context, document);
  return { ok: true, kind: 'mutation.summary', data: { action: 'set-host', target: name, count: 1 } };
};

const configSetContext = async (
  context: YuanctlRuntimeContext,
  command: YuanctlResolvedCommand,
): Promise<YuanctlCommandResult> => {
  const [name, host] = command.positionals;
  if (!name || !host) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', 'config set-context requires <name> <host>');
  }
  assertSafeConfigKey('context', name);
  assertSafeConfigKey('host', host);
  const document = await ensureConfigDocument(context);
  if (!document.hosts?.[host]) {
    throw createError('E_CONFIG_INVALID', 'config', `Host "${host}" does not exist`);
  }
  document.contexts = document.contexts ?? {};
  document.contexts[name] = {
    ...document.contexts[name],
    host,
  };
  saveConfigDocument(context, document);
  return { ok: true, kind: 'mutation.summary', data: { action: 'set-context', target: name, count: 1 } };
};

export const configRegistryModule: YuanctlStaticRegistryModule = {
  commands: [
    {
      path: ['config', 'init'],
      summary: 'Print a default config template.',
      capabilityClass: 'read-safe',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'none',
      options: [
        {
          name: 'hostUrl',
          long: '--host-url',
          type: 'string',
          description: 'Override host URL in the template.',
        },
        {
          name: 'terminalId',
          long: '--terminal-id',
          type: 'string',
          description: 'Override terminal id in the template.',
        },
      ],
      handler: configInit,
    },
    {
      path: ['config', 'current'],
      summary: 'Show the current context.',
      capabilityClass: 'read-safe',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'none',
      handler: configCurrent,
    },
    {
      path: ['config', 'get-contexts'],
      summary: 'List configured contexts.',
      capabilityClass: 'read-safe',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'none',
      handler: configGetContexts,
    },
    {
      path: ['config', 'use-context'],
      summary: 'Set the current context.',
      capabilityClass: 'write',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'none',
      args: ['name'],
      handler: configUseContext,
    },
    {
      path: ['config', 'set-host'],
      summary: 'Set a host profile URL.',
      capabilityClass: 'write',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'none',
      args: ['name', 'host-url'],
      handler: configSetHost,
    },
    {
      path: ['config', 'set-context'],
      summary: 'Set a context host binding.',
      capabilityClass: 'write',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'none',
      args: ['name', 'host'],
      handler: configSetContext,
    },
  ],
};
