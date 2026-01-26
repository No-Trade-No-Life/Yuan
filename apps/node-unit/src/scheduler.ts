import { IDeployment } from '@yuants/deploy';
import { ITerminalInfo, Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import {
  catchError,
  concatMap,
  defer,
  EMPTY,
  interval,
  takeUntil,
  firstValueFrom,
  timeout,
  filter,
  first,
} from 'rxjs';

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

const resolveNodeUnitTerminalIds = (terminalInfos: ITerminalInfo[]): Map<string, string> => {
  const map = new Map<string, string>();
  console.info(formatTime(Date.now()), 'resolveNodeUnitTerminalIds:input', {
    terminalInfos: terminalInfos.map((info) => ({
      terminal_id: info.terminal_id,
      tags: info.tags,
    })),
  });
  for (const info of terminalInfos) {
    const tags = info.tags ?? {};
    if (tags.node_unit === 'true' && tags.node_unit_address && info.terminal_id) {
      map.set(tags.node_unit_address, info.terminal_id);
      console.info(formatTime(Date.now()), 'resolveNodeUnitTerminalIds:mapping', {
        node_unit_address: tags.node_unit_address,
        terminal_id: info.terminal_id,
      });
    }
  }
  console.info(formatTime(Date.now()), 'resolveNodeUnitTerminalIds:result', {
    mappings: Object.fromEntries(map.entries()),
  });
  return map;
};

const fetchResourceUsage = async (
  terminal: Terminal,
  activeNodeUnits: string[],
  addressToTerminalId: Map<string, string>,
): Promise<Map<string, { cpuPercent: number; memoryMb: number }>> => {
  console.info(formatTime(Date.now()), 'fetchResourceUsage', {
    activeNodeUnits,
    addressToTerminalId: Object.fromEntries(addressToTerminalId.entries()),
  });
  const usage = new Map<string, { cpuPercent: number; memoryMb: number }>();
  await Promise.all(
    activeNodeUnits.map(async (address) => {
      const terminalId = addressToTerminalId.get(address);
      console.info(formatTime(Date.now()), 'fetchResourceUsage:processing', { address, terminalId });
      if (!terminalId) {
        console.info(formatTime(Date.now()), 'fetchResourceUsage:skip', {
          address,
          reason: 'no_terminal_id',
        });
        return;
      }
      try {
        console.info(formatTime(Date.now()), 'fetchResourceUsage:requesting', { address, terminalId });
        const service = terminal.client.resolveTargetServiceByMethodAndTargetTerminalIdSync(
          'NodeUnit/InspectResourceUsage',
          terminalId,
          {},
        );
        const res = await terminal.client.requestForResponse<{}, { cpu_percent: number; memory_mb: number }>(
          service.service_id,
          {},
        );
        console.info(formatTime(Date.now()), 'fetchResourceUsage:response', { address, terminalId, res });
        if (res.code === 0 && res.data) {
          usage.set(address, {
            cpuPercent: res.data.cpu_percent,
            memoryMb: res.data.memory_mb,
          });
          console.info(formatTime(Date.now()), 'ResourceUsageFetched', { address, data: res.data });
        } else {
          console.info(formatTime(Date.now()), 'fetchResourceUsage:error', { address, terminalId, res });
        }
      } catch (e) {
        console.info(formatTime(Date.now()), 'ResourceUsageFetchFailed', { address, error: String(e) });
      }
    }),
  );
  console.info(formatTime(Date.now()), 'fetchResourceUsage:result', {
    usage: Object.fromEntries(usage.entries()),
  });
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

const buildMetricTable = (
  nodeUnits: string[],
  snapshots: Map<string, ClaimMetricSnapshot[]>,
): Map<string, Record<string, number>> => {
  const table = new Map<string, Record<string, number>>();
  for (const nodeUnitAddress of nodeUnits) {
    const metrics: Record<string, number> = {};
    for (const snapshot of snapshots.get(nodeUnitAddress) ?? []) {
      metrics[snapshot.key] = snapshot.value;
    }
    table.set(nodeUnitAddress, metrics);
  }
  return table;
};

const buildMinMetrics = (metricTable: Map<string, Record<string, number>>): Record<string, number> => {
  const minMetrics: Record<string, number> = {};
  for (const metrics of metricTable.values()) {
    for (const [key, value] of Object.entries(metrics)) {
      const current = minMetrics[key];
      minMetrics[key] = current === undefined ? value : Math.min(current, value);
    }
  }
  return minMetrics;
};

const buildNotEligibleReasons = (
  selfMetrics: Record<string, number>,
  minMetrics: Record<string, number>,
): string[] => {
  const reasons: string[] = [];
  for (const [key, minValue] of Object.entries(minMetrics)) {
    const selfValue = selfMetrics[key];
    if (selfValue === undefined) {
      reasons.push(`${key}:missing`);
      continue;
    }
    if (selfValue > minValue) {
      reasons.push(`${key}:${selfValue.toFixed(4)}>${minValue.toFixed(4)}`);
    }
  }
  return reasons;
};

const pickCandidateDeployment = async (
  terminal: Terminal,
  lostAddresses: string[],
): Promise<IDeployment | undefined> => {
  if (lostAddresses.length > 0) {
    const lostFilter = `address in (${lostAddresses.map((address) => escapeSQL(address)).join(',')})`;
    const lostSql = `select * from deployment where enabled = true and ${lostFilter} order by updated_at asc, created_at asc, id asc limit 1`;
    const lostResult = await requestSQL<IDeployment[]>(terminal, lostSql);
    if (lostResult[0]) return lostResult[0];
  }

  const fallbackSql =
    "select * from deployment where enabled = true and address = '' order by updated_at asc, created_at asc, id asc limit 1";
  const fallbackResult = await requestSQL<IDeployment[]>(terminal, fallbackSql);
  return fallbackResult[0];
};

const claimDeployment = async (
  terminal: Terminal,
  deployment: IDeployment,
  nodeUnitAddress: string,
  lostAddresses: string[],
): Promise<boolean> => {
  const addressFilter =
    lostAddresses.length > 0
      ? `address = '' or address in (${lostAddresses.map((address) => escapeSQL(address)).join(',')})`
      : "address = ''";
  const sql = `update deployment set address = ${escapeSQL(nodeUnitAddress)} where id = ${escapeSQL(
    deployment.id,
  )} and (${addressFilter}) returning id`;
  const result = await requestSQL<Array<{ id: string }>>(terminal, sql);
  return result.length > 0;
};

const runSchedulerCycle = async (
  terminal: Terminal,
  nodeUnitAddress: string,
  activeNodeUnits: string[],
  terminalInfos: ITerminalInfo[],
  policy: ClaimPolicy,
): Promise<void> => {
  if (activeNodeUnits.length === 0) return;

  let deployments = await listDeployments(terminal);
  const lostAddresses = getLostAddresses(deployments, activeNodeUnits);

  const addressToTerminalId = resolveNodeUnitTerminalIds(terminalInfos);
  const resourceUsage = await fetchResourceUsage(terminal, activeNodeUnits, addressToTerminalId);

  const counts = buildDeploymentCounts(deployments, activeNodeUnits);
  const context: ClaimMetricContext = { deployments, deploymentCounts: counts, resourceUsage };
  const snapshots = buildSnapshots(activeNodeUnits, context, policy);
  const eligibleNodeUnits = policy.pickEligible(activeNodeUnits, snapshots);
  const isEligible = eligibleNodeUnits.includes(nodeUnitAddress);
  const metricTable = buildMetricTable(activeNodeUnits, snapshots);
  const minMetrics = buildMinMetrics(metricTable);
  const selfMetrics = metricTable.get(nodeUnitAddress) ?? {};
  const notEligibleReasons = buildNotEligibleReasons(selfMetrics, minMetrics);

  console.info(formatTime(Date.now()), 'DeploymentClaimEligibility', {
    eligible: isEligible,
    policy: policy.providers.map((provider) => provider.key),
    activeNodeUnits,
    eligibleNodeUnits,
    metrics: selfMetrics,
    minMetrics,
    notEligibleReasons,
  });

  if (!isEligible) {
    console.info(formatTime(Date.now()), 'DeploymentClaimSkipped', {
      reason: 'not_eligible',
      metrics: selfMetrics,
      minMetrics,
      notEligibleReasons,
    });
    return;
  }

  const candidate = await pickCandidateDeployment(terminal, lostAddresses);
  if (!candidate) {
    console.info(formatTime(Date.now()), 'DeploymentClaimSkipped', {
      reason: 'no_candidate',
    });
    return;
  }

  const usageSnapshot = buildResourceUsageSnapshot(activeNodeUnits, resourceUsage);
  console.info(formatTime(Date.now()), 'DeploymentClaimAttempt', {
    deployment_id: candidate.id,
    claimant: nodeUnitAddress,
    usage: usageSnapshot,
  });

  const claimed = await claimDeployment(terminal, candidate, nodeUnitAddress, lostAddresses);
  if (claimed) {
    console.info(formatTime(Date.now()), 'DeploymentClaimed', {
      deployment_id: candidate.id,
      claimant: nodeUnitAddress,
    });
  } else {
    console.info(formatTime(Date.now()), 'DeploymentClaimSkipped', {
      reason: 'claim_conflict',
      deployment_id: candidate.id,
      claimant: nodeUnitAddress,
    });
  }
};

export const startDeploymentScheduler = (
  terminal: Terminal,
  nodeUnitAddress: string,
  options: { intervalMs?: number; policy?: ClaimPolicy } = {},
) => {
  let activeNodeUnits: string[] = [];
  let terminalInfos: ITerminalInfo[] = [];

  terminal.terminalInfos$.pipe(takeUntil(terminal.dispose$)).subscribe((infos) => {
    terminalInfos = infos;
    activeNodeUnits = loadActiveNodeUnits(infos);
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
          runSchedulerCycle(terminal, nodeUnitAddress, activeNodeUnits, terminalInfos, policy),
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

// 导出内部函数用于单元测试
export {
  loadActiveNodeUnits,
  getLostAddresses,
  buildDeploymentCounts,
  buildSnapshots,
  pickCandidateDeployment,
  claimDeployment,
  fetchResourceUsage,
  resolveNodeUnitTerminalIds,
  buildResourceUsageSnapshot,
  parseWeight,
  deploymentCountProvider,
  resourceUsageProvider,
  defaultClaimPolicy,
  resourceOnlyPolicy,
};
