# Node-Unit 调度与 Deployment/Daemon 改进设计 RFC

## Abstract

本文提出 node-unit 在 deployment/daemon 调度上的改进协议与数据模型，目标是在保持信任包机制与稳定性优先原则的前提下，引入 lease/heartbeat、期望副本与选择器语义，完善容错、扩缩容、幂等与观测。RFC 覆盖端到端流程、状态机、数据模型、错误语义、迁移与回滚，并给出可测试的 MUST 条款。

## Motivation

当前实现以 `deployment` 表的 `type` 与 `address` 绑定为核心：daemon 不参与 claim，每个 node-unit 都执行所有 enabled 的 daemon；deployment 通过调度循环写 `address` 实现绑定。该设计简洁，但在租约失效、缩放、灰度升级、幂等恢复与观测一致性方面存在可预见风险（如 address 悬挂、重复拉起、扩缩容表达不足）。社区成熟方案（如 Kubernetes 的 Deployment/DaemonSet/Lease/Heartbeat/Controller loop）提供了可移植的设计原则。

## Goals & Non-Goals

### Goals

- 引入 lease/heartbeat 以提升容错与可恢复性。
- 支持 deployment 的期望副本语义（`desired_replicas`），并支持 daemon 的节点选择器语义，提升扩缩容与安全升级能力。
- 分离 deployment 与 daemon 调度流程，保留既有信任包机制。
- 提供可测试、可观测、可回滚的渐进式迁移路径。

### Non-Goals

- 不重写执行器或运行时沙箱机制。
- 不引入跨集群调度或多租户权限模型大改。
- 不在本 RFC 中实现完整的滚动升级控制器；只定义协议与最小流程。

### Scope

- `apps/node-unit/src/scheduler.ts`
- `apps/node-unit/src/index.ts`
- `apps/node-unit/src/scheduler.test.ts`
- `apps/node-unit/etc/node-unit.api.md`
- `apps/node-unit/README.md`
- `docs/zh-Hans/packages/@yuants-node-unit.md`
- `libraries/deploy/src/**`
- `tools/sql-migration/sql/deployment.sql`

## Definitions

- Deployment: 需要一定副本数的工作负载，受调度控制。
- Daemon: 在满足选择器条件的每个节点上运行的工作负载。
- Lease: 有效期内的“占用权”，到期需回收。
- Heartbeat: 运行实例定期刷新，标识存活与进度。
- Selector: 用于匹配节点标签的选择条件，采用“简单 label-selector”语法（见 Data Model）。
- Assignment: 调度生成的单个运行目标（deployment 的一个副本或 daemon 的一个节点实例）。

## Protocol Overview

### 端到端流程

1. 控制器循环读取 `deployment` 期望状态，分别处理 deployment 与 daemon。
2. 调度器生成或更新 `deployment_assignment`，并为其授予 lease。
3. node-unit 执行器查询本节点的 assignment 列表，启动或停止对应运行实例。
4. 运行实例周期性写 heartbeat；控制器根据 heartbeat 与 lease 进行回收与重调度。

### 核心要求

- R1: 调度器 MUST 以 lease 为唯一有效占用依据，过期 lease MUST 视为可回收。
- R2: node-unit MUST 仅执行“本节点且 lease 有效且 `state` ∈ {`Assigned`,`Running`}”的 assignment。
- R3: daemon 的 assignment MUST 按节点选择器生成，每个满足条件的节点至多一个 assignment。
- R4: deployment 的 assignment MUST 按 `desired_replicas` 生成，且允许跨节点均衡（Phase B 启用）。
- R5: 运行实例 MUST 定期上报 heartbeat，间隔与过期时间 MUST 可配置。
- R6: 执行器在无法写 heartbeat 时 SHOULD 进入自我终止或降级模式，避免僵尸占用。
- R7: 调度与执行 MUST 幂等；重复调度不应造成重复运行。

## State Machine

### Assignment 状态

状态集合：`Assigned` -> `Running` -> `Draining` -> `Terminated`

职责边界：

- R8: 执行器 MUST 仅写 `heartbeat_at`、`lease_expire_at` 与 `exit_reason`，不得直接写 `state` 或 `lease_holder`。
- R9: 调度器 MUST 是唯一写 `state` 与 `lease_holder` 的组件；`lease_expire_at` 仅在分配/重新分配时由调度器写入，续租由执行器写入。

转移规则：

- R10: assignment 创建时 MUST 直接进入 `Assigned` 并写入 `node_id`/`lease_holder`/`lease_expire_at`。
- R11: `Assigned` 在 node-unit 写入首次 `heartbeat_at` 后，调度器 MUST 通过 CAS（`state=Assigned`）更新为 `Running`。
- R12: `Running` 在缩容/暂停/lease 过期触发回收时，调度器 MUST 通过 CAS 更新为 `Draining`。
- R13: `Draining` 在检测到 `exit_reason` 非空或 `lease_expire_at < db_now` 后，调度器 MUST 通过 CAS 更新为 `Terminated`。
- R14: `Running` 在 `lease_expire_at < db_now` 时 MUST 被调度器重新分配。

### Deployment 状态

状态集合：`Active`、`Degraded`、`Paused`

- R15: 当有效 `Running` 数量小于 `desired_replicas` 且持续超过 `degraded_window` 时 MUST 标记 `Degraded`。
- R16: `Paused=true` 时 MUST 停止新的 assignment 生成，且调度器 MUST 将现有 assignment 标记为 `Draining`，实例在 lease 到期或退出后停止（deployment/daemon 均适用）。

### Daemon 状态

状态集合：`Active`、`PartiallyActive`、`Paused`

- R17: 当满足 selector 的节点数量大于有效 `Running` 数量时 MUST 标记 `PartiallyActive`。

## Data Model

### deployment 表（扩展）

新增或规范字段（示例）：

- `type` ENUM('deployment','daemon') MUST 存在。
- `enabled` BOOL MUST 存在。
- `desired_replicas` INT DEFAULT 1，仅 deployment 使用。
- `selector` TEXT，用于匹配节点标签，仅用于 daemon；deployment 必须为空（未来扩展）。
- `lease_ttl_seconds` INT DEFAULT 60，控制 lease 期限。
- `heartbeat_interval_seconds` INT DEFAULT 15。
- `paused` BOOL DEFAULT false。
- `observed_generation` INT，控制器确认已处理的版本。
- `spec_hash` TEXT，用于变更检测与幂等。

selector 语法与存储规范（简单 label-selector）：

- 语法：`key=value` 通过 `,` 连接多个条件，表示 AND；不支持 `!=`、`in`、括号或空格。
- 允许空字符串，表示“所有节点”。
- `key`/`value` 允许字符集：`[a-zA-Z0-9_.-]`，长度 1-64。

示例：

- `region=cn,env=prod`
- `role=edge`
- ``（空字符串，匹配全部节点）

错误示例：

- `region=cn, env=prod`（包含空格）
- `region in (cn)`（不支持表达式）
- `=cn`（缺少 key）

节点标签来源与一致性：

- 权威来源：活跃 node-unit 的 `terminalInfos.tags`（`tags.node_unit='true'`），作为 selector 匹配的单一真值。
- 更新路径：node-unit 启动时上报标签；标签变更需重启或重新注册后生效；调度器每轮使用最新快照。
- 一致性：最终一致；缺失标签视为空；标签变更会在下一轮调度收敛。

活跃节点判定与 TTL：

- 调度器维护 `last_seen_at`（基于每轮 `terminalInfos` 快照更新）。
- 若 `now - last_seen_at > node_active_ttl_seconds` 则视为不活跃并从 selector 目标集合移除。
- `node_active_ttl_seconds` 默认 30，可通过 `NODE_UNIT_ACTIVE_TTL_SECONDS` 覆盖。

模式代际确认：

- 切换真值：`switch_state.target_generation`。
- 每个活跃 node-unit 心跳上报 `applied_generation`（本节点已应用代际）。
- 调度器仅在“冻结 cohort 的 `applied_generation` 全部等于 `target_generation`”时允许开关切换。
- 上报载体：node 级心跳（独立于 assignment），写入 `terminalInfos.tags.applied_generation`。
- 上报频率：默认 5 秒，可通过 `NODE_UNIT_MODE_HEARTBEAT_INTERVAL_SECONDS` 覆盖。
- 约束：活跃但无 assignment 的节点仍 MUST 上报 `applied_generation`。
- 切换门禁：发起切换时冻结 `switch_cohort`（活跃节点快照），仅对该 cohort 校验代际；超过 `node_active_ttl_seconds` 未确认则切换失败。

兼容策略：

- R18: 未提供 `desired_replicas` 的 deployment MUST 视为 1。
- R19: 未提供 `selector` 的 daemon MUST 视为“所有节点”；deployment 的 `selector` 必须为空，非空视为 `E_SELECTOR_INVALID`。
- R20: 旧字段 `address` 在迁移期 MAY 保留为只读兼容字段，不再作为唯一调度依据。

### deployment_assignment 表（新增）

建议新增表：

- `assignment_id` TEXT PRIMARY KEY（见唯一性与派生规则）。
- `deployment_id` TEXT NOT NULL。
- `node_id` TEXT NOT NULL。
- `replica_index` INT NULL。
- `lease_holder` TEXT NOT NULL（node_id）。
- `lease_expire_at` TIMESTAMP NOT NULL。
- `heartbeat_at` TIMESTAMP NULL。
- `exit_reason` TEXT NULL。
- `state` ENUM('Assigned','Running','Draining','Terminated')。
- `generation` INT，用于 rollout 同步。
- `created_at`/`updated_at`。

唯一性与幂等写入：

- R21: deployment 的 `assignment_id` MUST 使用 `deployment_id#replica_index` 派生，其中 `replica_index` 取值范围为 `[0, desired_replicas-1]`。
- R22: daemon 的 `assignment_id` MUST 使用 `deployment_id#node_id` 派生，且 `replica_index` MUST 为 NULL。
- R23: 调度器创建或重分配 assignment MUST 使用原子 upsert 或 compare-and-swap，且仅在满足下列条件之一时写入：
  - `assignment_id` 不存在；或
  - `lease_expire_at` 已过期。
- 调度器 CAS 写入 MUST 显式携带期望的 `lease_holder` 与 `state`，避免跨节点误更新。
- 调度器不得在 `lease_expire_at` 未过期时更新 `lease_expire_at`，仅允许更新 `state` 等非租约字段。
- R24: 执行器续租 MUST 使用 compare-and-swap，且仅当 `state` ∈ {`Assigned`,`Running`} 时允许写入 `heartbeat_at` 与 `lease_expire_at`；若并发写入触发唯一性冲突，写入方 MUST 视为幂等成功并读取最新记录。

约束与索引：

- R25: MUST 建唯一索引 `(deployment_id, replica_index)`，仅适用于 deployment（`replica_index IS NOT NULL` 的部分索引）。
- R26: MUST 建唯一索引 `(deployment_id, node_id)`，仅适用于 daemon（`replica_index IS NULL` 的部分索引）。
- R27: MUST 建索引 `(node_id, lease_expire_at)` 以支持节点回收与本地扫描。
- R28: MUST 建索引 `(deployment_id, state)` 以支持控制器查询与收敛。

### 兼容与迁移字段

- `address` 与 `deployment_assignment` 并存时，调度器 MUST 以新表为准。
- R29: 迁移期 MUST 支持分阶段读取策略：`flag=off` 时允许读旧表；`flag=on` 时禁止旧表兜底启动路径（assignment 不可用时应不上线并上报错误）。
- R30: 当新调度开关启用时（且仅允许 `desired_replicas=1`），`deployment_assignment` MUST 是唯一真值来源；`address` MUST 仅作为派生字段，并在新表写入成功后更新。
- R31: 回滚时旧逻辑 MUST 以 `address` 为唯一真值来源，并忽略新表；迁移期禁止使用 `address` 反向回填新表。

## Scheduling Flow

### Deployment 调度

1. 控制器读取 deployment 集合，过滤 `enabled=true` 且 `paused=false`。
2. 计算目标副本数与当前有效 `Running` 数。
3. 若不足，创建新的 assignment 并发放 lease。
4. 若过多，标记多余 assignment 为 `Draining` 并不再续租。
5. 对 lease 过期且 heartbeat 超时的 assignment 进行回收与重建。

要求：

- R32: 当 `desired_replicas` 增加时 MUST 先新增 assignment 再回收旧副本；`state=Draining` 的旧记录仅在 `lease_expire_at < db_now` 后才允许复用对应 `replica_index`（Phase B 启用）。
- R33: 当 `desired_replicas` 减少时 MUST 先标记 `Draining` 再回收（Phase B 启用）。
- R34: 调度器 SHOULD 尽量避免同一节点上放置同一 deployment 的多个副本。

### Daemon 调度

1. 控制器计算满足 selector 的节点列表。
2. 为每个节点维持 1 个 assignment（不存在则创建；存在则仅校验/不续租）。
3. 对不再匹配 selector 的节点，标记 assignment 为 `Draining`。

要求：

- R35: daemon 的 assignment MUST 使用 node_id 作为唯一性约束。
- R36: 节点离线后，daemon assignment MUST 在 lease 过期后自动回收。

### node-unit 执行流程

1. node-unit 读取本节点 assignment（lease 有效且 `state` ∈ {`Assigned`,`Running`}）。
2. 对每个 assignment 启动或维持实例。
3. 定期写 heartbeat（包含 deployment_id/node_id/generation）。
4. 对不再存在或 lease 失效的 assignment，执行 stop 并清理。

要求：

- R37: node-unit MUST 为每个运行实例输出包含 deployment/node 标识的 Prometheus 指标。
- R38: node-unit MUST 在进程退出时写入 `exit_reason`（含停止原因），并记录最后一次 `heartbeat_at`。

## Failure Recovery & Consistency

### 幂等性

- R39: 对同一 assignment 的重复调度 MUST 不影响已有运行实例。
- R40: assignment 的状态迁移 MUST 基于比较并发控制或原子更新。

### 租约过期

- 时间源：`db_now` 统一使用数据库 `CURRENT_TIMESTAMP`，执行器与调度器的写入/判断均以此为准。

- R41: 执行器续租与 heartbeat MUST 合并为单次写入，写入时使用数据库时间 `db_now` 更新 `heartbeat_at=db_now` 与 `lease_expire_at=db_now + lease_ttl_seconds`；仅当 `state` ∈ {`Assigned`,`Running`} 时允许续租，`Draining` 必须停止续租并进入退出流程。
- R42: 仅 `lease_holder` MAY 续租；若写入请求的 `lease_holder` 与记录不一致，MUST 返回 `E_LEASE_CONFLICT`。
- R43: `lease_expire_at` 是唯一过期真值；`heartbeat_at` 仅用于观测与告警，不参与回收决策。`clock_skew_seconds` 默认 5，可通过 `NODE_UNIT_CLOCK_SKEW_SECONDS` 覆盖。
- R44: 执行器续租写入 MUST 基于“更新前记录”做 CAS 判定，SQL 条件至少包含 `state IN ('Assigned','Running') AND lease_holder = :node_id AND lease_expire_at >= db_now`；若更新行为 0，MUST 视为晚到 heartbeat 并忽略（不得延长租约）。
- R45: node-unit 若发现 lease 已过期，MUST 停止续租并尽快退出。

### 混部与回滚

- R46: 迁移期允许旧调度与新调度共存，但 MUST 通过 feature flag 防止重复启动。
- R47: 回滚时 MUST 支持切换回旧查询逻辑且不破坏已存在的 assignment 数据。
- R58: 共存期必须遵循 fencing：同一 `deployment_id` 在任一时刻只能有一种生效来源（`assignment` 或 `address`）。执行器在检测到有效 `assignment` 时 MUST 忽略 `address` 启动路径。

## Error Semantics

错误码（示例）：

- `E_LEASE_CONFLICT`: lease 被其他节点占用。可重试。
- `E_SELECTOR_INVALID`: selector 解析失败。不可重试，需人工修复。
- `E_HEARTBEAT_STALE`: heartbeat 超时。可触发重调度。
- `E_ASSIGNMENT_DUP`: assignment 唯一性冲突。可重试（幂等）。
- `E_NODE_UNAVAILABLE`: 节点不可达。可重试。
- `E_ROLLBACK_BLOCKED_SELECTOR`: 存在 `daemon.selector` 非空，拒绝回滚。不可重试，需先人工收敛 selector。
- `E_ROLLBACK_BLOCKED_REPLICAS`: 存在 `desired_replicas>1`，拒绝回滚。不可重试，需先收敛。
- `E_ROLLBACK_BLOCKED_PAUSED`: 存在 `enabled=true && paused=true` 对象，拒绝回滚。不可重试，需先解除暂停或收敛。
- `E_ROLLBACK_NOT_CONVERGED_ADDRESS`: 回滚前 `address` 派生未收敛，拒绝回滚。不可重试，需先完成派生收敛。
- `E_MODE_SWITCH_NOT_CONVERGED`: 开关切换前代际确认未收敛。可重试。
- `E_MODE_SWITCH_IN_PROGRESS`: 已存在 pending 切换事务，拒绝并发切换请求。可重试。
- `E_PHASE_B_REQUIRED`: Phase A 期间检测到 `desired_replicas>1`，拒绝执行。不可重试，需先完成 Phase B 解锁。

要求：

- R48: 所有错误 MUST 标注是否可重试，并映射到可观测指标。
- R49: 调度器对可重试错误 SHOULD 使用指数退避。

## Security Considerations

- R50: 调度器 MUST 保持 trust package 验证流程不变，不得绕过签名校验。
- R51: 对 selector/desired_replicas 等输入 MUST 做类型与范围校验。
- R52: 对频繁 heartbeat 或租约刷新的请求 SHOULD 进行速率限制，避免资源耗尽。
- R53: 观测指标 MUST 避免输出敏感包内容，仅输出 deployment/node 标识。

## Backward Compatibility & Rollout

### 迁移步骤

1. 增加新表与字段，默认关闭新调度。
2. node-unit 执行器支持读取 assignment：`flag=on` 时禁止旧表兜底启动，`flag=off` 时使用旧逻辑。
3. 调度器主流程仅写 `deployment_assignment`，`address` 仅作为异步派生字段更新，逐步放量。
4. 移除对 `address` 的主依赖，仅保留兼容读取。

要求：

- R54: 迁移期 MUST 提供开关以逐步启用新调度逻辑，且开关必须同时覆盖调度器与执行器的 assignment 读写/续租路径；Phase A 启用前必须验证 `desired_replicas=1`。
- R55: 回滚通过关闭开关执行；关闭后执行器 MUST 停止读取/续租 assignment 并仅使用 `address` 逻辑。若检测到 `type=daemon` 且 `selector` 非空，系统 MUST 拒绝本次回滚（返回 `E_ROLLBACK_BLOCKED_SELECTOR`）且不得切换开关；若检测到 `desired_replicas>1`，系统 MUST 拒绝本次回滚（返回 `E_ROLLBACK_BLOCKED_REPLICAS`）且不得切换开关；若检测到 `enabled=true && paused=true`，系统 MUST 拒绝本次回滚（返回 `E_ROLLBACK_BLOCKED_PAUSED`）且不得切换开关；若 `enabled && type='deployment'` 的应运行对象不满足收敛判定，系统 MUST 拒绝本次回滚（返回 `E_ROLLBACK_NOT_CONVERGED_ADDRESS`）且不得切换开关。
- R59: 开关切换前 MUST 满足冻结 cohort 门禁：发起切换时冻结 `switch_cohort` 并写入 `target_generation`，仅当 cohort 内全部节点上报 `applied_generation == target_generation` 才允许切换；超时或缺失时 MUST 拒绝切换（返回 `E_MODE_SWITCH_NOT_CONVERGED`）。
- R60: Phase A 运行期 MUST 持续校验 `desired_replicas=1`；若检测到 `desired_replicas>1`，调度器 MUST 拒绝该对象执行并返回 `E_PHASE_B_REQUIRED`。

切换事务持久化：

- 切换门禁必须持久化 `switch_state`（`switch_id`、`target_generation`、`cohort_snapshot`、`deadline`、`status`）。
- 调度器重启后 MUST 继续处理最新 `status='pending'` 的切换事务；超时则标记 `failed` 并返回 `E_MODE_SWITCH_NOT_CONVERGED`。
- 同一调度域内 `status='pending'` 的 `switch_state` MUST 全局唯一；新切换请求必须通过 CAS 创建，若已存在 pending 切换则返回 `E_MODE_SWITCH_IN_PROGRESS`。
- node-unit MUST 以固定周期读取最新 pending `switch_state.target_generation`，本地应用成功后才回传 `applied_generation`。
- node-unit 仅在本地成功应用目标模式后上报 `applied_generation`，未应用保持旧值。

回滚收敛判定（机器可执行）：

- 派生函数：`f(assignment)=assignment.node_id`（仅对 `desired_replicas=1` 的 deployment）。
- 判定 SQL（语义）：`NOT EXISTS` 任一 `enabled && type='deployment' && desired_replicas=1` 记录满足以下任一条件：
  1. `address=''`；
  2. 有效 assignment 数量不等于 1（有效 assignment 定义：`state IN ('Assigned','Running') AND lease_expire_at >= db_now`）；
  3. `address <> f(assignment)`（此处 assignment 指唯一有效 assignment）。

分阶段上线策略：

- Phase A（默认）：强制 `desired_replicas=1`，只验 lease/heartbeat/fencing/回滚。
- Phase B（解锁后）：允许 `desired_replicas>1`，启用 R4/R32/R33 的多副本扩缩容语义。
- Phase B 解锁条件（全部满足）：
  1. Phase A 测试项通过（R1/R2/R41/R45/R55/R58）；
  2. 至少一次回滚演练通过（含开关切换与执行器路径收敛）；
  3. 24 小时内无重复启动事件（同 `deployment_id` 双来源并发运行）。

## Observability

建议新增指标（按层级）：

- 实例级：`node_unit_assignment_running{deployment_id,node_id}`
- 控制器级：`node_unit_lease_expired_total{deployment_id}`
- 实例级：`node_unit_heartbeat_lag_seconds{deployment_id,node_id}`

要求：

- R56: 实例级指标 MUST 包含 `deployment_id` 与 `node_id` 维度；控制器级聚合计数指标 MAY 仅包含 `deployment_id`。
- R57: 调度器 MUST 记录 lease 回收与重调度的计数事件。

## Testability

每条 MUST 必须可映射到测试断言。最小测试集：

- R1/R2/R41/R45: lease 过期后，节点停止执行并可重新调度。
- R3/R35/R36: daemon selector 变更导致 assignment 收敛。
- 节点活跃 TTL：超过 `node_active_ttl_seconds` 的节点不参与 selector 目标集合。
- R4/R32/R33: deployment 扩缩容触发 assignment 增删。
- R7/R39/R40: 重复调度不产生重复运行。
- R37/R56: 实例级指标包含 `deployment_id,node_id`；控制器级计数指标允许仅 `deployment_id`。
- R30/R46/R54/R55: feature flag 切换、`desired_replicas=1` gate 与回滚路径可验证。
- R58: 共存期 fencing 生效（存在有效 assignment 时忽略 address）。
- R59: 开关切换前通过冻结 `switch_cohort` 的 `applied_generation == target_generation` 一致性确认。
- R55: `address` 派生未收敛时回滚被拒绝（`E_ROLLBACK_NOT_CONVERGED_ADDRESS`）。
- R55: `enabled=true && paused=true` 场景回滚被拒绝（`E_ROLLBACK_BLOCKED_PAUSED`）。
- R59: 活跃但无 assignment 的节点也必须参与代际确认。
- R59: 切换事务持久化后，调度器重启可继续判定或按 `deadline` 超时失败。
- R59: 并发切换请求被拒绝（`E_MODE_SWITCH_IN_PROGRESS`）。
- R60: Phase A 期间 `desired_replicas>1` 被拒绝执行（`E_PHASE_B_REQUIRED`）。
- Phase B 解锁：满足解锁条件后才允许 `desired_replicas>1` 并验证 R4/R32/R33。
- R43/R44: 仅 `lease_expire_at` 参与回收判定；晚到 heartbeat 仅影响续租写入结果与观测。

## Differences From Current Design

- 引入 `deployment_assignment` 与 lease/heartbeat；当前仅依赖 `deployment.address`。
- deployment 支持 `desired_replicas`，daemon 支持 selector；当前无法表达副本与节点选择。
- daemon 不再直接“所有节点执行”，而是由 assignment 显式驱动。
- 调度与执行分离更清晰，支持回滚与灰度。

## Open Questions

- Q1: 是否统一 Deployment/Daemon 状态字段为单一 `health_state`，以减少冗余？
- Q2: 指标维度是否需要可配置降维以限制高基数？

## Plan

### 核心流程

- 构建 DeploymentController 与 DaemonController 的 controller loop，并统一 lease/heartbeat 处理。
- node-unit 执行器优先读取 assignment，旧逻辑仅作兜底。

### 接口定义

- 更新 `apps/node-unit/etc/node-unit.api.md`：新增 assignment 查询与 heartbeat 写入语义说明。
- 更新 `apps/node-unit/README.md` 与 `docs/zh-Hans/packages/@yuants-node-unit.md`：补充 selector/desired_replicas/lease 字段说明与迁移策略。

### 文件变更明细

- `tools/sql-migration/sql/deployment.sql`: 新增字段与 `deployment_assignment` 表。
- `apps/node-unit/src/scheduler.ts`: 拆分 deployment/daemon 调度逻辑，引入 lease 处理。
- `apps/node-unit/src/index.ts`: 执行器改为读取 assignment 与 heartbeat 写入。
- `apps/node-unit/src/scheduler.test.ts`: 增加 lease/heartbeat/扩缩容/混部测试。
- `libraries/deploy/src/**`: 适配新数据模型与查询。

### 验证策略

- 最小回归：保证旧逻辑可用且开关默认关闭。
- 仿真测试：租约过期、扩缩容、selector 变更、回滚路径。
- 观测验证：指标包含 deployment/node 维度并覆盖错误语义。
