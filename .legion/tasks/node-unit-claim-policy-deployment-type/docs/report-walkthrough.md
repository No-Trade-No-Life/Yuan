# Node Unit Claim Policy & Deployment Type 变更报告

## 1. 目标与范围

**Goal**: 支持 `node-unit` 的非抢占模式 (`NODE_UNIT_CLAIM_POLICY=none`) 以及守护进程模式 (`deployment.type=daemon`)，以满足无需绑定地址的集群调度需求。

**Scope**:

- `apps/node-unit/src/scheduler.ts`
- `apps/node-unit/src/index.ts`
- `libraries/deploy/src/index.ts`
- `tools/sql-migration/sql/deployment.sql`
- `apps/node-unit/src/scheduler.test.ts`
- `apps/node-unit/README.md`
- `docs/zh-Hans/packages/@yuants-node-unit.md`

## 2. 设计摘要

基于 [RFC: Node Unit Claim Policy](rfc-node-unit-claim-policy.md)，本次变更引入了以下核心概念：

1.  **Claim Policy (`none`)**:

    - 通过环境变量 `NODE_UNIT_CLAIM_POLICY=none` 启用。
    - 启用时，调度器不再执行 `claim` (写入 `address`) 操作。
    - 仅执行本地进程维护和指标收集。

2.  **Deployment Type (`daemon` vs `deployment`)**:
    - **`deployment`** (默认): 保持原有行为，需要绑定 `address`，参与抢占。
    - **`daemon`**: 不绑定 `address`，不参与抢占。
    - **执行逻辑**: 每个 `node-unit` 节点会自动拉起所有 `enabled=true` 的 `daemon` 类型部署。

## 3. 改动清单

### 核心模块

| 模块          | 文件                                     | 变更说明                                                                                                                                                                 |
| :------------ | :--------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scheduler** | `apps/node-unit/src/scheduler.ts`        | 1. `runSchedulerCycle` 在 policy=none 时跳过 claim。<br>2. 过滤 `daemon` 类型，使其不进入抢占逻辑。<br>3. 增加非法 `address` 绑定的错误日志 (`ERR_DAEMON_ADDRESS_SET`)。 |
| **Runtime**   | `apps/node-unit/src/index.ts`            | 1. SQL 查询改为拉取 `address` 匹配的 `deployment` **或** 所有 `daemon`。<br>2. 增加对 `daemon` 类型的本地执行支持。                                                      |
| **Schema**    | `tools/sql-migration/sql/deployment.sql` | 新增 `type` 字段 (TEXT)，默认值为 `'deployment'`。                                                                                                                       |
| **Library**   | `libraries/deploy/src/index.ts`          | 更新 `IDeployment` 接口，增加 `type: 'daemon' \| 'deployment'`。                                                                                                         |

### 文档与测试

- **文档**: 更新了 `apps/node-unit/README.md` 和中文文档，增加了环境变量和 `deployment` 类型的配置说明。
- **测试**: `apps/node-unit/src/scheduler.test.ts` 增加了针对 `none` 策略和 `daemon` 过滤的单元测试。

## 4. 如何验证

### 自动化测试结果

本次变更包含完整的单元测试覆盖。

**测试执行**:

```bash
heft test --test-path-pattern lib/scheduler.test.js
```

**测试结果**:

> **PASS** (28 tests passed)
>
> - Verified: `none` policy skips claim.
> - Verified: `daemon` type is ignored by `getLostAddresses` and `claimDeployment`.
> - Verified: `daemon` type is ignored by `deployment_count` metric.

### 手动验证步骤

1.  **设置环境**:

    - 设置环境变量 `NODE_UNIT_CLAIM_POLICY=none`。
    - 启动 `node-unit`。

2.  **验证日志**:

    - 观察日志中出现 `DeploymentClaimSkipped`，且 `reason` 为 `policy_disabled`。
    - 预期: 数据库中 `deployment` 表的 `address` 字段不会发生变化。

3.  **验证 Daemon**:
    - 插入一条 `type='daemon'` 且 `enabled=true` 的部署记录。
    - 预期: 所有连接的 `node-unit` 均启动该进程，且不修改该记录的 `address`。

## 5. 可观测性

新增以下关键日志/指标用于监控：

- **Logs**:
  - `DeploymentClaimSkipped`: 当策略为 `none` 时触发。
  - `DeploymentDaemonAddressSet` (Error): 当 `daemon` 类型记录被错误地设置了 `address` 时触发。
  - `DeploymentTypeInvalid` (Error): 当读取到未知的 `type` 时触发。

## 6. 风险与回滚

- **风险**:

  - 混合版本部署风险：旧版本 `node-unit` 无法识别 `daemon` 类型，可能会将其视为普通部署并抢占（因为旧代码可能只过滤 `enabled=true`）。
  - **缓解措施**: 在全量升级 `node-unit` 之前，务必保持 `daemon` 记录的 `enabled=false`。

- **回滚**:
  - 1. 将所有 `daemon` 类型的部署设置为 `enabled=false` 或删除。
  - 2. 回滚代码版本。
  - 3. (可选) 回滚数据库字段（通常保留字段不影响旧版本运行）。

## 7. 未决项与下一步

- [ ] 监控生产环境升级后的指标，确保无异常 `claim` 行为。
- [ ] 逐步启用 `daemon` 部署进行灰度验证。
