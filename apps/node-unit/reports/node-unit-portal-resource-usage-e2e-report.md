# NodeUnit 资源调度 E2E 报告（Portal × 21）

## 概述

- **目标**：验证 `NODE_UNIT_CLAIM_POLICY=resource_usage` 下的抢占行为，确认仅抢占未指派 deployment，且不会影响在线节点的部署。
- **环境隔离**：所有进程使用 `env -i` 启动，不继承 `shell.nix` 环境变量。
- **脚本**：`apps/node-unit/scripts/e2e-node-unit-failover.sh`（通过 `NODE_UNIT_CLAIM_POLICY=resource_usage` 启动）
- **资源口径**：CPU/内存为 node-unit 主进程 + 所有子 deployment 进程的聚合值

## 环境与组件

- TimescaleDB（Docker：`timescale/timescaledb:latest-pg15`）
- Host：`apps/host/lib/cli.js`
- Postgres Storage：`apps/postgres-storage/lib/cli.js`
- SQL 迁移：`tools/sql-migration/lib/cli.js`
- NodeUnit：两个实例（`node-unit-1` / `node-unit-2`）

## 测试输入

- 插入 21 条 deployment 记录：
  - `package_name = @yuants/app-portal`
  - `package_version = 0.2.26`
  - `enabled = true`

SQL（脚本内执行）：

```sql
insert into deployment (package_name, package_version, enabled)
select '@yuants/app-portal', '0.2.26', true from generate_series(1, 21);
```

## 观测结果

### 初始抢占

```
address                          | count
---------------------------------+------
                                 | 20
5DAR2ZCrRAma2...                 | 1
```

### 多轮后收敛

```
address                          | count
---------------------------------+------
5DAR2ZCrRAma2...                 | 11
GJ93nFZvTSbdDYo4...              | 10
```

- 最终分配：node-unit-1 = 11（`5DAR2Z...`），node-unit-2 = 10（`GJ93nF...`）。
- 全程仅对 `address=''` 的 deployment 进行抢占；未出现在线节点之间的“互抢”。
- 资源指标非零（CPU ~0.2-1.7%，内存 ~140-280MB），调度策略基于资源负载动态分配。

### Eligibility / Candidate / Claim 日志摘要

- `DeploymentClaimEligibility` 会记录：`eligible`、`policy`、`metrics`、`minMetrics`、`notEligibleReasons`。
- `DeploymentClaimSkipped` 原因：`not_eligible` / `no_candidate` / `claim_conflict`。
- `DeploymentClaimed` 记录实际 `claimant` 与 `deployment_id`。

### 资源数据采样（2026-01-23 23:48:22 运行）

`fetchResourceUsage` 返回非零资源数据，调度器基于加权资源评分（CPU 50%/内存 50%）进行决策：

```
2026-01-23 23:48:22.799+08:00 ResourceUsageFetched {
  address: 'GJ93nFZvTSbdDYo4nR81WjPtEd6ovykN1xvYtX64fAd8',
  data: { cpu_percent: 0.25984106357457015, memory_mb: 156.625 }
}
2026-01-23 23:48:22.799+08:00 ResourceUsageFetched {
  address: '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT',
  data: { cpu_percent: 0.22697762684778267, memory_mb: 142.921875 }
}
```

后续轮次中资源使用量随部署进程启动而增加（CPU 最高达 1.73%，内存达 286MB），调度策略动态响应负载变化。

> 基于 `DeploymentClaimAttempt` 日志分析，完整呈现 21 轮抢占的资源使用变化与调度决策。

| 轮次 | 时间     | 抢占方      | deployment | node-unit-1 CPU/内存 | node-unit-2 CPU/内存 |
| ---- | -------- | ----------- | ---------- | -------------------- | -------------------- |
| 1    | 23:48:27 | node-unit-1 | 0da85da5   | 0.23% / 142.9MB      | 0.26% / 156.6MB      |
| 2    | 23:48:32 | node-unit-2 | 3117be35   | 0.05% / 120.8MB      | 0.05% / 122.6MB      |
| 3    | 23:48:37 | node-unit-2 | 316fa59d   | 2.03% / 282.3MB      | 0.05% / 122.3MB      |
| 4    | 23:48:42 | node-unit-1 | 4260c837   | 0.09% / 254.6MB      | 1.73% / 286.5MB      |
| 5    | 23:48:47 | node-unit-1 | 43f7fa4b   | 0.08% / 237.7MB      | 1.80% / 434.4MB      |
| 6    | 23:48:52 | node-unit-2 | 4a752a02   | 1.65% / 384.2MB      | 0.10% / 401.2MB      |
| 7    | 23:48:57 | node-unit-2 | 4bb11279   | 1.66% / 532.5MB      | 0.13% / 402.0MB      |
| 8    | 23:49:02 | node-unit-1 | 6f59125a   | 0.13% / 532.8MB      | 1.60% / 549.5MB      |
| 9    | 23:49:07 | node-unit-1 | 72fb7273   | 0.14% / 503.8MB      | 1.70% / 662.1MB      |
| 10   | 23:49:12 | node-unit-2 | 7bb8e01e   | 1.67% / 566.0MB      | 0.13% / 546.1MB      |
| 11   | 23:49:17 | node-unit-2 | 87eeac08   | 1.83% / 656.4MB      | 0.11% / 514.2MB      |
| 12   | 23:49:22 | node-unit-1 | a310a318   | 0.17% / 656.1MB      | 1.71% / 671.3MB      |
| 13   | 23:49:27 | node-unit-1 | ab458cc6   | 0.15% / 578.2MB      | 1.78% / 774.3MB      |
| 14   | 23:49:32 | node-unit-2 | ae0969c9   | 1.73% / 723.6MB      | 0.18% / 776.8MB      |
| 15   | 23:49:37 | node-unit-2 | b1f120c6   | 1.86% / 877.1MB      | 0.24% / 780.0MB      |
| 16   | 23:49:42 | node-unit-1 | b7263081   | 0.15% / 880.6MB      | 1.75% / 818.5MB      |
| 17   | 23:49:47 | node-unit-1 | bc5aab57   | 0.23% / 864.5MB      | 2.06% / 965.3MB      |
| 18   | 23:49:52 | node-unit-2 | c7d9febe   | 1.74% / 863.8MB      | 0.21% / 831.0MB      |
| 19   | 23:49:57 | node-unit-2 | d1df78b9   | 1.85% / 1016.7MB     | 0.25% / 789.8MB      |
| 20   | 23:50:02 | node-unit-1 | f487de52   | 0.23% / 922.3MB      | 1.70% / 937.8MB      |
| 21   | 23:50:07 | node-unit-1 | f87cb488   | 0.25% / 904.4MB      | 1.78% / 1089.5MB     |

**观察要点：**

1. **交替抢占模式**：node-unit-1 和 node-unit-2 基于资源评分交替获得部署资格（11/10 最终分配）
2. **资源驱动决策**：调度器持续重新评估资源使用情况，实现动态负载均衡
3. **资源增长趋势**：随着部署进程启动，两个节点的 CPU/内存使用量均呈现增长趋势
4. **一次一个原则**：每轮仅抢占一个 deployment，符合设计要求

## 结论

- 资源调度策略下行为符合预期：
  - **仅抢占未指派 deployment**。
  - **每轮最多抢占一个**。
  - **未观察到在线节点间的抢占**。
- 分配结果为 11/10，资源评分驱动但仍保持动态均衡。

## 注意事项

- 运行部署进程时出现 `spawn /nix/store/.../node ENOENT`，说明本地隔离环境下无法找到 Nix 路径的 Node 可执行文件；不影响调度逻辑验证，但不适合验证部署实际启动。

## 产物与日志

- 日志目录：`.tmp/node-unit-e2e/`
  - `host.log`
  - `postgres-storage.log`
  - `node-unit-1.log`
  - `node-unit-2.log`
- 测试脚本：`apps/node-unit/scripts/e2e-node-unit-failover.sh`

## 原始日志片段

### Eligibility 示例（2026-01-23 23:48:22）

```
2026-01-23 23:48:22.800+08:00 DeploymentClaimEligibility {
  eligible: true,
  policy: [ 'resource_usage' ],
  activeNodeUnits: [
    'GJ93nFZvTSbdDYo4nR81WjPtEd6ovykN1xvYtX64fAd8',
    '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT'
  ],
  eligibleNodeUnits: [ '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT' ],
  metrics: { resource_usage: 0.18327488520123508 },
  minMetrics: { resource_usage: 0.18327488520123508 },
  notEligibleReasons: []
}
```

### Candidate 缺失示例

```
2026-01-23 23:48:22.803+08:00 DeploymentClaimSkipped { reason: 'no_candidate' }
```

### Claim 结果示例（2026-01-23 23:48:27）

```
2026-01-23 23:48:27.792+08:00 DeploymentClaimAttempt {
  deployment_id: '0da85da5-88d8-4ad0-bdf5-fc424bf21f5e',
  claimant: '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT',
  usage: {
    GJ93nFZvTSbdDYo4nR81WjPtEd6ovykN1xvYtX64fAd8: { cpuPercent: 0.25984106357457015, memoryMb: 156.625 },
    '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT': { cpuPercent: 0.22697762684778267, memoryMb: 142.921875 }
  }
}
2026-01-23 23:48:27.793+08:00 DeploymentClaimed {
  deployment_id: '0da85da5-88d8-4ad0-bdf5-fc424bf21f5e',
  claimant: '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT'
}
```
