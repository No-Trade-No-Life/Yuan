import readline from 'readline';
import { DeploymentsClient } from '../client/deploymentsClient';
import { LogsClient } from '../client/logsClient';
import { TerminalGateway } from '../client/terminalGateway';
import { loadClientConfig } from '../config/clientConfig';
import { resolveConfigPath } from '../config/paths';
import type { ResolvedClientConfig, YuanCtlConfig } from '../config/types';
import { createError } from './error';
import type { YuanctlPrinter, YuanctlOutputFormat } from './output';
import type { YuanctlResolvedCommand } from './static-registry';

export interface YuanctlIo {
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
  stderr: NodeJS.WriteStream;
  env: NodeJS.ProcessEnv;
}

export interface YuanctlConfirmRequest {
  message: string;
}

export interface YuanctlRuntimeContext {
  argv: string[];
  stdoutIsTTY: boolean;
  stderrIsTTY: boolean;
  signal: AbortSignal;
  configPath: string;
  config?: ResolvedClientConfig;
  configDocument?: YuanCtlConfig;
  currentContextName?: string;
  selectedHostProfile?: { name: string; host_url: string };
  printer: YuanctlPrinter;
  outputFormat: YuanctlOutputFormat;
  confirm: (request: YuanctlConfirmRequest) => Promise<boolean>;
  deployments?: DeploymentsClient;
  logs?: LogsClient;
  close?: () => void;
}

const createPrinter = (io: YuanctlIo): YuanctlPrinter => ({
  stdout: (text: string) => io.stdout.write(text),
  stderr: (text: string) => io.stderr.write(text),
});

const createConfirm =
  (io: YuanctlIo) =>
  async (request: YuanctlConfirmRequest): Promise<boolean> => {
    const rl = readline.createInterface({ input: io.stdin, output: io.stdout });
    const answer = await new Promise<string>((resolve) => rl.question(`${request.message} (y/N) `, resolve));
    rl.close();
    return answer.trim().toLowerCase() === 'y';
  };

const loadResolvedConfig = (command: YuanctlResolvedCommand, io: YuanctlIo) => {
  const configPath = resolveConfigPath(io.env);
  const result = loadClientConfig({
    configPath,
    env: io.env,
    overrides: {
      context: command.globalFlags.context,
      hostUrl: command.globalFlags.hostUrl,
      selector: undefined,
      fieldSelector: undefined,
    },
  });
  if (!result.ok) {
    if (result.reason === 'NOT_FOUND') {
      throw createError('E_CONFIG_NOT_FOUND', 'config', 'Config not found. Run "yuanctl config init" first.');
    }
    throw createError('E_CONFIG_INVALID', 'config', 'Invalid configuration file');
  }
  return { configPath, config: result.value };
};

export const createRuntimeContext = async (
  command: YuanctlResolvedCommand,
  io: YuanctlIo,
): Promise<YuanctlRuntimeContext> => {
  const outputFormat = command.globalFlags.output ?? 'table';
  const context: YuanctlRuntimeContext = {
    argv: command.argv,
    stdoutIsTTY: Boolean(io.stdout.isTTY),
    stderrIsTTY: Boolean(io.stderr.isTTY),
    signal: new AbortController().signal,
    configPath: resolveConfigPath(io.env),
    printer: createPrinter(io),
    outputFormat,
    confirm: createConfirm(io),
  };

  if (command.registration.runtime === 'none') {
    return context;
  }

  const resolved = loadResolvedConfig(command, io);
  context.configPath = resolved.configPath;
  context.config = resolved.config;
  context.currentContextName = resolved.config.contextName;
  context.selectedHostProfile = {
    name: resolved.config.host.name,
    host_url: resolved.config.host.hostUrl,
  };

  if (command.registration.runtime === 'config') {
    return context;
  }

  try {
    const gateway = await TerminalGateway.ensure(resolved.config.host);
    context.deployments = new DeploymentsClient(gateway);
    context.logs = new LogsClient(gateway);
    context.close = () => gateway.dispose();
    return context;
  } catch {
    throw createError('E_HOST_UNREACHABLE', 'network', 'Unable to connect to host');
  }
};

export const createPreflightContext = (
  command: YuanctlResolvedCommand,
  io: YuanctlIo,
): YuanctlRuntimeContext => ({
  argv: command.argv,
  stdoutIsTTY: Boolean(io.stdout.isTTY),
  stderrIsTTY: Boolean(io.stderr.isTTY),
  signal: new AbortController().signal,
  configPath: resolveConfigPath(io.env),
  printer: createPrinter(io),
  outputFormat: command.globalFlags.output ?? 'table',
  confirm: createConfirm(io),
});
