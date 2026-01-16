# Git 变更报告（0098f6b84..06178a6d3）

## 1. 概览

- **时间范围**：2026-01-15 至 2026-01-15
- **提交数量**：4 个提交
- **主要贡献者**：Siyuan Wang (3), humblelittlec1[bot] (1)
- **热点目录**：apps (12 files), .legion (5 files), common (4 files), scripts (1 file)
- **生成时间**：2026-01-16T00:06:13.139Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 NodeUnit 部署调度与故障转移机制

**相关提交**：`9f6b9f282`, `b22217459`, `06178a6d3`
**作者**：Siyuan Wang

**设计意图**：
实现 node-unit 的部署调度与故障转移机制，确保在节点失联时自动释放部署地址，并允许其他节点按最少部署数或资源使用率抢占未指派部署。此设计解决了分布式环境中节点故障导致的部署僵化问题，通过基于 terminalInfos$ 的失联检测、抢占指标接口抽象（支持 deployment_count 和 resource_usage 两种策略）以及一次仅抢占一个的并发策略，实现了高可用且公平的部署调度。v2 扩展支持 CPU/内存资源优先调度，为未来多维度调度策略奠定基础。

**核心代码**：
[scheduler.ts:L7-L30](apps/node-unit/src/scheduler.ts#L7-L30)

```typescript
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
```

**影响范围**：

- 影响模块：`apps/node-unit`, `.legion/tasks/node-unit-deployment-failover-rfc`
- 需要关注：调度间隔默认 5s，可通过 `NODE_UNIT_SCHEDULER_INTERVAL_MS` 环境变量覆盖；策略可通过 `NODE_UNIT_CLAIM_POLICY` 在 `deployment_count` 和 `resource_usage` 间切换；资源上报聚合 node-unit 主进程+所有子 deployment 进程的 CPU/Memory

**提交明细**：

- `9f6b9f282`: 实现 node-unit 部署调度循环，支持失联检测、地址释放和最少部署数抢占策略
- `b22217459`: 扩展调度器支持资源使用率策略，node-unit 上报 CPU/内存到 terminalInfo.tags
- `06178a6d3`: 实现 scheduler 单元测试，归档任务并更新相关文档

### 2.2 版本发布与文档更新

**相关提交**：`1cd634f89`
**作者**：humblelittlec1[bot]

**设计意图**：
自动化版本发布流程，更新相关包的版本号和变更日志。此提交由 GitHub Actions 机器人自动生成，确保版本号一致性并维护规范的变更记录。对于 `@yuants/app-asg-eventbridge-notifier` 从 0.1.0 升级到 0.2.0，`@yuants/node-unit` 从 0.13.11 升级到 0.14.0，同时清理临时的变更记录文件，保持仓库整洁。

**核心代码**：
[package.json:L3](apps/node-unit/package.json#L3)

```json
{
  "version": "0.14.0"
}
```

**影响范围**：

- 影响模块：`apps/asg-eventbridge-notifier`, `apps/node-unit`, `common/changes`
- 需要关注：版本号变更影响依赖管理；CHANGELOG 文件自动生成，不应手动修改

**提交明细**：

- `1cd634f89`: 更新 asg-eventbridge-notifier 和 node-unit 版本号，生成 CHANGELOG 文件

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `9f6b9f282` | Siyuan Wang | feat(node-unit): implement deployment failover and scheduling logic (#2506) | 2.1 |
| 2 | `b22217459` | Siyuan Wang | feat(node-unit): implement resource usage-based scheduling and reporting (#2507) | 2.1 |
| 3 | `1cd634f89` | humblelittlec1[bot] | chore: bump version (#2508) | 2.2 |
| 4 | `06178a6d3` | Siyuan Wang | feat(node-unit): update task status and implement scheduler unit tests (#2509) | 2.1 |

> ✅ 确认：所有 4 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| Siyuan Wang | 3 | NodeUnit 调度与故障转移 | `9f6b9f282`, `b22217459`, `06178a6d3` |
| humblelittlec1[bot] | 1 | 版本发布与自动化 | `1cd634f89` |

## 4. 技术影响与风险

### 兼容性影响

- **无破坏性变更**：调度器作为新增功能，不影响现有部署绑定机制
- **环境变量扩展**：新增 `NODE_UNIT_SCHEDULER_INTERVAL_MS`, `NODE_UNIT_CLAIM_POLICY`, `NODE_UNIT_CPU_WEIGHT`, `NODE_UNIT_MEMORY_WEIGHT` 等配置项，向后兼容

### 配置变更

- **新增配置**：调度间隔、策略选择、资源权重等环境变量
- **Legion 任务归档**：`node-unit-deployment-failover-rfc` 任务状态从 active 改为 archived

### 性能影响

- **数据库负载**：每个 node-unit 实例每 5s 执行一次 `SELECT * FROM deployment WHERE enabled = true` 查询，增加 PostgreSQL/TimescaleDB 负载
- **资源监控开销**：node-unit 主进程每 5s 采集自身和所有子 deployment 进程的 CPU/Memory 使用率（通过 `pidusage`），增加系统调用开销
- **网络流量**：terminalInfo.tags 定期更新（包含 CPU/内存指标）增加 Host 与 node-unit 间的 WebSocket 消息流量
- **并发优化**：一次仅抢占一个部署的设计避免数据库锁竞争，但多 node-unit 并发执行 `UPDATE ... WHERE address=''` 可能产生轻微竞争

### 测试覆盖

- **新增单元测试**：`apps/node-unit/src/scheduler.test.ts` 包含 29 个测试用例，覆盖失联检测、部署统计、抢占资格、资源计算、策略选择等核心逻辑
- **E2E 测试报告**：生成 `apps/node-unit/reports/node-unit-portal-e2e-report.md` 和 `apps/node-unit/reports/node-unit-portal-resource-usage-e2e-report.md` 验证实际行为
- **测试策略**：采用纯函数导出 + 依赖 mock 策略，便于维护和扩展

---

**报告生成说明**：本报告基于 `docs/reports/git-changes-2026-01-16.json` 数据生成，严格遵循 git-changes-reporter skill 的三元组结构要求，确保所有提交完整覆盖。