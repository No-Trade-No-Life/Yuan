# Daemon / Selector 实现说明

## 目的

本文记录本次 node-unit 改造中 `daemon` 的具体实现方案，以及 `selector` 的解析、匹配与调度方式，作为 RFC 之外的实现说明。

## 一句话总结

- `deployment.type='daemon'` 表示“每个匹配节点运行一个实例”。
- 调度器先根据 `selector` 找到匹配节点，再为每个节点写一条 `deployment_assignment`。
- 执行器不再因为“看到 daemon”就直接运行，而是只执行“分配给本节点且 lease 有效”的 assignment。

---

## daemon 是怎么实现的

### 1. 数据模型

daemon 仍然存放在 `deployment` 表，但语义与普通 deployment 不同：

- `type='daemon'`
- `selector`：用于匹配节点
- `address`：不再作为 daemon 的真值来源，仅保留兼容字段

实际运行目标由 `deployment_assignment` 表承载：

- `assignment_id`
- `deployment_id`
- `node_id`
- `lease_holder`
- `lease_expire_at`
- `heartbeat_at`
- `state`
- `exit_reason`
- `generation`

对于 daemon，assignment 的主键语义是：

`assignment_id = <deployment_id>#<node_id>`

也就是说：

> 一个 daemon 在一个匹配节点上，最多只有一条 assignment。

### 2. 调度器如何为 daemon 派单

实现位置：`apps/node-unit/src/scheduler.ts`

调度循环会：

1. 读取活跃的 node-unit 列表
2. 读取每个 node-unit 的标签（来自 `terminalInfo.tags`）
3. 读取所有 `deployment`
4. 对于 `type='daemon'` 的 deployment：
   - 解析 `selector`
   - 找出所有匹配节点
   - 为每个匹配节点 upsert 一条 assignment
   - 对已经不匹配的旧 assignment 标记为 `Draining`

因此 daemon 的语义不是“全节点广播启动”，而是：

> **控制器先算出目标节点集合，再给每个目标节点发 assignment。**

### 3. 执行器如何运行 daemon

实现位置：`apps/node-unit/src/index.ts`

当 `NODE_UNIT_ASSIGNMENT_FEATURE_FLAG=true` 时：

- node-unit 只查询分配给“本节点”的 assignment
- 只执行同时满足以下条件的 assignment：
  - `node_id == 当前节点`
  - `state in ('Assigned', 'Running')`
  - `lease_expire_at >= CURRENT_TIMESTAMP`

assignment 启动后：

- 子进程真正启动成功后，开始 heartbeat / lease 续租
- 续租会更新：
  - `heartbeat_at`
  - `lease_expire_at`
- 如果续租失败，执行器认为 lease 已丢失，实例退出

所以 daemon 的真实运行链路是：

`selector -> matched nodes -> assignment rows -> executor on each node`

而不是旧模型里的：

`enabled daemon -> every node self-start`

### 4. 和 deployment 的区别

- `deployment`：Phase A 只允许 `desired_replicas=1`
- `daemon`：有多少匹配节点，就生成多少 assignment

因此两者虽然共用 `deployment` 表，但调度策略不同：

- deployment 是“按副本数调度”
- daemon 是“按节点集合展开”

---

## selector 是怎么实现的

### 1. 数据来源

selector 匹配的对象，不是数据库里的 node 表，而是当前活跃 node-unit 的 `terminalInfo.tags`。

实现上：

- `loadActiveNodeStates()` 从 `terminalInfos` 中提取 node-unit
- 要求：
  - `tags.node_unit === 'true'`
  - 有 `tags.node_unit_address`
  - 在活跃 TTL 内（`NODE_UNIT_ACTIVE_TTL_SECONDS`）

每个活跃节点会形成：

- `node_id`
- `terminal_id`
- `labels`（实际就是 `terminalInfo.tags` 的拷贝）
- `applied_generation`
- `last_seen_at`

### 2. selector 语法

实现位置：`parseSelector()`

当前 selector 是一个非常简单的 label selector：

- 语法：`key=value,key2=value2`
- 多个条件之间是 **AND**
- 不支持：
  - 空格语义
  - `!=`
  - `in`
  - `or`
  - 括号

允许字符集：

- `key` / `value` 均使用：`[A-Za-z0-9_.-]{1,64}`

空字符串 `''` 的语义是：

> 匹配所有活跃节点。

### 3. selector 解析逻辑

`parseSelector(selector)` 的逻辑：

1. 如果是空字符串，返回空条件集
2. 用 `,` 拆分每个片段
3. 每个片段必须包含且只依赖一个 `=`
4. `key` 和 `value` 都必须满足正则
5. 解析结果变成一个 `Record<string, string>`

如果任一条件不合法，返回：

- `E_SELECTOR_INVALID`

### 4. selector 匹配逻辑

实现位置：`matchSelector(selector, labels)`

匹配规则非常直接：

- 先调用 `parseSelector()`
- 如果 selector 非法，直接返回 `false`
- 否则对每个 `(key, value)` 做全量匹配：

`labels[key] === value`

也就是说，当前是：

> **精确匹配 + 全条件 AND**

例如：

- `selector = region=hk`
  - 只有 `labels.region === 'hk'` 的节点匹配
- `selector = region=hk,role=worker`
  - 必须同时满足：
    - `labels.region === 'hk'`
    - `labels.role === 'worker'`

### 5. 调度器如何使用 selector

在 `runAssignmentSchedulerCycle()` 中：

1. 对 daemon 读取 `selector`
2. 先做 `parseSelector()` 校验
3. 如果非法：
   - 记录 `DaemonSelectorInvalid`
   - 将该 deployment 的 assignment 标记为 `Draining`
4. 如果合法：
   - 用 `activeNodes.filter((node) => matchSelector(selector, node.labels))`
   - 得到 `matchedNodes`
   - 为每个匹配节点写 assignment
   - 把已不再匹配的 assignment 标记为 `Draining`

### 6. 当前实现的边界

当前 selector 实现是故意做“减法”的：

- 优点：简单、可读、容易测试、调度行为稳定
- 缺点：表达能力弱，不支持复杂选择逻辑

另外，当前标签来源仍然是 node-unit 自报的 `terminalInfo.tags`，这也是为什么安全审查里仍然把 selector 信任边界列为待补项。

---

## 当前已实现 / 未实现

### 已实现

- daemon 按 selector 派发 assignment
- 每个匹配节点一条 assignment
- assignment mode 下 executor 按 assignment 执行 daemon
- lease / heartbeat 基础路径
- 不再匹配的 daemon assignment 进入 `Draining`
- 现成 E2E 脚本已支持 pg17 与 assignment row count 断言

### 仍未完全闭环

- `switch_state` 持久化切换事务
- 更强的 fencing token
- selector 标签信任边界强化
- heartbeat 稳定端到端验证

---

## 相关文件

- `apps/node-unit/src/scheduler.ts`
- `apps/node-unit/src/index.ts`
- `apps/node-unit/src/scheduler.test.ts`
- `tools/sql-migration/sql/deployment.sql`
- `libraries/deploy/src/index.ts`
- `apps/node-unit/scripts/e2e-daemon-type.sh`
