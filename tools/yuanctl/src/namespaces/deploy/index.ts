import type { RestartStrategy } from '../../client/deploymentsClient';
import { MAX_TAIL_LINES, DEFAULT_TAIL_LINES } from '../../constants';
import { createError } from '../../cli/error';
import type { YuanctlCommandResult } from '../../cli/output';
import type { YuanctlResolvedCommand, YuanctlStaticRegistryModule } from '../../cli/static-registry';
import type { YuanctlRuntimeContext } from '../../cli/runtime-context';
import type { IDeployment } from '@yuants/deploy';

const sanitizeDeployment = (deployment: IDeployment) => ({
  id: deployment.id,
  package_name: deployment.package_name,
  package_version: deployment.package_version,
  type: deployment.type,
  enabled: deployment.enabled,
  address: deployment.address,
  created_at: deployment.created_at,
  updated_at: deployment.updated_at,
});

const requireDeploymentsClient = (context: YuanctlRuntimeContext) => {
  if (!context.deployments) {
    throw createError('E_INTERNAL', 'internal', 'Deployments client is not available');
  }
  return context.deployments;
};

const requireLogsClient = (context: YuanctlRuntimeContext) => {
  if (!context.logs) {
    throw createError('E_INTERNAL', 'internal', 'Logs client is not available');
  }
  return context.logs;
};

const requireDeploymentId = (command: YuanctlResolvedCommand): string => {
  const value = command.positionals[0];
  if (!value) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', 'Missing deployment id');
  }
  return value;
};

const parseRestartStrategy = (value: string | boolean | undefined): RestartStrategy => {
  const strategy = (value ?? 'touch') as RestartStrategy;
  if (!['touch', 'graceful', 'hard'].includes(strategy)) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', `Unsupported restart strategy "${strategy}"`);
  }
  return strategy;
};

const parseGracePeriod = (value: string | boolean | undefined): number => {
  if (!value || typeof value !== 'string') {
    return 5_000;
  }
  let parsed: number;
  if (value.endsWith('ms')) {
    parsed = Number(value.slice(0, -2));
  } else if (value.endsWith('s')) {
    parsed = Number(value.slice(0, -1)) * 1000;
  } else {
    parsed = Number(value);
  }
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', `Invalid --grace-period value "${value}"`);
  }
  return parsed;
};

const listDeployments = async (context: YuanctlRuntimeContext): Promise<YuanctlCommandResult> => ({
  ok: true,
  kind: 'deploy.list',
  data: (await requireDeploymentsClient(context).list()).map(sanitizeDeployment),
});

const inspectDeployment = async (
  context: YuanctlRuntimeContext,
  command: YuanctlResolvedCommand,
): Promise<YuanctlCommandResult> => {
  const id = requireDeploymentId(command);
  const deployment = await requireDeploymentsClient(context).getById(id);
  if (!deployment) {
    throw createError('E_NOT_FOUND', 'not_found', `Deployment "${id}" not found`);
  }
  return { ok: true, kind: 'deploy.inspect', data: sanitizeDeployment(deployment) };
};

const setDeploymentEnabled = async (
  context: YuanctlRuntimeContext,
  command: YuanctlResolvedCommand,
  enabled: boolean,
): Promise<YuanctlCommandResult> => {
  const id = requireDeploymentId(command);
  const count = await requireDeploymentsClient(context).setEnabled(
    { identifier: { field: 'id', value: id } },
    enabled,
  );
  return {
    ok: true,
    kind: 'mutation.summary',
    data: { action: enabled ? 'enable' : 'disable', target: id, count },
  };
};

const restartDeployment = async (
  context: YuanctlRuntimeContext,
  command: YuanctlResolvedCommand,
): Promise<YuanctlCommandResult> => {
  const id = requireDeploymentId(command);
  const count = await requireDeploymentsClient(context).restart(
    { identifier: { field: 'id', value: id } },
    parseRestartStrategy(command.flags.strategy),
    parseGracePeriod(command.flags.gracePeriod),
  );
  return { ok: true, kind: 'mutation.summary', data: { action: 'restart', target: id, count } };
};

const deleteDeployment = async (
  context: YuanctlRuntimeContext,
  command: YuanctlResolvedCommand,
): Promise<YuanctlCommandResult> => {
  const id = requireDeploymentId(command);
  const count = await requireDeploymentsClient(context).delete({ identifier: { field: 'id', value: id } });
  return { ok: true, kind: 'mutation.summary', data: { action: 'delete', target: id, count } };
};

const readDeploymentLogs = async (
  context: YuanctlRuntimeContext,
  command: YuanctlResolvedCommand,
): Promise<YuanctlCommandResult> => {
  const id = requireDeploymentId(command);
  const tailRaw = command.flags.tail;
  const tail =
    tailRaw && typeof tailRaw === 'string' ? Math.min(Number(tailRaw), MAX_TAIL_LINES) : DEFAULT_TAIL_LINES;
  if (!Number.isFinite(tail) || tail <= 0) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', 'Invalid --tail value');
  }
  const fileIndexRaw = command.flags.fileIndex;
  const fileIndex = fileIndexRaw && typeof fileIndexRaw === 'string' ? Number(fileIndexRaw) : undefined;
  if (fileIndexRaw !== undefined && !Number.isFinite(fileIndex)) {
    throw createError('E_USAGE_INVALID_ARGS', 'usage', 'Invalid --file-index value');
  }
  const deployment = await requireDeploymentsClient(context).getById(id);
  if (!deployment) {
    throw createError('E_NOT_FOUND', 'not_found', `Deployment "${id}" not found`);
  }
  const result = await requireLogsClient(context).readSlice({
    deploymentId: id,
    start: -128 * 1024,
    fileIndex,
  });
  const text = result.content
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .slice(-tail)
    .join('\n');
  return { ok: true, kind: 'deploy.logs', data: text };
};

export const deployRegistryModule: YuanctlStaticRegistryModule = {
  commands: [
    {
      path: ['deploy', 'list'],
      summary: 'List deployments.',
      capabilityClass: 'read-safe',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'clients',
      supportsFormats: ['table', 'json'],
      handler: listDeployments,
    },
    {
      path: ['deploy', 'inspect'],
      summary: 'Inspect a deployment.',
      capabilityClass: 'read-safe',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'clients',
      args: ['id'],
      supportsFormats: ['table', 'json'],
      handler: inspectDeployment,
    },
    {
      path: ['deploy', 'enable'],
      summary: 'Enable a deployment.',
      capabilityClass: 'write',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'clients',
      args: ['id'],
      handler: (context, command) => setDeploymentEnabled(context, command, true),
    },
    {
      path: ['deploy', 'disable'],
      summary: 'Disable a deployment.',
      capabilityClass: 'write',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'clients',
      args: ['id'],
      handler: (context, command) => setDeploymentEnabled(context, command, false),
    },
    {
      path: ['deploy', 'restart'],
      summary: 'Restart a deployment.',
      capabilityClass: 'destructive',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'clients',
      args: ['id'],
      options: [
        { name: 'strategy', long: '--strategy', type: 'string', description: 'touch|graceful|hard' },
        {
          name: 'gracePeriod',
          long: '--grace-period',
          type: 'string',
          description: 'Grace period, e.g. 5s.',
        },
      ],
      handler: restartDeployment,
    },
    {
      path: ['deploy', 'delete'],
      summary: 'Delete a deployment.',
      capabilityClass: 'destructive',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'clients',
      args: ['id'],
      handler: deleteDeployment,
    },
    {
      path: ['deploy', 'logs'],
      summary: 'Read deployment logs.',
      capabilityClass: 'read-sensitive',
      sourcePackage: '@yuants/tool-yuanctl',
      runtime: 'clients',
      args: ['id'],
      options: [
        { name: 'tail', long: '--tail', type: 'string', description: 'Tail lines limit.' },
        {
          name: 'fileIndex',
          long: '--file-index',
          type: 'string',
          description: 'Optional rotated log index.',
        },
      ],
      handler: readDeploymentLogs,
    },
  ],
};
