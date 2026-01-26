# NodeUnit 抢占调度 E2E 报告（Portal × 5）

## 概述

- **目标**：验证“仅抢占未指派 deployment、一次仅抢占一个、最少部署优先”在 5 个 portal deployment 场景下的行为。
- **环境隔离**：所有进程使用 `env -i` 启动，不继承 `shell.nix` 的环境变量。
- **脚本**：`scripts/e2e-node-unit-failover.sh`

## 环境与组件

- TimescaleDB（Docker 容器，`timescale/timescaledb:latest-pg15`）
- Host：`apps/host/lib/cli.js`
- Postgres Storage：`apps/postgres-storage/lib/cli.js`
- SQL 迁移：`tools/sql-migration/lib/cli.js`
- NodeUnit：两个实例（`node-unit-1` / `node-unit-2`）

## 测试输入

- 插入 5 条 deployment 记录：
  - `package_name = @yuants/app-portal`
  - `package_version = 0.2.26`
  - `enabled = true`

SQL（脚本内执行）：

```sql
insert into deployment (package_name, package_version, enabled)
select '@yuants/app-portal', '0.2.26', true from generate_series(1, 5);
```

## 观测结果

### 初始抢占

```
address                          | count
---------------------------------+------
                                 | 4
GJ93nFZvTSbdDYo4...              | 1
```

- 仅 1 条被抢占，其余 4 条保持 `address=''`。

### 下一轮抢占

```
address                          | count
---------------------------------+------
                                 | 3
5DAR2ZCrRAma2...                 | 1
GJ93nFZvTSbdDYo4...              | 1
```

- 两个 NodeUnit 各抢占 1 条，未指派仍有 3 条。

### 多轮抢占后（收敛）

```
address                          | count
---------------------------------+------
5DAR2ZCrRAma2...                 | 2
GJ93nFZvTSbdDYo4...              | 3
```

- 最终分配：node-unit-1 = 2，node-unit-2 = 3。
- 全程仅对 `address=''` 的 deployment 进行抢占，未发生在线节点间“互抢”。

## 结论

- 行为符合设计目标：
  - **仅抢占未指派 deployment**（`address=''`）。
  - **每轮最多抢占一个**。
  - **最少部署数优先**，最终分布接近均衡（2/3）。
- 未观察到对存活节点 deployment 的抢占。

## 产物与日志

- 日志目录：`.tmp/node-unit-e2e/`
  - `host.log`
  - `postgres-storage.log`
  - `node-unit-1.log`
  - `node-unit-2.log`
- 测试脚本：`scripts/e2e-node-unit-failover.sh`
