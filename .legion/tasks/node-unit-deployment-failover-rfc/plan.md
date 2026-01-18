# RFC: NodeUnit Deployment 失联与抢占调度

## RFC 信息

- **状态**: Draft
- **作者**: Claude
- **创建日期**: 2026-01-14
- **最后更新**: 2026-01-14

---

## 目标

NodeUnit Deployment 失联与抢占调度 (RFC v2: Service-based Resource Discovery)

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

### v2 设计：CPU/Memory 资源优先调度 (Pull-based)

#### 核心理念

弃用 v1 中的 "Push-based (Tags)" 方案，改为 **"Pull-based (Service)"** 方案。
Tags 适用于低频元数据（如版本号、名称），高频更新资源用量会导致 host 频繁广播 terminal 列表，造成无谓的流量压力。
新方案中，Scheduler 主动通过 RPC 向在线 NodeUnit 轮询资源状态。

#### 数据源

NodeUnit 暴露 `NodeUnit/InspectResourceUsage` 服务，按需返回当前资源快照。

#### 服务定义

```typescript
// Service: NodeUnit/InspectResourceUsage
// Request: {}
// Response:
interface IInspectResourceUsageResponse {
  cpu_percent: number; // 0-100+ (聚合值)
  memory_mb: number; // MB (聚合值)
}
```

#### 实现细节

1. **NodeUnit 端（Server）**：

   - 启动时注册服务 `NodeUnit/InspectResourceUsage`。
   - 内部维护 `ResourceCollector`，定期（如 1s）聚合主进程 + 所有子 Deployment 进程的 CPU/Memory。
   - 服务被调用时，直接返回内存中的最新聚合值。

2. **Scheduler 端（Client）**：
   - 每次调度循环（Scheduler Loop）：
     1. 从 `terminalInfos` 获取所有 `activeNodeUnits` 的 `terminal_id`。
     2. 并发向所有 active node unit 发起 `NodeUnit/InspectResourceUsage` 请求（带超时）。
     3. 收集响应，构建 `resourceUsage` Map。
     4. 若请求超时或失败，该节点资源指标视为 0（或保留上一帧，视策略而定；当前简化为忽略或 0）。

#### 优势

- **降低网络噪音**：仅在 Scheduler 需要决策时产生流量，且是点对点流量，不再广播。
- **解耦**：Host 无需感知资源字段，仅作为 RPC 路由器。
- **实时性**：Scheduler 可根据需要调整轮询频率，不受 Tags 推送频率限制。

#### Context 扩展

```typescript
export interface ClaimMetricContext {
  deployments: IDeployment[];
  deploymentCounts: Map<string, number>;
  resourceUsage: Map<string, { cpuPercent: number; memoryMb: number }>;
}
```

#### 资源采集逻辑（保持聚合逻辑）

```typescript
const collectTotalResourceUsage = async (...) => {
  // 1. 主进程 usage
  // 2. 遍历 mapDeploymentIdToProcess 获取子进程 usage (pidusage)
  // 3. sum(main + children)
};
```

#### Provider 实现

```typescript
const fetchResourceUsage = async (terminal, activeNodeUnits) => {
  // Promise.all( request('NodeUnit/InspectResourceUsage') )
  // return Map<address, usage>
};

// Scheduler 循环中调用 fetchResourceUsage 代替 loadResourceUsageFromTags
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

| 文件                              | 改动内容                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `apps/node-unit/src/index.ts`     | 1. 移除 tags 更新循环<br>2. 注册 `NodeUnit/InspectResourceUsage` 服务<br>3. 启动内部 ResourceCollector                       |
| `apps/node-unit/src/scheduler.ts` | 1. 移除 `loadResourceUsage` (from tags)<br>2. 新增 `fetchResourceUsage` (via RPC)<br>3. Scheduler Loop 增加并发 RPC 调用逻辑 |

#### 边界条件

- **tags 缺失/RPC 失败**：若 RPC 调用失败或超时，默认该节点资源为 0（偏向于被选中，促进负载均衡尝试）。
- **采集延迟**：ResourceCollector 定期更新内存快照，Service 调用返回最近一次快照，延迟可控（~1s）。
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

## 测试规范 (Test Specification)

### 1. 测试目标

验证 `apps/node-unit/src/scheduler.ts` 核心逻辑的正确性，覆盖以下关键行为：

| 测试领域     | 验证要点                                                 |
| ------------ | -------------------------------------------------------- |
| **失联检测** | 准确识别 `address` 不在 `activeNodeUnits` 中的部署       |
| **部署统计** | 按地址计数，正确排除 `address=''` 的记录                 |
| **抢占资格** | 策略正确选出最小值集合（v1）或最低评分（v2）             |
| **资源计算** | CPU/Memory 加权评分计算正确，RPC 失败返回 0 (或处理异常) |
| **策略选择** | 环境变量 `NODE_UNIT_CLAIM_POLICY` 正确切换策略           |
| **候选排序** | 遵循 `updated_at asc, created_at asc, id asc` 顺序       |
| **并发安全** | 一次仅抢占一个，`WHERE address=''` 条件保证幂等          |

### 2. 测试策略

采用 **纯函数单元测试 + 依赖注入** 策略：

```typescript
// 策略：导出内部函数，mock 外部依赖
export { loadActiveNodeUnits, getLostAddresses, buildDeploymentCounts }; // ← 新增导出
jest.mock('@yuants/sql'); // ← mock 数据库依赖
```

### 3. 测试用例规范

### 测试文件结构

```
apps/node-unit/src/
├── scheduler.ts           # 实现
└── scheduler.test.ts     # 新增测试文件
```

### 测试策略

采用 **纯函数单元测试 + 依赖注入** 策略：

1. **内部函数导出**：将关键纯函数（如 `loadActiveNodeUnits`, `buildDeploymentCounts`, `pickEligible` 等）从 `const` 改为 `export`，便于直接测试
2. **Mock 外部依赖**：使用 Jest mock 替换 `requestSQL`, `escapeSQL`, `terminalInfos$` 等 I/O 依赖
3. **策略接口测试**：验证 `ClaimMetricProvider` 和 `ClaimPolicy` 的正确实现

### 关键测试用例

#### 1. 失联检测逻辑

```typescript
it('identifies lost addresses when node-unit disappears', () => {
  const deployments = [
    { id: 'd1', address: 'addr1' },
    { id: 'd2', address: 'addr2' },
    { id: 'd3', address: 'addr3' },
  ];
  const activeNodeUnits = ['addr1', 'addr3'];
  const lost = getLostAddresses(deployments, activeNodeUnits);
  expect(lost).toEqual(['addr2']);
});
```

#### 2. 部署数量统计

```typescript
it('counts deployments per address (ignores empty address)', () => {
  const deployments = [
    { id: 'd1', address: 'addr1' },
    { id: 'd2', address: 'addr1' },
    { id: 'd3', address: 'addr2' },
    { id: 'd4', address: '' }, // 未指派
  ];
  const activeNodeUnits = ['addr1', 'addr2', 'addr3'];
  const counts = buildDeploymentCounts(deployments, activeNodeUnits);
  expect(counts.get('addr1')).toBe(2);
  expect(counts.get('addr2')).toBe(1);
  expect(counts.get('addr3')).toBe(0); // 没有部署
});
```

#### 3. 部署数量策略（v1）

```typescript
it('deployment_count policy picks node-units with minimum deployment', () => {
  const snapshots = new Map([
    ['addr1', [{ key: 'deployment_count', value: 2 }]],
    ['addr2', [{ key: 'deployment_count', value: 1 }]],
    ['addr3', [{ key: 'deployment_count', value: 1 }]],
  ]);
  const eligible = defaultClaimPolicy.pickEligible(['addr1', 'addr2', 'addr3'], snapshots);
  expect(eligible).toEqual(['addr2', 'addr3']); // 并列最少
});
```

#### 4. 资源使用策略（v2）

```typescript
it('resource_usage policy picks node-units with minimum weighted score', () => {
  const snapshots = new Map([
    ['addr1', [{ key: 'resource_usage', value: 45.2 }]], // CPU 30% + Memory 1024MB => 30*0.5 + 1*0.5 = 15.5
    ['addr2', [{ key: 'resource_usage', value: 22.1 }]],
  ]);
  const eligible = resourceOnlyPolicy.pickEligible(['addr1', 'addr2'], snapshots);
  expect(eligible).toEqual(['addr2']); // 资源占用更低
});
```

#### 5. 候选排序

```typescript
it('picks deployment candidates in deterministic order', async () => {
  const mockTerminal = {
    /* mock */
  };
  const deployments = [
    { id: 'd1', address: '', updated_at: '2025-01-02', created_at: '2025-01-01' },
    { id: 'd2', address: '', updated_at: '2025-01-01', created_at: '2025-01-01' }, // 更早的 updated_at
  ];

  // mock requestSQL 返回 deployments
  const candidate = await pickCandidateDeployment(mockTerminal);
  expect(candidate?.id).toBe('d2'); // updated_at 更早的优先
});
```

#### 6. 策略配置化

```typescript
it('uses environment variable to select policy', () => {
  process.env.NODE_UNIT_CLAIM_POLICY = 'resource_usage';
  const policyName = process.env.NODE_UNIT_CLAIM_POLICY ?? 'deployment_count';
  expect(policyName).toBe('resource_usage');
  // 验证 policies[policyName] 返回正确策略
});
```

### 需要导出的函数（用于测试）

| 函数                              | 作用                             | 测试重点             |
| --------------------------------- | -------------------------------- | -------------------- |
| `fetchResourceUsage`              | 并发 RPC 获取资源用量            | Mock Client Request  |
| `resolveNodeUnitTerminalIds`      | 建立 address -> terminal_id 映射 | 正确解析 tags        |
| `getLostAddresses`                | 识别失联地址                     | 集合差集计算         |
| `buildDeploymentCounts`           | 统计各地址部署数                 | 空地址过滤、计数     |
| `buildSnapshots`                  | 构建指标快照                     | Provider 评估调用    |
| `pickCandidateDeployment`         | 选择待抢占部署                   | SQL 排序逻辑（mock） |
| `claimDeployment`                 | 执行抢占                         | SQL 条件更新（mock） |
| `defaultClaimPolicy.pickEligible` | v1 策略                          | 最小值集合           |
| `resourceOnlyPolicy.pickEligible` | v2 策略                          | 加权评分比较         |

### 集成测试（可选）

```typescript
describe('scheduler integration', () => {
  it('releases lost deployments and claims one per cycle', async () => {
    // 模拟 terminalInfos$ 变化
    // 验证 releaseLostDeployments 和 claimDeployment 调用
  });

  it('respects NODE_UNIT_SCHEDULER_INTERVAL_MS', () => {
    // 验证 interval 间隔配置
  });
});
```

### 测试配置

- **测试框架**：Jest（与现有 `logging.test.ts` 保持一致）
- **Mock 策略**：`jest.mock('@yuants/sql')` 替换 `requestSQL`, `escapeSQL`
- **环境变量**：每个测试用例前设置/清除 `process.env`
- **异步测试**：使用 `async/await` 配合 mock resolved value

### 验证要点

- [ ] 失联检测准确识别 `address` 不在 `activeNodeUnits` 中的部署
- [ ] 部署数量统计排除 `address=''` 的记录
- [ ] `deployment_count` 策略正确选出最小值集合
- [ ] `resource_usage` 策略正确计算加权评分并比较
- [ ] 候选排序遵循 `updated_at asc, created_at asc, id asc`
- [ ] 环境变量 `NODE_UNIT_CLAIM_POLICY` 正确切换策略
- [ ] 缺失资源 tags 时返回 `value: 0`

---

## 阶段概览

1. **调研** - 2 个任务
2. **设计（RFC）** - 1 个任务
3. **实现（待 review）** - 1 个任务
