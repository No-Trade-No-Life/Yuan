import { IDeployment } from '@yuants/deploy';
import { ITerminalInfo, Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { catchError, concatMap, defer, EMPTY, interval, takeUntil } from 'rxjs';

const DEFAULT_SCHEDULER_INTERVAL_MS = 5_000;

export type ClaimMetricKey = 'deployment_count' | 'resource_usage' | string;

export interface ClaimMetricSnapshot {
  key: ClaimMetricKey;
  value: number;
}

export interface ClaimMetricContext {
  deployments: IDeployment[];
  deploymentCounts: Map<string, number>;
  resourceUsage: Map<string, { cpuPercent: number; memoryMb: number }>;
}

export interface ClaimMetricProvider {
  key: ClaimMetricKey;
  evaluate: (nodeUnitAddress: string, ctx: ClaimMetricContext) => ClaimMetricSnapshot;
}

export interface ClaimPolicy {
  providers: ClaimMetricProvider[];
  pickEligible: (nodeUnits: string[], snapshots: Map<string, ClaimMetricSnapshot[]>) => string[];
}

const deploymentCountProvider: ClaimMetricProvider = {
  key: 'deployment_count',
  evaluate: (nodeUnitAddress, ctx) => ({
    key: 'deployment_count',
    value: ctx.deploymentCounts.get(nodeUnitAddress) ?? 0,
  }),
};

const parseWeight = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const loadResourceUsage = (
  terminalInfos: ITerminalInfo[],
): Map<string, { cpuPercent: number; memoryMb: number }> => {
  const usage = new Map<string, { cpuPercent: number; memoryMb: number }>();
  for (const info of terminalInfos) {
    const tags = info.tags ?? {};
    if (tags.node_unit === 'true' && tags.node_unit_address) {
      const cpuPercent = Number.parseFloat(tags.node_unit_cpu_percent ?? '0');
      const memoryMb = Number.parseFloat(tags.node_unit_memory_mb ?? '0');
      usage.set(tags.node_unit_address, {
        cpuPercent: Number.isFinite(cpuPercent) ? cpuPercent : 0,
        memoryMb: Number.isFinite(memoryMb) ? memoryMb : 0,
      });
    }
  }
  return usage;
};

const resourceUsageProvider: ClaimMetricProvider = {
  key: 'resource_usage',
  evaluate: (nodeUnitAddress, ctx) => {
    const usage = ctx.resourceUsage.get(nodeUnitAddress);
    if (!usage) return { key: 'resource_usage', value: 0 };

    const cpuWeight = parseWeight(process.env.NODE_UNIT_CPU_WEIGHT, 0.5);
    const memoryWeight = parseWeight(process.env.NODE_UNIT_MEMORY_WEIGHT, 0.5);
    const weightSum = cpuWeight + memoryWeight;
    const normalizedCpuWeight = weightSum > 0 ? cpuWeight / weightSum : 0.5;
    const normalizedMemoryWeight = weightSum > 0 ? memoryWeight / weightSum : 0.5;

    const normalizedMemory = usage.memoryMb / 1024;

    return {
      key: 'resource_usage',
      value: usage.cpuPercent * normalizedCpuWeight + normalizedMemory * normalizedMemoryWeight,
    };
  },
};

const buildResourceUsageSnapshot = (
  nodeUnits: string[],
  resourceUsage: Map<string, { cpuPercent: number; memoryMb: number }>,
): Record<string, { cpuPercent: number; memoryMb: number }> => {
  return nodeUnits.reduce<Record<string, { cpuPercent: number; memoryMb: number }>>((result, address) => {
    const usage = resourceUsage.get(address) ?? { cpuPercent: 0, memoryMb: 0 };
    result[address] = usage;
    return result;
  }, {});
};

const defaultClaimPolicy: ClaimPolicy = {
  providers: [deploymentCountProvider],
  pickEligible: (nodeUnits, snapshots) => {
    if (nodeUnits.length === 0) return [];
    const values = nodeUnits.map(
      (address) =>
        snapshots.get(address)?.find((snapshot) => snapshot.key === 'deployment_count')?.value ?? 0,
    );
    const minValue = Math.min(...values);
    return nodeUnits.filter((_, index) => values[index] === minValue);
  },
};

const resourceOnlyPolicy: ClaimPolicy = {
  providers: [resourceUsageProvider],
  pickEligible: (nodeUnits, snapshots) => {
    if (nodeUnits.length === 0) return [];
    const values = nodeUnits.map(
      (address) => snapshots.get(address)?.find((snapshot) => snapshot.key === 'resource_usage')?.value ?? 0,
    );
    const minValue = Math.min(...values);
    return nodeUnits.filter((_, index) => values[index] === minValue);
  },
};

const loadActiveNodeUnits = (terminalInfos: ITerminalInfo[]): string[] => {
  const addresses = new Set<string>();
  for (const info of terminalInfos) {
    const tags = info.tags ?? {};
    if (tags.node_unit === 'true' && tags.node_unit_address) {
      addresses.add(tags.node_unit_address);
    }
  }
  return [...addresses];
};

const listDeployments = async (terminal: Terminal): Promise<IDeployment[]> =>
  requestSQL<IDeployment[]>(terminal, 'select * from deployment where enabled = true');

const getLostAddresses = (deployments: IDeployment[], activeNodeUnits: string[]): string[] => {
  const activeSet = new Set(activeNodeUnits);
  const lost = new Set<string>();
  for (const deployment of deployments) {
    if (deployment.address && !activeSet.has(deployment.address)) {
      lost.add(deployment.address);
    }
  }
  return [...lost];
};

const releaseLostDeployments = async (terminal: Terminal, addresses: string[]): Promise<number> => {
  if (addresses.length === 0) return 0;
  const addressSql = addresses.map((address) => escapeSQL(address)).join(',');
  const sql = `update deployment set address = '' where enabled = true and address in (${addressSql}) returning id`;
  const result = await requestSQL<Array<{ id: string }>>(terminal, sql);
  return result.length;
};

const buildDeploymentCounts = (
  deployments: IDeployment[],
  activeNodeUnits: string[],
): Map<string, number> => {
  const counts = new Map(activeNodeUnits.map((address) => [address, 0]));
  for (const deployment of deployments) {
    const address = deployment.address;
    if (!address) continue;
    const current = counts.get(address);
    if (current === undefined) continue;
    counts.set(address, current + 1);
  }
  return counts;
};

const buildSnapshots = (
  nodeUnits: string[],
  ctx: ClaimMetricContext,
  policy: ClaimPolicy,
): Map<string, ClaimMetricSnapshot[]> => {
  const snapshots = new Map<string, ClaimMetricSnapshot[]>();
  for (const nodeUnitAddress of nodeUnits) {
    snapshots.set(
      nodeUnitAddress,
      policy.providers.map((provider) => provider.evaluate(nodeUnitAddress, ctx)),
    );
  }
  return snapshots;
};

const pickCandidateDeployment = async (terminal: Terminal): Promise<IDeployment | undefined> => {
  const sql =
    "select * from deployment where enabled = true and address = '' order by updated_at asc, created_at asc, id asc limit 1";
  const result = await requestSQL<IDeployment[]>(terminal, sql);
  return result[0];
};

const claimDeployment = async (
  terminal: Terminal,
  deployment: IDeployment,
  nodeUnitAddress: string,
): Promise<boolean> => {
  const sql = `update deployment set address = ${escapeSQL(nodeUnitAddress)} where id = ${escapeSQL(
    deployment.id,
  )} and address = '' returning id`;
  const result = await requestSQL<Array<{ id: string }>>(terminal, sql);
  return result.length > 0;
};

const runSchedulerCycle = async (
  terminal: Terminal,
  nodeUnitAddress: string,
  activeNodeUnits: string[],
  resourceUsage: Map<string, { cpuPercent: number; memoryMb: number }>,
  policy: ClaimPolicy,
): Promise<void> => {
  if (activeNodeUnits.length === 0) return;

  let deployments = await listDeployments(terminal);
  const lostAddresses = getLostAddresses(deployments, activeNodeUnits);

  if (lostAddresses.length > 0) {
    const released = await releaseLostDeployments(terminal, lostAddresses);
    if (released > 0) {
      console.info(formatTime(Date.now()), 'DeploymentRelease', { count: released });
      deployments = await listDeployments(terminal);
    }
  }

  const counts = buildDeploymentCounts(deployments, activeNodeUnits);
  const context: ClaimMetricContext = { deployments, deploymentCounts: counts, resourceUsage };
  const snapshots = buildSnapshots(activeNodeUnits, context, policy);
  const eligibleNodeUnits = policy.pickEligible(activeNodeUnits, snapshots);

  if (!eligibleNodeUnits.includes(nodeUnitAddress)) return;

  const candidate = await pickCandidateDeployment(terminal);
  if (!candidate) return;

  const usageSnapshot = buildResourceUsageSnapshot(activeNodeUnits, resourceUsage);
  console.info(formatTime(Date.now()), 'DeploymentClaimAttempt', {
    deployment_id: candidate.id,
    usage: usageSnapshot,
  });

  const claimed = await claimDeployment(terminal, candidate, nodeUnitAddress);
  if (claimed) {
    console.info(formatTime(Date.now()), 'DeploymentClaimed', candidate.id);
  } else {
    console.info(formatTime(Date.now()), 'DeploymentClaimSkipped', candidate.id);
  }
};

export const startDeploymentScheduler = (
  terminal: Terminal,
  nodeUnitAddress: string,
  options: { intervalMs?: number; policy?: ClaimPolicy } = {},
) => {
  let activeNodeUnits: string[] = [];
  let resourceUsage = new Map<string, { cpuPercent: number; memoryMb: number }>();

  terminal.terminalInfos$.pipe(takeUntil(terminal.dispose$)).subscribe((terminalInfos) => {
    activeNodeUnits = loadActiveNodeUnits(terminalInfos);
    resourceUsage = loadResourceUsage(terminalInfos);
  });

  const policyName = process.env.NODE_UNIT_CLAIM_POLICY ?? 'deployment_count';
  const policies: Record<string, ClaimPolicy> = {
    deployment_count: defaultClaimPolicy,
    resource_usage: resourceOnlyPolicy,
  };
  const policy = options.policy ?? policies[policyName] ?? defaultClaimPolicy;
  const intervalFromEnv = Number(process.env.NODE_UNIT_SCHEDULER_INTERVAL_MS);
  const intervalMs =
    Number.isFinite(options.intervalMs) && options.intervalMs! > 0
      ? options.intervalMs!
      : Number.isFinite(intervalFromEnv) && intervalFromEnv > 0
      ? intervalFromEnv
      : DEFAULT_SCHEDULER_INTERVAL_MS;

  interval(intervalMs)
    .pipe(
      takeUntil(terminal.dispose$),
      concatMap(() =>
        defer(() =>
          runSchedulerCycle(terminal, nodeUnitAddress, activeNodeUnits, resourceUsage, policy),
        ).pipe(
          catchError((err) => {
            console.error(formatTime(Date.now()), 'DeploymentSchedulerError', err);
            return EMPTY;
          }),
        ),
      ),
    )
    .subscribe();
};
