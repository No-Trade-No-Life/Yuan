# NodeUnit 资源调度 E2E 报告（Portal × 21）

## 概述

- **目标**：验证 `NODE_UNIT_CLAIM_POLICY=resource_usage` 下的抢占行为，确认仅抢占未指派 deployment，且不会影响在线节点的部署。
- **环境隔离**：所有进程使用 `env -i` 启动，不继承 `shell.nix` 环境变量。
- **脚本**：`scripts/e2e-node-unit-failover.sh`（通过 `NODE_UNIT_CLAIM_POLICY=resource_usage` 启动）
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
GJ93nFZvTSbdDYo4...              | 1
```

### 多轮后收敛

```
address                          | count
---------------------------------+------
GJ93nFZvTSbdDYo4...              | 11
5DAR2ZCrRAma2...                 | 10
```

- 最终分配：node-unit-1 = 10（`5DAR2Z...`），node-unit-2 = 11（`GJ93nF...`）。
- 全程仅对 `address=''` 的 deployment 进行抢占；未出现在线节点之间的“互抢”。

### 每轮抢占资源快照

> 资源指标来自 `DeploymentClaimAttempt` 日志（CPU % / RSS MB），已包含 node-unit 主进程与子 deployment 进程的总和。

| 轮次 | 时间     | 抢占方      | deployment | node-unit-1 CPU/内存 | node-unit-2 CPU/内存 |
| ---- | -------- | ----------- | ---------- | -------------------- | -------------------- |
| 1    | 12:17:05 | node-unit-2 | 0a13f8cb   | 0.38% / 61.25MB      | 0.29% / 60.06MB      |
| 2    | 12:17:10 | node-unit-2 | 0c2552fe   | 0.06% / 52.70MB      | 0.06% / 50.78MB      |
| 3    | 12:17:10 | node-unit-1 | 208a3920   | 0.06% / 52.70MB      | 0.28% / 63.19MB      |
| 4    | 12:17:15 | node-unit-1 | 33f87fe1   | 0.06% / 54.80MB      | 0.41% / 66.94MB      |
| 5    | 12:17:20 | node-unit-1 | 378f1ac1   | 0.32% / 65.63MB      | 0.41% / 71.11MB      |
| 6    | 12:17:25 | node-unit-1 | 3b31793a   | 0.29% / 68.58MB      | 0.46% / 99.66MB      |
| 7    | 12:17:30 | node-unit-2 | 3da34a74   | 0.58% / 76.56MB      | 0.46% / 99.66MB      |
| 8    | 12:17:35 | node-unit-2 | 402ceb6f   | 0.69% / 106.52MB     | 0.26% / 70.52MB      |
| 9    | 12:17:40 | node-unit-2 | 4d4e949a   | 0.55% / 93.52MB      | 0.47% / 72.56MB      |
| 10   | 12:17:45 | node-unit-1 | 58d9c9e8   | 0.56% / 107.28MB     | 0.66% / 112.50MB     |
| 11   | 12:17:50 | node-unit-2 | 6a7450cd   | 0.71% / 111.02MB     | 0.66% / 106.81MB     |
| 12   | 12:17:55 | node-unit-2 | 76637a5d   | 0.70% / 113.17MB     | 0.71% / 90.00MB      |
| 13   | 12:18:00 | node-unit-1 | 7c94e1b1   | 0.84% / 101.70MB     | 0.92% / 112.91MB     |
| 14   | 12:18:05 | node-unit-1 | 804ac8e9   | 0.66% / 106.78MB     | 1.03% / 112.05MB     |
| 15   | 12:18:10 | node-unit-1 | 88e50041   | 0.86% / 108.80MB     | 0.97% / 114.77MB     |
| 16   | 12:18:15 | node-unit-1 | 95bf8c90   | 0.93% / 128.14MB     | 1.06% / 127.30MB     |
| 17   | 12:18:20 | node-unit-2 | a59d6db5   | 1.04% / 116.58MB     | 1.00% / 128.11MB     |
| 18   | 12:18:25 | node-unit-2 | b1395878   | 1.14% / 140.56MB     | 0.88% / 142.81MB     |
| 19   | 12:18:30 | node-unit-2 | caa4c5cd   | 1.10% / 139.20MB     | 0.99% / 139.05MB     |
| 20   | 12:18:35 | node-unit-2 | e26fb79d   | 1.22% / 132.13MB     | 1.18% / 139.00MB     |
| 21   | 12:18:40 | node-unit-1 | eebc9676   | 0.98% / 136.66MB     | 1.17% / 137.38MB     |

## 结论

- 资源调度策略下行为符合预期：
  - **仅抢占未指派 deployment**。
  - **每轮最多抢占一个**。
  - **未观察到在线节点间的抢占**。
- 在资源指标相近的情况下，分配结果接近均衡（10/11）。

## 注意事项

- 运行部署进程时出现 `spawn /nix/store/.../node ENOENT`，说明本地隔离环境下无法找到 Nix 路径的 Node 可执行文件；不影响调度逻辑验证，但不适合验证部署实际启动。

## 产物与日志

- 日志目录：`.tmp/node-unit-e2e/`
  - `host.log`
  - `postgres-storage.log`
  - `node-unit-1.log`
  - `node-unit-2.log`
- 测试脚本：`scripts/e2e-node-unit-failover.sh`
