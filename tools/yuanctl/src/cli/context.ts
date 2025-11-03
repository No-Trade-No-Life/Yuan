import { loadClientConfig } from '../config/clientConfig';
import { resolveConfigPath } from '../config/paths';
import type { LoadConfigResult, ResolvedClientConfig } from '../config/types';
import { TerminalGateway } from '../client/terminalGateway';
import { DeploymentsClient } from '../client/deploymentsClient';
import { NodeUnitsClient } from '../client/nodeUnitsClient';
import { LogsClient } from '../client/logsClient';

export interface GlobalOptions {
  context?: string;
  hostUrl?: string;
  selector?: string;
  fieldSelector?: string;
  output?: string;
  watch?: boolean;
  noHeaders?: boolean;
  wide?: boolean;
  forceConfirm?: boolean;
  follow?: boolean;
  tail?: number;
  since?: string;
  prefix?: boolean;
  timestamps?: boolean;
  nodeUnit?: string;
  fileIndex?: number;
  gracePeriod?: string;
  strategy?: string;
}

export interface CliClients {
  config: ResolvedClientConfig;
  gateway: TerminalGateway;
  deployments: DeploymentsClient;
  nodeUnits: NodeUnitsClient;
  logs: LogsClient;
}

const ensureConfigValue = (result: LoadConfigResult) => {
  if (!result.ok) {
    throw new Error(
      result.reason === 'NOT_FOUND'
        ? 'Config not found. Run "yuanctl config-init > ~/.config/yuan/config.toml" to create one.'
        : result.error?.message || 'Invalid configuration file',
    );
  }
  return result.value;
};

export const loadCliClients = async (options: GlobalOptions): Promise<CliClients> => {
  const configPath = resolveConfigPath(process.env);
  const result = loadClientConfig({
    configPath,
    env: process.env,
    overrides: {
      context: options.context,
      hostUrl: options.hostUrl,
      selector: options.selector,
      fieldSelector: options.fieldSelector,
    },
  });
  const resolvedConfig = ensureConfigValue(result);
  const gateway = await TerminalGateway.ensure(resolvedConfig.host);
  return {
    config: resolvedConfig,
    gateway,
    deployments: new DeploymentsClient(gateway),
    nodeUnits: new NodeUnitsClient(gateway),
    logs: new LogsClient(gateway),
  };
};
