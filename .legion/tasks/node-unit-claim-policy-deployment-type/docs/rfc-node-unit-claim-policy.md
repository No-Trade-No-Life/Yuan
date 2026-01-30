# `node-unit` 调度：抢占策略与 `deployment` 类型

## 摘要

本文档定义 `node-unit` 调度在新增 `NODE_UNIT_CLAIM_POLICY=none` 与 `deployment.type` 字段后的行为、状态机、数据模型、错误语义与迁移方案。本文档是本次改动的唯一设计真源。

## 背景与动机

现状：

- 调度循环会根据 `NODE_UNIT_CLAIM_POLICY` 选择抢占策略，并通过更新 `deployment.address` 完成 `claim`/`assign`。
- `deployment` 只区分 `enabled`/`disabled`，无法表达常驻每个节点的 `daemon` 形态。

问题：

- 无法关闭抢占/分配逻辑以满足“只运行本地已绑定部署”的场景。
- 无法表达“每个 `node-unit` 都应运行的常驻服务”，导致需要人为复制部署记录或强行绑定 `address`。

## 目标与非目标

目标：

- 支持 `NODE_UNIT_CLAIM_POLICY=none`（不区分大小写）以禁用抢占与分配。
- `deployment` 引入 `type` 字段，取值为 `daemon` 与 `deployment`。
- `daemon` 类型不参与抢占、不绑定 `address`；启用时每个 `node-unit` 至少运行一个实例。
- 明确调度/抢占/地址绑定规则、失联处理、迁移与回滚方案。

非目标：

- 不引入新的调度拓扑或跨集群协调机制。
- 不修改现有部署执行与日志读取协议，仅调整调度与数据模型。
- 不在本文档内定义 `UI` 或外部控制面板的改动。

## 术语与定义

- `node-unit`：运行调度循环与本地部署执行器的节点进程。
- `deployment`：数据库表 `deployment` 中的一条部署记录。
- `daemon`：`deployment.type=daemon` 的记录，表示每个 `node-unit` 都应运行的常驻服务。
- `deployment`（类型）：`deployment.type=deployment` 的记录，表示可被调度与抢占的普通部署。
- 活跃 `node-unit`：`Terminal` 的活跃列表中带有 `node_unit` 标签且包含 `node_unit_address` 的节点。
- `claim`：调度循环通过更新 `deployment.address` 完成“占用/分配”的动作。
- `NODE_UNIT_CLAIM_POLICY=none`：调度循环保持运行，但不执行 `claim`/`assign`。

## 行为要求

R1. 当 `NODE_UNIT_CLAIM_POLICY` 的值为 `none`（大小写不敏感）时，调度循环必须跳过所有 `claim`/`assign` 动作，不得更新 `deployment.address`。
R2. 当 `NODE_UNIT_CLAIM_POLICY=none` 时，调度循环必须继续读取部署列表并驱动本地执行器启停；可以继续采样并记录资源指标，但不得尝试选择候选部署。
R3. `deployment.type` 必须为 `daemon` 或 `deployment`，并以 `TEXT` 存储。
R4. 迁移后历史记录必须被标记为 `deployment.type=deployment`。
R5. `daemon` 类型不得参与抢占；调度循环不得因 `daemon` 记录执行 `claim`/`assign`。
R6. `daemon` 类型不得绑定 `address`；任何 `address` 绑定逻辑仅适用于 `deployment.type=deployment`。
R7. 当 `deployment.type=daemon` 且 `enabled=true` 时，每个 `node-unit` 必须在本地保证该 `daemon` 运行且不重复启动（以 `deployment.id` 作为唯一性键）。
R8. 当 `deployment.type=deployment` 且 `enabled=true` 时，现有 `address` 绑定与抢占逻辑必须保持语义一致。
R9. 失联节点检测与回收仅针对 `deployment.type=deployment` 生效；`daemon` 不得进入失联回收流程。
R10. `IDeployment` 必须增加 `type: 'daemon' | 'deployment'` 字段，并与数据库一致。
R11. 若发现不合法的 `deployment.type` 值，调度循环必须记录可观测错误并跳过该记录。
R12. 当 `deployment.type=daemon` 且 `address` 非空时，调度循环必须记录可观测错误并忽略该 `address`。
R13. 当 `NODE_UNIT_CLAIM_POLICY=none` 时，调度循环不得执行任何会写入 `deployment.address` 的路径（包含失联回收与未绑定分配）。

## 协议概览

端到端流程：

1. `node-unit` 启动并建立 `Terminal` 连接，开始调度循环。
2. 调度循环读取当前 `deployment` 列表与活跃 `node-unit` 列表。
3. 若 `NODE_UNIT_CLAIM_POLICY=none`，仍需读取部署列表并驱动本地执行器，但跳过候选选择与 `claim`，且不得更新 `deployment.address`（R1、R2、R13）。
4. 对 `deployment.type=deployment` 执行候选选择与 `claim`；对 `deployment.type=daemon` 不执行 `claim`（R5）。
5. 本地执行器按本节点可见的部署集启动/停止进程：
   - `deployment` 类型：基于 `address` 绑定。
   - `daemon` 类型：基于 `enabled` 状态，且不依赖 `address`。

## 状态机

### `deployment` 类型（`deployment.type=deployment`）

状态：

- `UNASSIGNED`：`address=''` 且 `enabled=true`。
- `ASSIGNED`：`address=<node-unit>` 且 `enabled=true`。
- `DISABLED`：`enabled=false`。
- `LOST`：`address=<node-unit>` 且该 `node-unit` 不在活跃列表。

迁移与触发：

- `UNASSIGNED` -> `ASSIGNED`：调度循环 `claim` 成功。
- `ASSIGNED` -> `LOST`：活跃列表不包含该 `address`。
- `LOST` -> `ASSIGNED`：调度循环在回收逻辑中重新 `claim`。
- `ASSIGNED`/`UNASSIGNED` -> `DISABLED`：人为关闭。
- `DISABLED` -> `UNASSIGNED`：人为启用且 `address` 为空。

### `daemon` 类型（`deployment.type=daemon`）

状态：

- `ENABLED`：`enabled=true`。
- `DISABLED`：`enabled=false`。

迁移与触发：

- `DISABLED` -> `ENABLED`：人为启用，`node-unit` 必须在本地启动实例（R7）。
- `ENABLED` -> `DISABLED`：人为停用，本地应停止实例。

## 数据模型

### 表结构

- 新增字段：`deployment.type TEXT NOT NULL DEFAULT 'deployment'`。
- 取值集合：`daemon`、`deployment`。
- 兼容策略：新增字段时设置默认值，并对历史数据统一回填为 `deployment`（R4）。

### 字段语义

- `type=deployment`：保留现有 `address` 绑定与抢占语义（R8）。
- `type=daemon`：`address` 必须为空字符串，调度与执行逻辑必须忽略 `address`（R6、R12）。

### 兼容策略

- 旧版本 `node-unit` 只识别 `deployment`；新增字段保持默认值可确保旧版本仍工作。
- 新版本在读取 `type` 时需对未知值降级处理并记录错误（R11）。

## 调度与抢占规则

### 抢占策略规则

- 当 `NODE_UNIT_CLAIM_POLICY=none`：调度循环不得执行 `claim`/`assign`，不更新 `deployment.address`，但必须继续驱动本地执行器（R1、R2）。
- 当 `NODE_UNIT_CLAIM_POLICY` 为其他值：继续沿用现有策略（`deployment_count`、`resource_usage`）。

### `address` 绑定规则

- 仅 `deployment.type=deployment` 参与 `address` 绑定与抢占（R6、R8）。
- `daemon` 的实例分配不依赖 `address`；执行器应基于 `enabled` 与 `type` 判定是否启动，并确保每个 `deployment.id` 本地最多一个实例（R7）。

### `daemon` 实例规则

- 每个 `node-unit` 对启用的 `daemon` 记录在本地启动实例，并以 `deployment.id` 去重（R7）。
- `daemon` 不依赖活跃列表进行全局协调，避免跨节点一致性要求。

### 失联处理与回收

- 失联检测与回收只适用于 `deployment.type=deployment`（R9）。
- `daemon` 不参与失联回收，因为不绑定 `address`。

## 错误语义

错误码与可恢复性：

- `ERR_INVALID_TYPE`：读取到非 `daemon`/`deployment` 的 `type` 值。可恢复性：需人工修正数据；调度循环必须跳过该记录（R11）。
- `ERR_DAEMON_ADDRESS_SET`：`deployment.type=daemon` 且 `address` 非空。可恢复性：需人工修正数据；调度循环忽略 `address` 并记录错误（R12）。
- `ERR_CLAIM_CONFLICT`：`claim` 更新被并发抢占失败。可恢复性：可重试（现有行为）。
- `ERR_POLICY_DISABLED`：`NODE_UNIT_CLAIM_POLICY=none` 导致跳过 `claim`。可恢复性：无需重试，记录一次即可。
- `ERR_DAEMON_MISSING`：本地执行器检测到启用的 `daemon` 未运行。可恢复性：需执行器自修复或人工介入。

## 安全性考虑

- 滥用：`daemon` 在每个 `node-unit` 运行，权限与资源消耗扩大；必须依赖既有 `TRUSTED_PACKAGE_REGEXP` 与包信任机制。
- 权限：`daemon` 仍应遵守 `node-unit` 的运行权限与环境隔离策略。
- 输入校验：对 `deployment.type` 进行白名单校验，防止异常值进入调度逻辑（R11）。
- 资源耗尽：启用多个 `daemon` 可能放大资源消耗，应通过指标与报警监控。

## 向后兼容与发布

迁移步骤：

1. `SQL` 增加 `deployment.type` 字段，默认值为 `deployment`。
2. 历史记录回填为 `deployment`（依赖默认值即可完成）。
3. 部署新版本 `node-unit` 以识别 `daemon` 与 `none` 策略。
4. 仅在全量升级后创建并启用 `daemon` 记录，避免旧版本误抢占；升级完成前 `daemon` 必须保持 `enabled=false`。

回滚策略：

- 回滚 `node-unit` 版本前必须禁用或转换 `daemon` 记录为 `deployment`，否则旧版本会错误参与抢占。
- 若需要回滚 `SQL`，可保留 `type` 字段但停止写入 `daemon` 值；无需删除列以避免数据丢失。

灰度：

- 先在少量 `node-unit` 启用 `NODE_UNIT_CLAIM_POLICY=none` 验证不抢占逻辑。
- 仅在全量升级后添加少量 `daemon` 记录验证每节点实例数与资源占用。

## 可测试性

R1: 设置 `NODE_UNIT_CLAIM_POLICY=none` 后，调度循环不应产生 `update deployment set address` 的 `SQL`。
R2: `NODE_UNIT_CLAIM_POLICY=none` 时仍可采集资源使用日志或指标，且本地已绑定 `deployment` 与启用的 `daemon` 仍持续运行。
R3/R4: 迁移后新增记录默认 `type=deployment`，历史记录 `type=deployment`。
R5/R6: `daemon` 记录不触发 `claim`，并且 `address` 不被读取为绑定条件。
R7: 启用的 `daemon` 在每个 `node-unit` 本地仅启动一个实例（以 `deployment.id` 去重）。
R8/R9: `deployment` 的失联回收行为与现有逻辑一致，`daemon` 不参与。
R10: `IDeployment` 类型包含 `type` 字段并可被 `API` 文档导出。
R11: 非法 `type` 触发错误日志且跳过。
R12: `daemon` 记录带非空 `address` 时记录错误并忽略该 `address`。
R13: `NODE_UNIT_CLAIM_POLICY=none` 禁止任何 `address` 写入路径。

## 未决问题

- 是否需要为 `daemon` 增加唯一性约束（例如同 `package_name@version` 只允许一条）以避免重复实例？
- 是否需要限制 `daemon` 启动速率或并发？
- `daemon` 是否允许更细粒度的选择器（例如按标签）？

## 计划

核心流程：

- 调度循环在 `NODE_UNIT_CLAIM_POLICY=none` 时跳过候选选择与 `claim`。
- `daemon` 仅由执行器在每个 `node-unit` 上按 `enabled` 启停，不写入 `address`。
- `deployment` 继续使用现有 `address` 绑定与抢占逻辑。

接口定义：

- `IDeployment` 增加字段 `type: 'daemon' | 'deployment'`。
- `deployment` 表新增字段 `type TEXT NOT NULL DEFAULT 'deployment'`。

文件变更明细：

- `apps/node-unit/src/scheduler.ts`：识别抢占策略 `none` 与 `deployment.type` 的调度差异。
- `apps/node-unit/src/index.ts`：执行器区分 `daemon` 与 `deployment` 的本地启动策略。
- `libraries/deploy/src/index.ts`：更新 `IDeployment`。
- `tools/sql-migration/sql/deployment.sql`：新增 `type` 字段与默认值。
- `apps/node-unit/etc/node-unit.api.md`、`apps/node-unit/README.md`、`docs/zh-Hans/packages/@yuants-node-unit.md`：更新文档与环境变量说明。

验证策略：

- 覆盖 R1-R11 行为，校验迁移默认值与 `daemon` 实例数。
- 验证迁移后旧记录默认 `type=deployment`。
- 验证 `daemon` 实例在 `node-unit` 上一致启动与停止。
