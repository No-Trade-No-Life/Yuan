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
5DAR2ZCrRAma2...                 | 12
GJ93nFZvTSbdDYo4...              | 9
```

- 最终分配：node-unit-1 = 12（`5DAR2Z...`），node-unit-2 = 9（`GJ93nF...`）。
- 全程仅对 `address=''` 的 deployment 进行抢占；未出现在线节点之间的“互抢”。

### Eligibility / Candidate / Claim 日志摘要

- `DeploymentClaimEligibility` 会记录：`eligible`、`policy`、`metrics`、`minMetrics`、`notEligibleReasons`。
- `DeploymentClaimSkipped` 原因：`not_eligible` / `no_candidate` / `claim_conflict`。
- `DeploymentClaimed` 记录实际 `claimant` 与 `deployment_id`。

### 每轮抢占资源快照

> 资源指标来自 `DeploymentClaimAttempt` 日志（CPU % / RSS MB），已包含 node-unit 主进程与子 deployment 进程的总和。

| 轮次 | 时间     | 抢占方      | deployment | node-unit-1 CPU/内存 | node-unit-2 CPU/内存 |
| ---- | -------- | ----------- | ---------- | -------------------- | -------------------- |
| 1    | 15:52:50 | node-unit-1 | 044142ec   | 0.15% / 140.92MB     | 0.16% / 141.91MB     |
| 2    | 15:52:55 | node-unit-2 | 2065a70f   | 0.02% / 138.19MB     | 0.02% / 137.55MB     |
| 3    | 15:53:00 | node-unit-2 | 2f75d1b7   | 0.15% / 132.11MB     | 0.02% / 113.95MB     |
| 4    | 15:53:05 | node-unit-1 | 44db947e   | 0.09% / 122.00MB     | 0.23% / 127.48MB     |
| 5    | 15:53:10 | node-unit-1 | 501f61f0   | 0.08% / 73.06MB      | 0.14% / 94.91MB      |
| 6    | 15:53:15 | node-unit-2 | 7278cd6d   | 0.23% / 108.45MB     | 0.21% / 120.42MB     |
| 7    | 15:53:20 | node-unit-1 | 781dd158   | 0.21% / 68.98MB      | 0.25% / 112.19MB     |
| 8    | 15:53:25 | node-unit-1 | 7c200e59   | 0.19% / 73.70MB      | 0.24% / 115.84MB     |
| 9    | 15:53:30 | node-unit-1 | 8aa6bf07   | 0.24% / 72.11MB      | 0.26% / 128.17MB     |
| 10   | 15:53:35 | node-unit-1 | 8f6837ae   | 0.27% / 75.13MB      | 0.22% / 130.44MB     |
| 11   | 15:53:40 | node-unit-2 | 90c64b8d   | 0.39% / 90.33MB      | 0.21% / 130.13MB     |
| 12   | 15:53:45 | node-unit-2 | a3b2e326   | 0.31% / 88.77MB      | 0.20% / 129.73MB     |
| 13   | 15:53:50 | node-unit-2 | a501d52d   | 0.35% / 89.67MB      | 0.28% / 122.31MB     |
| 14   | 15:53:55 | node-unit-1 | acb8f53d   | 0.29% / 91.20MB      | 0.33% / 134.20MB     |
| 15   | 15:54:00 | node-unit-2 | af0c4da9   | 0.43% / 87.08MB      | 0.35% / 135.94MB     |
| 16   | 15:54:05 | node-unit-1 | b6c8eee9   | 0.34% / 98.59MB      | 0.36% / 147.89MB     |
| 17   | 15:54:10 | node-unit-1 | c4b460d8   | 0.38% / 98.14MB      | 0.49% / 151.81MB     |
| 18   | 15:54:15 | node-unit-1 | cb80473f   | 0.38% / 101.56MB     | 0.42% / 156.66MB     |
| 19   | 15:54:20 | node-unit-2 | d000b32f   | 0.44% / 93.25MB      | 0.39% / 141.69MB     |
| 20   | 15:54:25 | node-unit-1 | f0ea885b   | 0.49% / 94.69MB      | 0.50% / 144.47MB     |
| 21   | 15:54:30 | node-unit-2 | f6951698   | 0.60% / 103.67MB     | 0.50% / 149.48MB     |

## 结论

- 资源调度策略下行为符合预期：
  - **仅抢占未指派 deployment**。
  - **每轮最多抢占一个**。
  - **未观察到在线节点间的抢占**。
- 分配结果为 12/9，资源评分驱动但仍保持动态均衡。

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

### Eligibility 示例

```
2026-01-16 15:52:50.542+08:00 DeploymentClaimEligibility {
  eligible: true,
  policy: [ 'resource_usage' ],
  activeNodeUnits: [
    '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT',
    'GJ93nFZvTSbdDYo4nR81WjPtEd6ovykN1xvYtX64fAd8'
  ],
  eligibleNodeUnits: [ '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT' ],
  metrics: { resource_usage: 0.14380859375 },
  minMetrics: { resource_usage: 0.14380859375 },
  notEligibleReasons: []
}
```

### Candidate 缺失示例

```
2026-01-16 15:52:45.544+08:00 DeploymentClaimSkipped { reason: 'no_candidate' }
```

### Claim 结果示例

```
2026-01-16 15:52:50.544+08:00 DeploymentClaimAttempt {
  deployment_id: '044142ec-6580-404f-96f9-f4695721acde',
  claimant: '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT',
  usage: {
    '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT': { cpuPercent: 0.15, memoryMb: 140.92 },
    GJ93nFZvTSbdDYo4nR81WjPtEd6ovykN1xvYtX64fAd8: { cpuPercent: 0.16, memoryMb: 141.91 }
  }
}
2026-01-16 15:52:50.549+08:00 DeploymentClaimed {
  deployment_id: '044142ec-6580-404f-96f9-f4695721acde',
  claimant: '5DAR2ZCrRAma2EeGUPRmcYvXUfpaWxSRq5kzWrjs3dmT'
}
```
