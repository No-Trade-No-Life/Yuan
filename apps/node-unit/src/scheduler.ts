import { IDeployment, IDeploymentAssignment, IDeploymentAssignmentState } from '@yuants/deploy';
import { ITerminalInfo, Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { catchError, concatMap, defer, EMPTY, interval, takeUntil } from 'rxjs';

const DEFAULT_SCHEDULER_INTERVAL_MS = 5_000;
const DEFAULT_NODE_ACTIVE_TTL_SECONDS = 30;
const DEFAULT_LEASE_TTL_SECONDS = 60;
const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 15;

const ACTIVE_ASSIGNMENT_STATES: IDeploymentAssignmentState[] = ['Assigned', 'Running'];

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

type DeploymentType = 'daemon' | 'deployment';

export interface INodeUnitState {
  node_id: string;
  terminal_id: string;
  labels: Record<string, string>;
  applied_generation: number;
  last_seen_at: number;
}

const isNodeReadyForAssignmentMode = (node: INodeUnitState, generation: number): boolean =>
  node.labels.assignment_mode_enabled === 'true' && node.applied_generation >= generation;

export interface IRollbackBlocker {
  error_code:
    | 'E_ROLLBACK_BLOCKED_SELECTOR'
    | 'E_ROLLBACK_BLOCKED_REPLICAS'
    | 'E_ROLLBACK_BLOCKED_PAUSED'
    | 'E_ROLLBACK_NOT_CONVERGED_ADDRESS';
  deployment_id: string;
}

const normalizeDeploymentType = (deployment: IDeployment): DeploymentType | undefined => {
  const rawType = (deployment as { type?: string }).type;
  if (rawType === 'daemon' || rawType === 'deployment') return rawType;
  console.error(formatTime(Date.now()), 'DeploymentTypeInvalid', {
    error_code: 'ERR_INVALID_TYPE',
    deployment_id: deployment.id,
    type: rawType ?? null,
  });
  return undefined;
};

const normalizeDesiredReplicas = (deployment: IDeployment): number => {
  const value = Number(deployment.desired_replicas ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
};

const normalizeSelector = (deployment: IDeployment): string => String(deployment.selector ?? '');

const normalizeLeaseTtlSeconds = (deployment: IDeployment): number => {
  const value = Number(deployment.lease_ttl_seconds ?? DEFAULT_LEASE_TTL_SECONDS);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_LEASE_TTL_SECONDS;
};

const normalizeHeartbeatIntervalSeconds = (deployment: IDeployment): number => {
  const value = Number(deployment.heartbeat_interval_seconds ?? DEFAULT_HEARTBEAT_INTERVAL_SECONDS);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_HEARTBEAT_INTERVAL_SECONDS;
};

const isPausedDeployment = (deployment: IDeployment): boolean => deployment.paused === true;

const isAssignmentModeEnabled = (): boolean => process.env.NODE_UNIT_ASSIGNMENT_FEATURE_FLAG === 'true';

const getNodeActiveTtlSeconds = (): number => {
  const parsed = Number(process.env.NODE_UNIT_ACTIVE_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_NODE_ACTIVE_TTL_SECONDS;
};

const getAssignmentGeneration = (): number => {
  const parsed = Number(process.env.NODE_UNIT_ASSIGNMENT_GENERATION ?? '0');
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
};

export const parseSelector = (
  selector: string,
): { labels: Record<string, string> } | { error_code: 'E_SELECTOR_INVALID' } => {
  if (selector === '') return { labels: {} };
  const labels: Record<string, string> = {};
  const partPattern = /^[A-Za-z0-9_.-]{1,64}$/;
  for (const part of selector.split(',')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0 || eqIdx >= part.length - 1) return { error_code: 'E_SELECTOR_INVALID' };
    const key = part.slice(0, eqIdx);
    const value = part.slice(eqIdx + 1);
    if (!partPattern.test(key) || !partPattern.test(value)) return { error_code: 'E_SELECTOR_INVALID' };
    labels[key] = value;
  }
  return { labels };
};

export const matchSelector = (selector: string, labels: Record<string, string>): boolean => {
  const parsed = parseSelector(selector);
  if ('error_code' in parsed) return false;
  return Object.entries(parsed.labels).every(([key, value]) => labels[key] === value);
};

export const buildDeploymentAssignmentId = (deploymentId: string, replicaIndex: number): string =>
  `${deploymentId}#${replicaIndex}`;

export const buildDaemonAssignmentId = (deploymentId: string, nodeId: string): string =>
  `${deploymentId}#${nodeId}`;

const toTimestampMs = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const isAssignmentActiveAt = (assignment: IDeploymentAssignment, nowMs: number): boolean =>
  ACTIVE_ASSIGNMENT_STATES.includes(assignment.state) && toTimestampMs(assignment.lease_expire_at) >= nowMs;

export const shouldUseAssignmentSource = (assignments: IDeploymentAssignment[], nowMs: number): boolean =>
  assignments.some((assignment) => isAssignmentActiveAt(assignment, nowMs));

export const loadActiveNodeStates = (
  terminalInfos: ITerminalInfo[],
  nowMs = Date.now(),
  ttlSeconds = getNodeActiveTtlSeconds(),
): INodeUnitState[] => {
  const latestByNode = new Map<string, INodeUnitState>();
  for (const info of terminalInfos) {
    const tags = info.tags ?? {};
    if (tags.node_unit !== 'true' || !tags.node_unit_address || !info.terminal_id) continue;
    const lastSeenAt = info.updated_at ?? info.created_at ?? 0;
    if (!lastSeenAt || nowMs - lastSeenAt > ttlSeconds * 1000) continue;
    const next: INodeUnitState = {
      node_id: tags.node_unit_address,
      terminal_id: info.terminal_id,
      labels: { ...tags },
      applied_generation: Number(tags.applied_generation ?? '0') || 0,
      last_seen_at: lastSeenAt,
    };
    const current = latestByNode.get(next.node_id);
    if (!current || current.last_seen_at < next.last_seen_at) {
      latestByNode.set(next.node_id, next);
    }
  }
  return [...latestByNode.values()].sort((a, b) => a.node_id.localeCompare(b.node_id));
};

const buildAssignmentsByDeploymentId = (
  assignments: IDeploymentAssignment[],
): Map<string, IDeploymentAssignment[]> => {
  const map = new Map<string, IDeploymentAssignment[]>();
  for (const assignment of assignments) {
    const list = map.get(assignment.deployment_id) ?? [];
    list.push(assignment);
    map.set(assignment.deployment_id, list);
  }
  return map;
};

export const deriveDeploymentAddress = (
  deployment: IDeployment,
  assignments: IDeploymentAssignment[],
  nowMs: number,
): string => {
  if (normalizeDeploymentType(deployment) !== 'deployment') return '';
  if (normalizeDesiredReplicas(deployment) !== 1) return '';
  const active = assignments.filter((assignment) => isAssignmentActiveAt(assignment, nowMs));
  return active.length === 1 ? active[0].node_id : '';
};

export const getRollbackBlockers = (
  deployments: IDeployment[],
  assignments: IDeploymentAssignment[],
  nowMs: number,
): IRollbackBlocker[] => {
  const blockers: IRollbackBlocker[] = [];
  const assignmentsByDeploymentId = buildAssignmentsByDeploymentId(assignments);
  for (const deployment of deployments) {
    const type = normalizeDeploymentType(deployment);
    if (!type) continue;
    if (type === 'daemon' && normalizeSelector(deployment) !== '') {
      blockers.push({ error_code: 'E_ROLLBACK_BLOCKED_SELECTOR', deployment_id: deployment.id });
    }
    if (normalizeDesiredReplicas(deployment) > 1) {
      blockers.push({ error_code: 'E_ROLLBACK_BLOCKED_REPLICAS', deployment_id: deployment.id });
    }
    if (isPausedDeployment(deployment)) {
      blockers.push({ error_code: 'E_ROLLBACK_BLOCKED_PAUSED', deployment_id: deployment.id });
    }
    if (type !== 'deployment') continue;
    const relatedAssignments = assignmentsByDeploymentId.get(deployment.id) ?? [];
    if (relatedAssignments.length === 0) continue;
    const derivedAddress = deriveDeploymentAddress(deployment, relatedAssignments, nowMs);
    if (!derivedAddress || derivedAddress !== deployment.address) {
      blockers.push({ error_code: 'E_ROLLBACK_NOT_CONVERGED_ADDRESS', deployment_id: deployment.id });
    }
  }
  return blockers;
};

const buildAssignmentCounts = (
  deployments: IDeployment[],
  assignments: IDeploymentAssignment[],
  activeNodeUnits: string[],
  nowMs: number,
): Map<string, number> => {
  const deploymentById = new Map(deployments.map((deployment) => [deployment.id, deployment]));
  const counts = new Map(activeNodeUnits.map((address) => [address, 0]));
  for (const assignment of assignments) {
    if (!isAssignmentActiveAt(assignment, nowMs)) continue;
    const deployment = deploymentById.get(assignment.deployment_id);
    if (!deployment || normalizeDeploymentType(deployment) !== 'deployment') continue;
    counts.set(assignment.node_id, (counts.get(assignment.node_id) ?? 0) + 1);
  }
  return counts;
};

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
  for (const info of terminalInfos) {
    const tags = info.tags ?? {};
    if (tags.node_unit === 'true' && tags.node_unit_address && info.terminal_id) {
      map.set(tags.node_unit_address, info.terminal_id);
    }
  }
  return map;
};

const fetchResourceUsage = async (
  terminal: Terminal,
  activeNodeUnits: string[],
  addressToTerminalId: Map<string, string>,
): Promise<Map<string, { cpuPercent: number; memoryMb: number }>> => {
  const usage = new Map<string, { cpuPercent: number; memoryMb: number }>();
  await Promise.all(
    activeNodeUnits.map(async (address) => {
      const terminalId = addressToTerminalId.get(address);
      if (!terminalId) return;
      try {
        const service = terminal.client.resolveTargetServiceByMethodAndTargetTerminalIdSync(
          'NodeUnit/InspectResourceUsage',
          terminalId,
          {},
        );
        const res = await terminal.client.requestForResponse<{}, { cpu_percent: number; memory_mb: number }>(
          service.service_id,
          {},
        );
        if (res.code === 0 && res.data) {
          usage.set(address, {
            cpuPercent: res.data.cpu_percent,
            memoryMb: res.data.memory_mb,
          });
        }
      } catch (e) {
        console.info(formatTime(Date.now()), 'ResourceUsageFetchFailed', { address, error: String(e) });
      }
    }),
  );
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
): Record<string, { cpuPercent: number; memoryMb: number }> =>
  nodeUnits.reduce<Record<string, { cpuPercent: number; memoryMb: number }>>((result, address) => {
    result[address] = resourceUsage.get(address) ?? { cpuPercent: 0, memoryMb: 0 };
    return result;
  }, {});

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

const loadActiveNodeUnits = (terminalInfos: ITerminalInfo[]): string[] =>
  loadActiveNodeStates(terminalInfos).map((state) => state.node_id);

const listDeployments = async (terminal: Terminal): Promise<IDeployment[]> =>
  requestSQL<IDeployment[]>(
    terminal,
    'select * from deployment where enabled = true order by updated_at asc, created_at asc, id asc',
  );

const listAssignments = async (terminal: Terminal): Promise<IDeploymentAssignment[]> =>
  requestSQL<IDeploymentAssignment[]>(terminal, 'select * from deployment_assignment');

const getLostAddresses = (deployments: IDeployment[], activeNodeUnits: string[]): string[] => {
  const activeSet = new Set(activeNodeUnits);
  const lost = new Set<string>();
  for (const deployment of deployments) {
    if (deployment.type !== 'deployment') continue;
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
    if (deployment.type !== 'deployment') continue;
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
    const lostSql = `select * from deployment where enabled = true and type = 'deployment' and ${lostFilter} order by updated_at asc, created_at asc, id asc limit 1`;
    const lostResult = await requestSQL<IDeployment[]>(terminal, lostSql);
    if (lostResult[0]) return lostResult[0];
  }

  const fallbackSql =
    "select * from deployment where enabled = true and type = 'deployment' and address = '' order by updated_at asc, created_at asc, id asc limit 1";
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
  )} and type = 'deployment' and (${addressFilter}) returning id`;
  const result = await requestSQL<Array<{ id: string }>>(terminal, sql);
  return result.length > 0;
};

const chooseNodeForDeployment = (
  nodeUnitAddress: string,
  activeNodeUnits: string[],
  snapshots: Map<string, ClaimMetricSnapshot[]>,
  policy: ClaimPolicy,
): string | undefined => {
  const eligibleNodeUnits = policy.pickEligible(activeNodeUnits, snapshots).sort();
  if (eligibleNodeUnits.length === 0) return undefined;
  if (eligibleNodeUnits.includes(nodeUnitAddress)) return nodeUnitAddress;
  return eligibleNodeUnits[0];
};

const markAssignmentsDraining = async (
  terminal: Terminal,
  deploymentId: string,
  assignmentIds?: string[],
): Promise<void> => {
  const assignmentFilter =
    assignmentIds && assignmentIds.length > 0
      ? ` and assignment_id in (${assignmentIds.map((item) => escapeSQL(item)).join(',')})`
      : '';
  await requestSQL(
    terminal,
    `update deployment_assignment set state = 'Draining' where deployment_id = ${escapeSQL(
      deploymentId,
    )} and state in ('Assigned','Running')${assignmentFilter}`,
  );
};

const upsertAssignmentLease = async (
  terminal: Terminal,
  assignment: {
    assignment_id: string;
    deployment_id: string;
    node_id: string;
    replica_index: number | null;
    lease_ttl_seconds: number;
    generation: number;
  },
): Promise<void> => {
  const replicaValue = assignment.replica_index === null ? 'null' : String(assignment.replica_index);
  const updateSql = `update deployment_assignment set
    deployment_id = ${escapeSQL(assignment.deployment_id)},
    node_id = ${escapeSQL(assignment.node_id)},
    replica_index = ${replicaValue},
    lease_holder = ${escapeSQL(assignment.node_id)},
    lease_expire_at = CURRENT_TIMESTAMP + make_interval(secs => ${assignment.lease_ttl_seconds}),
    heartbeat_at = null,
    exit_reason = '',
    state = 'Assigned',
    generation = GREATEST(generation + 1, ${assignment.generation})
    where assignment_id = ${escapeSQL(
      assignment.assignment_id,
    )} and lease_expire_at < CURRENT_TIMESTAMP returning assignment_id`;
  const updated = await requestSQL<Array<{ assignment_id: string }>>(terminal, updateSql);
  if (updated.length > 0) return;

  const insertSql = `insert into deployment_assignment (
    assignment_id,
    deployment_id,
    node_id,
    replica_index,
    lease_holder,
    lease_expire_at,
    heartbeat_at,
    exit_reason,
    state,
    generation
  )
  select
    ${escapeSQL(assignment.assignment_id)},
    ${escapeSQL(assignment.deployment_id)}::uuid,
    ${escapeSQL(assignment.node_id)},
    ${replicaValue},
    ${escapeSQL(assignment.node_id)},
    CURRENT_TIMESTAMP + make_interval(secs => ${assignment.lease_ttl_seconds}),
    null,
    '',
    'Assigned',
    ${assignment.generation}
  where not exists (
    select 1 from deployment_assignment where assignment_id = ${escapeSQL(assignment.assignment_id)}
  ) on conflict (assignment_id) do nothing returning assignment_id`;
  await requestSQL<Array<{ assignment_id: string }>>(terminal, insertSql);
};

const refreshAssignmentStates = async (terminal: Terminal): Promise<void> => {
  await requestSQL(
    terminal,
    "update deployment_assignment set state = 'Running' where state = 'Assigned' and heartbeat_at is not null",
  );
  await requestSQL(
    terminal,
    "update deployment_assignment set state = 'Draining' where state in ('Assigned','Running') and lease_expire_at < CURRENT_TIMESTAMP",
  );
  await requestSQL(
    terminal,
    "update deployment_assignment set state = 'Terminated' where state = 'Draining' and (exit_reason <> '' or lease_expire_at < CURRENT_TIMESTAMP)",
  );
};

const syncDeploymentAddresses = async (
  terminal: Terminal,
  deployments: IDeployment[],
  assignments: IDeploymentAssignment[],
  nowMs: number,
): Promise<void> => {
  const assignmentsByDeploymentId = buildAssignmentsByDeploymentId(assignments);
  for (const deployment of deployments) {
    const nextAddress = deriveDeploymentAddress(
      deployment,
      assignmentsByDeploymentId.get(deployment.id) ?? [],
      nowMs,
    );
    if (deployment.address === nextAddress) continue;
    await requestSQL(
      terminal,
      `update deployment set address = ${escapeSQL(nextAddress)} where id = ${escapeSQL(
        deployment.id,
      )} and address <> ${escapeSQL(nextAddress)}`,
    );
  }
};

const runLegacySchedulerCycle = async (
  terminal: Terminal,
  nodeUnitAddress: string,
  terminalInfos: ITerminalInfo[],
  policyName: string,
  policy: ClaimPolicy,
): Promise<void> => {
  const activeNodeUnits = loadActiveNodeUnits(terminalInfos);
  if (activeNodeUnits.length === 0) return;

  const deployments = await listDeployments(terminal);
  const blockers = getRollbackBlockers(deployments, await listAssignments(terminal), Date.now());
  if (blockers.length > 0) {
    console.error(formatTime(Date.now()), 'RollbackBlocked', blockers);
    return;
  }

  const deploymentOnly: IDeployment[] = [];
  for (const deployment of deployments) {
    const type = normalizeDeploymentType(deployment);
    if (!type) continue;
    if (type === 'daemon') {
      if (deployment.address) {
        console.error(formatTime(Date.now()), 'DeploymentDaemonAddressSet', {
          error_code: 'ERR_DAEMON_ADDRESS_SET',
          deployment_id: deployment.id,
          address: deployment.address,
        });
      }
      continue;
    }
    deploymentOnly.push(deployment);
  }

  const lostAddresses = getLostAddresses(deploymentOnly, activeNodeUnits);
  const addressToTerminalId = resolveNodeUnitTerminalIds(terminalInfos);
  const resourceUsage = await fetchResourceUsage(terminal, activeNodeUnits, addressToTerminalId);
  const counts = buildDeploymentCounts(deploymentOnly, activeNodeUnits);
  const context: ClaimMetricContext = {
    deployments: deploymentOnly,
    deploymentCounts: counts,
    resourceUsage,
  };

  if (policyName === 'none') {
    console.info(formatTime(Date.now()), 'DeploymentClaimSkipped', {
      reason: 'policy_disabled',
      error_code: 'ERR_POLICY_DISABLED',
      policy: policyName,
    });
    return;
  }

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

  if (!isEligible) return;

  const candidate = await pickCandidateDeployment(terminal, lostAddresses);
  if (!candidate) return;

  console.info(formatTime(Date.now()), 'DeploymentClaimAttempt', {
    deployment_id: candidate.id,
    claimant: nodeUnitAddress,
    usage: buildResourceUsageSnapshot(activeNodeUnits, resourceUsage),
  });

  const claimed = await claimDeployment(terminal, candidate, nodeUnitAddress, lostAddresses);
  console.info(formatTime(Date.now()), claimed ? 'DeploymentClaimed' : 'DeploymentClaimSkipped', {
    deployment_id: candidate.id,
    claimant: nodeUnitAddress,
    reason: claimed ? undefined : 'claim_conflict',
  });
};

const runAssignmentSchedulerCycle = async (
  terminal: Terminal,
  nodeUnitAddress: string,
  terminalInfos: ITerminalInfo[],
  policy: ClaimPolicy,
): Promise<void> => {
  const nowMs = Date.now();
  const generation = getAssignmentGeneration();
  const activeNodes = loadActiveNodeStates(terminalInfos, nowMs).filter((node) =>
    isNodeReadyForAssignmentMode(node, generation),
  );
  const activeNodeUnits = activeNodes.map((node) => node.node_id);
  if (activeNodeUnits.length === 0) return;

  await refreshAssignmentStates(terminal);

  const deployments = await listDeployments(terminal);
  let assignments = await listAssignments(terminal);
  const addressToTerminalId = resolveNodeUnitTerminalIds(terminalInfos);
  const resourceUsage = await fetchResourceUsage(terminal, activeNodeUnits, addressToTerminalId);
  const counts = buildAssignmentCounts(deployments, assignments, activeNodeUnits, nowMs);
  const context: ClaimMetricContext = {
    deployments,
    deploymentCounts: counts,
    resourceUsage,
  };
  const snapshots = buildSnapshots(activeNodeUnits, context, policy);
  const assignmentsByDeploymentId = buildAssignmentsByDeploymentId(assignments);

  for (const deployment of deployments) {
    const type = normalizeDeploymentType(deployment);
    if (!type) continue;
    const deploymentAssignments = assignmentsByDeploymentId.get(deployment.id) ?? [];

    if (isPausedDeployment(deployment)) {
      await markAssignmentsDraining(terminal, deployment.id);
      continue;
    }

    if (type === 'deployment') {
      if (normalizeSelector(deployment) !== '') {
        console.error(formatTime(Date.now()), 'DeploymentSelectorInvalid', {
          error_code: 'E_SELECTOR_INVALID',
          deployment_id: deployment.id,
        });
        continue;
      }
      if (normalizeDesiredReplicas(deployment) > 1) {
        console.error(formatTime(Date.now()), 'PhaseBGateBlocked', {
          error_code: 'E_PHASE_B_REQUIRED',
          deployment_id: deployment.id,
          desired_replicas: normalizeDesiredReplicas(deployment),
        });
        await markAssignmentsDraining(terminal, deployment.id);
        continue;
      }

      const assignmentId = buildDeploymentAssignmentId(deployment.id, 0);
      const current = deploymentAssignments.find((assignment) => assignment.assignment_id === assignmentId);
      if (!current || !isAssignmentActiveAt(current, nowMs)) {
        const targetNodeId = chooseNodeForDeployment(nodeUnitAddress, activeNodeUnits, snapshots, policy);
        if (targetNodeId) {
          await upsertAssignmentLease(terminal, {
            assignment_id: assignmentId,
            deployment_id: deployment.id,
            node_id: targetNodeId,
            replica_index: 0,
            lease_ttl_seconds: normalizeLeaseTtlSeconds(deployment),
            generation,
          });
          console.info(formatTime(Date.now()), 'DeploymentAssignmentScheduled', {
            deployment_id: deployment.id,
            assignment_id: assignmentId,
            node_id: targetNodeId,
          });
        }
      }
      const extraAssignments = deploymentAssignments
        .filter(
          (assignment) => assignment.assignment_id !== assignmentId && assignment.state !== 'Terminated',
        )
        .map((assignment) => assignment.assignment_id);
      if (extraAssignments.length > 0) {
        await markAssignmentsDraining(terminal, deployment.id, extraAssignments);
      }
      continue;
    }

    const selector = normalizeSelector(deployment);
    const parsedSelector = parseSelector(selector);
    if ('error_code' in parsedSelector) {
      console.error(formatTime(Date.now()), 'DaemonSelectorInvalid', {
        error_code: parsedSelector.error_code,
        deployment_id: deployment.id,
        selector,
      });
      await markAssignmentsDraining(terminal, deployment.id);
      continue;
    }

    const matchedNodes = activeNodes.filter((node) => matchSelector(selector, node.labels));
    const matchedNodeIds = new Set(matchedNodes.map((node) => node.node_id));
    for (const node of matchedNodes) {
      const assignmentId = buildDaemonAssignmentId(deployment.id, node.node_id);
      const current = deploymentAssignments.find((assignment) => assignment.assignment_id === assignmentId);
      if (current && isAssignmentActiveAt(current, nowMs)) continue;
      await upsertAssignmentLease(terminal, {
        assignment_id: assignmentId,
        deployment_id: deployment.id,
        node_id: node.node_id,
        replica_index: null,
        lease_ttl_seconds: normalizeLeaseTtlSeconds(deployment),
        generation,
      });
      console.info(formatTime(Date.now()), 'DaemonAssignmentScheduled', {
        deployment_id: deployment.id,
        assignment_id: assignmentId,
        node_id: node.node_id,
        selector,
      });
    }

    const obsoleteAssignments = deploymentAssignments
      .filter(
        (assignment) =>
          assignment.state !== 'Terminated' &&
          (!matchedNodeIds.has(assignment.node_id) || !activeNodeUnits.includes(assignment.node_id)),
      )
      .map((assignment) => assignment.assignment_id);
    if (obsoleteAssignments.length > 0) {
      await markAssignmentsDraining(terminal, deployment.id, obsoleteAssignments);
    }
  }

  assignments = await listAssignments(terminal);
  await syncDeploymentAddresses(terminal, deployments, assignments, nowMs);
};

const runSchedulerCycle = async (
  terminal: Terminal,
  nodeUnitAddress: string,
  terminalInfos: ITerminalInfo[],
  policyName: string,
  policy: ClaimPolicy,
): Promise<void> => {
  if (isAssignmentModeEnabled()) {
    await runAssignmentSchedulerCycle(terminal, nodeUnitAddress, terminalInfos, policy);
    return;
  }
  await runLegacySchedulerCycle(terminal, nodeUnitAddress, terminalInfos, policyName, policy);
};

export const startDeploymentScheduler = (
  terminal: Terminal,
  nodeUnitAddress: string,
  options: { intervalMs?: number; policy?: ClaimPolicy } = {},
) => {
  let terminalInfos: ITerminalInfo[] = [];

  terminal.terminalInfos$.pipe(takeUntil(terminal.dispose$)).subscribe((infos) => {
    terminalInfos = infos;
  });

  const policyName = (process.env.NODE_UNIT_CLAIM_POLICY ?? 'deployment_count').toLowerCase();
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
        defer(() => runSchedulerCycle(terminal, nodeUnitAddress, terminalInfos, policyName, policy)).pipe(
          catchError((err) => {
            console.error(formatTime(Date.now()), 'DeploymentSchedulerError', err);
            return EMPTY;
          }),
        ),
      ),
    )
    .subscribe();
};

export {
  buildAssignmentCounts,
  buildDeploymentCounts,
  buildMetricTable,
  buildMinMetrics,
  buildNotEligibleReasons,
  buildResourceUsageSnapshot,
  buildSnapshots,
  claimDeployment,
  defaultClaimPolicy,
  deploymentCountProvider,
  fetchResourceUsage,
  getLostAddresses,
  isAssignmentModeEnabled,
  loadActiveNodeUnits,
  normalizeDesiredReplicas,
  normalizeHeartbeatIntervalSeconds,
  normalizeLeaseTtlSeconds,
  normalizeSelector,
  parseWeight,
  pickCandidateDeployment,
  resolveNodeUnitTerminalIds,
  resourceOnlyPolicy,
  resourceUsageProvider,
};
