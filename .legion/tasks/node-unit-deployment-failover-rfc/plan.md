# RFC: NodeUnit Deployment 失联与抢占调度

## RFC 信息

- **状态**: Draft
- **作者**: Claude
- **创建日期**: 2026-01-14
- **最后更新**: 2026-01-14

---

## 目标

梳理 node-unit 与 deployment 的绑定/调度/失联处理机制，并产出可 review 的抢占与失联恢复 RFC 设计。

## 背景与现状调研

### 现有绑定机制

- `deployment.address` 决定部署归属；node-unit 仅拉取 `enabled=true` 且 `address=nodeUnitPublicKey` 的记录并运行（`apps/node-unit/src/index.ts`）。
- `deployment.address` 默认空字符串，语义为“未指定节点”。
- 未发现任何“未调度 deployment 自动发现/自动分配”的现有逻辑。

### host 侧终端事件机制

- `apps/host/src/host-manager.ts` 维护 `terminalInfos`，并通过 `HostEvent` channel 发布 `TERMINAL_CHANGE` 事件。
- 触发条件：
  - `UpdateTerminalInfo` 触发 `payload.new`（JOIN/UPDATE）
  - WebSocket 连接关闭或 ping 失败触发 `payload.old`（LEAVE）
- `libraries/protocol/src/terminal.ts` 订阅 `HostEvent` 并更新 `terminalInfos$`，将终端 join/leave/update 转换为列表变化。

---

## 目标与非目标

### 目标

- 使用 host 的 terminal join/exit 事件识别 node-unit 是否失联。
- 允许 node-unit 清理失联节点的 deployment（将 `address` 置空）。
- node-unit 发现未调度 deployment 时进行抢占，且**一次只能抢占一个**。
- 抢占必须满足“deployment 最少的 node-unit 才可抢占”的约束；并允许并列最少时多方并发抢占，最终以 DB 状态为准。
- 抽象抢占指标接口，v1 用 deployment 数量，后续可扩展 CPU/memory 等指标。

### 非目标

- 引入全局调度中心或复杂一致性协议。
- 改变现有部署生命周期（安装/启动/日志/terminal 机制保持不变）。
- 提供跨 Host 集群的统一调度（本 RFC 仅覆盖单一 Host 视角）。

---

## 术语

- **NodeUnit**: `@yuants/node-unit` 终端，tags 中带 `node_unit=true`。
- **Deployment**: `deployment` 表记录，`address` 为空表示未指派。
- **HostEvent**: host 发布的终端变更流，含 JOIN/LEAVE/UPDATE。
- **抢占**: 将 `deployment.address` 从 `''` 或失联地址更新为当前 node-unit 地址。

---

## 设计概览

新增 node-unit 侧的“调度协调循环（Scheduler Loop）”，每个 node-unit 周期性执行：

1. **同步在线 node-unit 列表**：从 `terminalInfos$` 取当前在线 node-unit 地址集合。
2. **识别失联节点**：对比 `deployment.address` 与在线 node-unit 地址集合，筛出“部署指向已失联节点”的 deployment。
3. **释放失联部署**：将失联节点的 deployment 的 `address` 置空（仅更新 `enabled=true` 的记录）。
4. **评估抢占资格**：计算所有在线 node-unit 的“抢占指标”，找出最小值。
5. **抢占一个 deployment**：若当前 node-unit 指标==最小值，则从未调度 deployment 中挑一个并尝试抢占（一次仅一个）。

> 说明：仅对 `address=''` 的 deployment 进行抢占，不会主动夺取仍在线 node-unit 的 deployment。多 node-unit 并发抢占时，以 `update ... where address=''` 的条件更新为准，失败则视为被其他节点抢占。

---

## 核心流程（伪代码）

```ts
loop every SCHEDULER_INTERVAL_MS:
  activeNodeUnits = terminalInfos$.filter(tags.node_unit).map(tags.node_unit_address)

  deployments = query("select * from deployment where enabled = true")
  assignedAddresses = unique(deployments.map(d => d.address).filter(notEmpty))

  lostAddresses = assignedAddresses - activeNodeUnits
  if lostAddresses not empty:
    update deployment set address='' where enabled=true and address in lostAddresses

  // metrics (v1: deployment count per address)
  counts = group deployments by address (address != '')
  myCount = counts[myAddress] ?? 0
  minCount = min(counts[address] for address in activeNodeUnits)

  if myCount == minCount:
    candidates = deployments.filter(d => d.address == '')
    if candidates not empty:
      pick 1 deployment (deterministic order)
      update deployment set address=myAddress where id=? and address=''
```

---

## 抢占指标接口（可扩展）

### 目标

- 隔离“如何比较 node-unit 是否具备抢占资格”的策略。
- v1 用 deployment 数量；v2 可接入 CPU/Memory/负载等。

### 接口草案

```ts
export type ClaimMetricKey = 'deployment_count' | string;

export interface ClaimMetricSnapshot {
  key: ClaimMetricKey;
  value: number; // 值越小越优先
}

export interface ClaimMetricProvider {
  key: ClaimMetricKey;
  // 读取当前 node-unit 的指标值
  evaluate(nodeUnitAddress: string, ctx: { deployments: IDeployment[] }): ClaimMetricSnapshot;
}

export interface ClaimPolicy {
  providers: ClaimMetricProvider[]; // v1 仅一个 provider
  pickEligible(nodeUnits: string[], snapshots: Map<string, ClaimMetricSnapshot[]>): string[]; // 返回允许抢占的 nodeUnit
}
```

### v1 实现

- `deployment_count`：统计 `enabled=true && address != ''` 的数量。
- 允许抢占的 node-unit：`deployment_count` 最小值的集合。

### v2 设计：CPU/Memory 资源优先调度

#### 数据源

采用 **node-unit 自报告** 方案：node-unit 定期更新 `terminalInfo.tags`，携带资源占用信息。

```typescript
// node-unit 启动时 & 定期更新 terminalInfo.tags
terminal.terminalInfo.tags = {
  ...existingTags,
  node_unit: 'true',
  node_unit_address: publicKey,
  node_unit_cpu_percent: '45.2', // 新增：CPU 占用百分比
  node_unit_memory_mb: '1024', // 新增：内存占用 MB
};
```

**上报周期**：与 scheduler loop 间隔对齐（默认 5s），或独立配置。

**采集方式**：**聚合 node-unit 主进程 + 所有子 deployment 进程的资源占用**。

具体实现：

1. **node-unit 主进程**：使用 `process.cpuUsage()` + `process.memoryUsage().rss`
2. **子 deployment 进程**：遍历 `mapDeploymentIdToProcess`，使用 `pidusage` 获取每个子进程的 CPU/Memory
3. **聚合**：将主进程和所有子进程的 CPU% 求和、Memory 求和，得到该 node-unit 的总资源占用

```typescript
const collectTotalResourceUsage = async (
  mapDeploymentIdToProcess: Map<string, { pid: number; ... }>,
  lastCpuUsage: NodeJS.CpuUsage,
  elapsedMs: number,
  cores: number,
): Promise<{ cpuPercent: number; memoryMb: number }> => {
  // 1. node-unit 主进程
  const currentUsage = process.cpuUsage();
  const deltaMicros = (currentUsage.user + currentUsage.system) - (lastCpuUsage.user + lastCpuUsage.system);
  const mainCpuPercent = Math.max((deltaMicros / 1000 / (elapsedMs * cores)) * 100, 0);
  const mainMemoryMb = process.memoryUsage().rss / 1024 / 1024;

  // 2. 子 deployment 进程
  let childCpuPercent = 0;
  let childMemoryMb = 0;
  for (const [, meta] of mapDeploymentIdToProcess) {
    const stats = await pidusage(meta.pid).catch(() => null);
    if (stats) {
      childCpuPercent += stats.cpu;  // pidusage 返回的是百分比
      childMemoryMb += stats.memory / 1024 / 1024;
    }
  }

  // 3. 聚合
  return {
    cpuPercent: mainCpuPercent + childCpuPercent,
    memoryMb: mainMemoryMb + childMemoryMb,
  };
};
```

> **注意**：`pidusage` 返回的 `cpu` 是该进程相对于单个 CPU 核心的百分比（可能 >100%），与主进程计算方式略有差异。实际实现时需统一口径，建议都采用"相对于总 CPU 容量"的百分比。

#### Context 扩展

```typescript
export interface ClaimMetricContext {
  deployments: IDeployment[];
  deploymentCounts: Map<string, number>;
  // v2 新增
  resourceUsage: Map<string, { cpuPercent: number; memoryMb: number }>;
}
```

从 `terminalInfos` 提取资源信息：

```typescript
const loadResourceUsage = (
  terminalInfos: ITerminalInfo[],
): Map<string, { cpuPercent: number; memoryMb: number }> => {
  const usage = new Map();
  for (const info of terminalInfos) {
    const tags = info.tags ?? {};
    if (tags.node_unit === 'true' && tags.node_unit_address) {
      usage.set(tags.node_unit_address, {
        cpuPercent: parseFloat(tags.node_unit_cpu_percent ?? '0'),
        memoryMb: parseFloat(tags.node_unit_memory_mb ?? '0'),
      });
    }
  }
  return usage;
};
```

#### 新增 Provider

```typescript
const resourceUsageProvider: ClaimMetricProvider = {
  key: 'resource_usage',
  evaluate: (nodeUnitAddress, ctx) => {
    const usage = ctx.resourceUsage.get(nodeUnitAddress);
    if (!usage) return { key: 'resource_usage', value: 0 };

    // 权重：CPU 50%, Memory 50%
    const cpuWeight = 0.5;
    const memoryWeight = 0.5;
    const normalizedMemory = usage.memoryMb / 1024; // 归一化到 GB

    return {
      key: 'resource_usage',
      value: usage.cpuPercent * cpuWeight + normalizedMemory * memoryWeight,
    };
  },
};
```

#### 策略选择

v2 采用 **纯资源优先** 策略：仅看 CPU/Memory 综合评分，不考虑 deployment 数量。

```typescript
const resourceOnlyPolicy: ClaimPolicy = {
  providers: [resourceUsageProvider],
  pickEligible: (nodeUnits, snapshots) => {
    if (nodeUnits.length === 0) return [];
    const values = nodeUnits.map(
      (addr) => snapshots.get(addr)?.find((s) => s.key === 'resource_usage')?.value ?? 0,
    );
    const minValue = Math.min(...values);
    return nodeUnits.filter((_, i) => values[i] === minValue);
  },
};
```

#### 策略配置化

通过环境变量切换：

```typescript
const policyName = process.env.NODE_UNIT_CLAIM_POLICY ?? 'deployment_count';

const policies: Record<string, ClaimPolicy> = {
  deployment_count: defaultClaimPolicy, // v1 默认
  resource_usage: resourceOnlyPolicy, // v2 纯资源
};

const policy = policies[policyName] ?? defaultClaimPolicy;
```

#### 需要修改的文件

| 文件                              | 改动内容                                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `apps/node-unit/src/index.ts`     | 修改 `startNodeUnitResourceReporter`：聚合主进程 + 所有子 deployment 进程的 CPU/Memory，需要访问 `mapDeploymentIdToProcess` |
| `apps/node-unit/src/scheduler.ts` | 扩展 `ClaimMetricContext`、新增 `resourceUsageProvider` 和 `resourceOnlyPolicy`、策略配置化（已实现）                       |

#### 边界条件

- **tags 缺失**：若某 node-unit 未上报资源指标，`cpuPercent` 和 `memoryMb` 默认为 0，等同于"资源最空闲"，会被优先选中抢占。可考虑后续加入"tags 缺失则排除"的逻辑。
- **采集延迟**：资源数据有 1~2 个调度周期的延迟，属于可接受范围。
- **权重调整**：当前硬编码 50/50，后续可通过环境变量 `NODE_UNIT_CPU_WEIGHT` / `NODE_UNIT_MEMORY_WEIGHT` 配置。
- **子进程退出**：`pidusage` 对已退出进程会返回 null，已在代码中处理（`.catch(() => null)`）。
- **CPU 口径统一**：`pidusage` 返回的 cpu 是相对单核的百分比，主进程采集是相对总核心数；实现时需统一为"相对总 CPU 容量"。

---

## 抢占选择与并发策略

- **一次仅抢占一个**：单次循环最多执行一次 `update ... set address=myAddress`。
- **候选顺序**：建议按 `updated_at asc, created_at asc` 选取，保证 deterministic 且偏向 오래未处理的 deployment。
- **并发抢占**：允许并列最小的 node-unit 并发执行；由 `address=''` 条件避免冲突。
- **清理失联地址**：同样允许多节点并发执行，`update` 结果幂等。

---

## 失联判定策略

- 以 HostEvent / terminalInfos$ 为单一信号源。
- node-unit 视角：若某 `address` 对应的 node-unit 不在 `terminalInfos$` 列表中，则视为失联。
- Host 侧会在连接关闭或 Ping 失败时发出 LEAVE 事件，终端列表会自动剔除。

---

## 需要新增/修改的文件（实现阶段）

- `apps/node-unit/src/index.ts`: 增加 scheduler loop（或拆分到新模块）。
- `apps/node-unit/src/scheduler.ts`（建议新增）: 失联检测、抢占逻辑、指标接口实现。
- `libraries/deploy/src/index.ts`: 如需新增字段或注释补充（当前不改）。

---

## 设计确认结果

- 失联判定仅依赖 `terminalInfos$` 列表缺失，不增加离线缓冲时间。
- 抢占候选排序：`updated_at asc, created_at asc, id asc`。
- 抢占资格仅基于 `enabled=true` 且 `address!=''` 的 deployment 数量。
- Scheduler loop 默认 5s 间隔，保留可配置项但默认不变。

---

## 阶段概览

1. **调研** - 2 个任务
2. **设计（RFC）** - 1 个任务
3. **实现（待 review）** - 1 个任务
