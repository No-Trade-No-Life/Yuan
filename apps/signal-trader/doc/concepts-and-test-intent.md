# SignalTrader 概念与测试意图

## 1. 为什么需要这份文档

这份文档用来统一 `apps/signal-trader` 的术语，并解释当前测试为什么存在。

它主要回答两类问题：

- `signal-trader` 里各个核心概念分别是什么意思
- 当前自动化测试分别在保护什么行为边界

除非特别说明，本文描述的都是当前 `app-signal-trader` 的默认 `trusted-host` 行为。

## 2. 核心概念

### 2.0 概念关系总览

先用一张图把最重要的关系串起来：

```text
signal 定义 ─┐
            ├─> strategy profile ──┐
VC config ──┘                     │
                                  ├─> runtime
account_id ───────────────────────┤
product_id ───────────────────────┤
execution_mode ───────────────────┤
observer_backend ─────────────────┘

runtime
  ├─ runtime_id
  ├─ event stream
  ├─ projection
  ├─ order binding
  ├─ checkpoint
  ├─ health
  └─ audit log
```

最短记忆法：

- `profile` 是策略定义
- `runtime` 是策略定义在具体执行上下文里的实例

### 2.1 Signal

`signal` 是上游送进 `SignalTrader/SubmitSignal` 的交易意图。

代码里的命令类型是 `libraries/signal-trader/src/types/commands.ts` 中的 `SubmitSignalCommand`。

最少包含这些字段：

- `signal_id`
- `signal_key`
- `product_id`
- `signal`（`-1 | 0 | 1`）
- `source`

`signal` 不是 `runtime`。它只是被某个 `runtime` 消费的一次输入事件。

### 2.2 VC Config

这里的 `VC config` 指 runtime 侧的风控和仓位参数，主要体现为：

- `vc_budget`
- `daily_burn_amount`
- `profit_target_value`
- `contract_multiplier`
- `lot_size`

这些字段都在 `apps/signal-trader/src/types.ts` 的 `SignalTraderRuntimeConfig` 里。

### 2.3 Strategy Profile

为了讨论方便，可以先定义：

- `strategy profile = signal 定义 × VC config`

也就是说，一个 profile 回答的是：

- 它监听哪类 signal
- 它有多少风险预算
- 它采用什么风控与 sizing 参数

这是一个概念模型，不是当前代码里的一级 TypeScript 类型。

### 2.4 Runtime

`runtime` 不能简单理解成 `(signal, vc config)`。

更准确的说法是：

- `runtime = strategy profile 在某个具体执行上下文中的实例`

在当前实现里，一个 runtime 至少还绑定：

- `account_id`
- `product_id`
- `execution_mode`（`paper` 或 `live`）
- `observer_backend`

所以从工程实现上看：

- `runtime ~= signal profile × account × product × execution mode × observer backend`

它的配置类型是 `apps/signal-trader/src/types.ts:49` 的 `SignalTraderRuntimeConfig`。

### 2.5 runtime_id

`runtime_id` 是一条 runtime 实例的主键。

它把下面这些东西都串到一起：

- runtime config
- event stream
- projection state
- order binding
- checkpoint
- health
- audit log

对应实现位置：

- 配置定义：`apps/signal-trader/src/types.ts:49`
- manager 入口：`apps/signal-trader/src/runtime/runtime-manager.ts:103`
- worker 持有：`apps/signal-trader/src/runtime/runtime-manager.ts:86`

可以把 `runtime_id` 理解成：

- 一条策略运行实例的名字

### 2.6 subscription_id

`subscription_id` 是 domain 层事件状态机里的订阅身份。

当前实现要求它等于 `runtime_id`。

这个约束会在 runtime config 校验阶段被强制执行。

### 2.7 execution_mode

`execution_mode` 只回答一个问题：

- 这条 runtime 走模拟执行，还是走真实执行链路？

取值只有两个：

- `paper`
- `live`

定义位置：`apps/signal-trader/src/types.ts:52`

### 2.8 observer_backend

`observer_backend` 是 live 观察/执行契约的 canonical key。

它用来：

- 选择或校验 live capability descriptor
- 标识 runtime 当前使用哪条 observation backend
- 保持 runtime config 与宿主声明的 support matrix 对齐

当前默认 backend 是固定常量：

- `vex_account_bound_sql_order_history`

### 2.9 Projection

`projection` 就是从 event stream 推导出来的可查询视图。

当前支持的 query 类型有：

- `product`
- `subscription`
- `audit_by_signal_id`
- `audit_by_subscription_id`
- `audit_by_order_id`
- `reconciliation`

定义来源：`libraries/signal-trader/src/types/snapshot.ts`

### 2.10 Order Binding

`order binding` 是内部订单身份和外部执行身份之间的桥。

它会保存这类信息：

- `internal_order_id`
- `external_submit_order_id`
- `external_operate_order_id`
- `binding_status`

定义位置：`apps/signal-trader/src/types.ts:93`

### 2.10.1 Effect

`effect` 是状态机根据 command / event 推导出来的“应该执行什么动作”。

它不是外部结果，而是内部计划执行动作。

当前 effect 类型定义在：

- `libraries/signal-trader/src/types/snapshot.ts:131`

目前主要有三种：

- `place_order`
- `modify_order`
- `cancel_order`

可以把它理解成：

- `signal` 是输入意图
- `effect` 是系统决定要执行的动作
- 外部执行结果则由 observer 再观察回来

### 2.10.2 Observer

`observer` 是 runtime 看“外部真实世界”的观察器。

它负责把外部状态重新带回系统，主要看这些东西：

- 当前有哪些 open orders
- 历史单 / 终态单是什么
- 当前账户快照是什么
- 外部观测链路是否异常

相关类型定义在：

- `apps/signal-trader/src/types.ts:197`
- `apps/signal-trader/src/types.ts` 中的 `NormalizeObservationInput`

worker 会周期性调用 observer：

- `apps/signal-trader/src/runtime/runtime-worker.ts:479`
- `apps/signal-trader/src/runtime/runtime-worker.ts:557`

observer 的输出会被用来：

- 回灌 execution report
- 更新账户快照
- 更新 reconciliation
- 决定 health 是否需要进入 `degraded` / `audit_only` / `stopped`

可以把它理解成：

- “系统去外面看一眼，现在真实世界到底发生了什么”

### 2.10.3 Checkpoint

`checkpoint` 是 runtime 的运行快照，用来支持重启恢复。

它会保存至少这些信息：

- 当前 snapshot
- 最后一个 event offset / id
- 当前 health
- 最近账户快照信息
- 最近 matched reconciliation 信息

定义位置：

- `apps/signal-trader/src/types.ts:122`

真正的持久化实现：

- `apps/signal-trader/src/runtime/runtime-worker.ts:966`

checkpoint 不是只在退出时保存，而是在很多关键节点都会保存：

- health 变化时保存（`transitionHealth(...)` 默认会持久化）
- append command 后保存
- observer 一轮完成后保存
- boot / replay 某些关键分支也会显式保存

相关代码：

- `apps/signal-trader/src/runtime/runtime-worker.ts:939`
- `apps/signal-trader/src/runtime/runtime-worker.ts:823`
- `apps/signal-trader/src/runtime/runtime-worker.ts:673`

可以把它理解成：

- “runtime 当前跑到哪一步了，状态长什么样，要随时落盘备份”

### 2.11 Health

`health` 是运行状态，不是业务意图。

类型定义在 `apps/signal-trader/src/types.ts:74` 的 `SignalTraderRuntimeHealth`。

当前状态值：

- `normal`：worker 当前运行正常
- `degraded`：观察/数据链路有问题，但还没完全锁死
- `audit_only`：runtime 因审计/恢复原因被锁住
- `stopped`：runtime 没正常运行，或者压根没进入活动状态

这里要特别区分：

- `live` 是执行模式
- `normal` 是健康状态
- `live normal` 的意思是：这条 runtime 处于 live 模式，并且当前 health 是正常的

### 2.12 Audit Log

`audit log` 是 operator/runtime 侧的操作痕迹，用来记录关键锁定、恢复和校验动作。

当前 action 包括：

- `runtime_locked`
- `runtime_degraded`
- `live_capability_validated`
- `live_capability_rejected`
- `backfill_order_binding`
- `unlock_runtime`
- `disable_runtime`
- `observer_cycle`

定义位置：`apps/signal-trader/src/types.ts:137`

## 3. Runtime 状态为什么会变化

`runtime` 的状态会变化，是因为它不是一份静态配置，而是一个正在运行的 worker。

这个 worker 会持续受到几类输入影响：

- boot / replay 结果
- observer 返回的账户快照、挂单、历史单
- effect 执行结果
- operator 操作（如 unlock / disable）
- checkpoint 恢复结果

真正改状态的地方在 `apps/signal-trader/src/runtime/runtime-worker.ts:939` 的 `transitionHealth(...)`。

每次状态变化都会：

- 更新内存里的 `health`
- 必要时写 audit log
- 持久化到 checkpoint

所以 runtime 状态不是 UI 自己算出来的，而是 worker 在运行过程中不断更新并持久化的结果。

### 3.1 初始状态

新建 health 时默认就是：

- `stopped`

对应代码：`apps/signal-trader/src/runtime/runtime-health.ts:3`

### 3.2 `stopped`

`stopped` 表示这条 runtime 当前没有进入可正常运行状态。

典型进入路径：

- runtime 被 disable
- live 缺 observer provider
- boot 阶段 capability 校验失败
- boot 阶段账户快照过旧
- replay checkpoint 时恢复出 `stopped`

对应代码可看：

- boot 入口：`apps/signal-trader/src/runtime/runtime-worker.ts:127`
- replay 恢复：`apps/signal-trader/src/runtime/runtime-worker.ts:517`

### 3.3 `normal`

`normal` 表示 worker 当前处于正常运行状态。

典型进入路径：

- boot 成功完成
- live 完成一次 observe，且没有命中 lock/degraded 条件
- degraded 状态下，后续观察恢复正常时回到 `normal`
- operator unlock 成功后回到 `normal`

对应代码可看：

- boot 后切到 normal：`apps/signal-trader/src/runtime/runtime-worker.ts:167`
- degraded 恢复 normal：`apps/signal-trader/src/runtime/runtime-worker.ts:670`
- unlock 恢复 normal：`apps/signal-trader/src/runtime/runtime-worker.ts:463`

### 3.4 `degraded`

`degraded` 表示还能运行，但观察/执行链路已经出现问题。

它是“软故障”状态，还没完全锁死。

典型进入路径：

- observer 返回 `degraded_reason`，但还没严重到必须锁死
- observer 执行抛错
- execution adapter 返回 `degraded_reason`

对应代码可看：

- observer 降级：`apps/signal-trader/src/runtime/runtime-worker.ts:588`
- observer failure：`apps/signal-trader/src/runtime/runtime-worker.ts:676`
- execution degraded：`apps/signal-trader/src/runtime/runtime-worker.ts:862`

### 3.5 `audit_only`

`audit_only` 表示 runtime 已经被锁住，只允许观察、审计、人工修复，不再被当成健康运行态。

这是当前 live 模式里最常见的“出问题了但还活着”的状态。

典型进入路径：

- reconcile mismatch
- observation 明确给出 `lock_reason`
- 账户漂移（account mismatch）
- normalizer 判断缺失外部 id / 缺失终态证据
- order history source unavailable
- execution runtime error
- execution adapter 返回 `lock_reason`
- replay checkpoint 恢复出 `audit_only`

对应代码可看：

- observer / normalizer 锁定：`apps/signal-trader/src/runtime/runtime-worker.ts:606`
- account mismatch：`apps/signal-trader/src/runtime/runtime-worker.ts:617`
- reconcile mismatch 写成 audit_only：`apps/signal-trader/src/runtime/runtime-worker.ts:829`
- execution lock：`apps/signal-trader/src/runtime/runtime-worker.ts:868`
- execution runtime error：`apps/signal-trader/src/runtime/runtime-worker.ts:898`
- replay 恢复 audit_only：`apps/signal-trader/src/runtime/runtime-worker.ts:525`

### 3.6 当前状态流转可以粗略理解成

- `stopped -> normal`
  - boot 成功
- `normal -> degraded`
  - 观察/执行链路出现软故障
- `degraded -> normal`
  - 后续观察恢复正常
- `normal/degraded -> audit_only`
  - 命中需要 fail-close 的锁定条件
- `audit_only -> normal`
  - operator unlock 成功
- `any -> stopped`
  - disable 或 boot 阶段硬失败

也可以把 health 状态机画成这样：

```text
           boot 成功
stopped --------------> normal
   ^                      |
   |                      |
   |              软故障/观测异常
   |                      v
   |<---------------- degraded
   |                      |
   |                      |
   |              fail-close / 锁定条件
   |                      v
   +--------------- audit_only
                       |
                       |
                       +---- unlock 成功 ----> normal
```

理解时要记住：

- `stopped` 更像“没跑起来 / 不在运行态”
- `audit_only` 更像“还活着，但被锁住等待审计或人工修复”

注意：

- `execution_mode=live` 不等于 `health=normal`
- `live normal` 的含义只是：这条 live runtime 当前健康正常
- `live audit_only` / `live stopped` 都是完全可能的

## 4. 当前 Runtime 生命周期

高层上，一条 runtime 会经历这条路径：

1. `UpsertRuntimeConfig`
2. runtime config 归一化与持久化
3. 若 `execution_mode === 'live'`，执行 live admission 校验
4. worker boot
5. 首次 observe / reconcile
6. health 状态流转（`normal`、`degraded`、`audit_only`、`stopped`）
7. signal submit
8. effect execution 与外部 binding 更新
9. observer 持续把外部世界回灌进状态机

也可以把这条主链粗略记成：

- `signal -> command -> event -> effect -> execution -> observer -> checkpoint`

再展开成一张顺序图：

```text
上游策略 / GUI
    |
    | SubmitSignal
    v
runtime worker
    |
    | appendCommand
    v
domain state
    |
    | 产出 planned effects
    v
execution adapter
    |
    | 调下游执行（paper 或 live）
    v
外部世界
    |
    | observer 回看 open orders / history / account snapshot
    v
runtime worker
    |
    | 生成 report / reconciliation / health 变化
    v
checkpoint + projection + audit log
```

对应最短解释：

- `signal`：上游想做什么
- `command/event`：状态机发生了什么
- `effect`：系统决定要执行什么动作
- `execution`：真的把动作打到下游
- `observer`：再把外部真实状态看回来
- `checkpoint`：把当前运行结果落盘，方便恢复

主要实现文件：

- `apps/signal-trader/src/runtime/runtime-manager.ts`
- `apps/signal-trader/src/runtime/runtime-worker.ts`
- `apps/signal-trader/src/bootstrap-from-env.ts`

## 5. 当前 Trusted-Host 默认行为

当前 `app-signal-trader` 默认入口假设：

- 同一 Host 内的服务彼此可信
- 读 / 写 / operator 服务默认都开启
- live backend 接线固定写死在代码里，不再依赖 runtime env 开关
- `secret_ref` 已不再属于默认 runtime 模型

这是默认 app 行为，不代表所有部署都必须这样。

如果某个部署要更严格的权限模型，应该自己嵌入 `createSignalTraderApp(...)`，然后显式覆盖 service policy / live wiring。

## 6. 为什么 SQL `"order"` 仍然重要

当前默认 live backend 仍然把 SQL `"order"` 视为 closed-order 的证据来源。

现在改变的不是这个数据契约，而是软件边界：

- `signal-trader` 仍然会读 SQL `"order"`
- `signal-trader` 默认交付不再绑定某个特定 writer 进程
- SQL `"order"` 的生产责任被视为 VEX、叶子服务或其他外部基础设施的职责

## 7. 测试套件设计意图

当前主要测试文件：

- `apps/signal-trader/src/__tests__/bootstrap-from-env.test.ts`
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`

当前总共有 35 个测试。

### 7.1 bootstrap-from-env.test.ts

1. `默认 live bootstrap 配置收敛为 VEX account-bound + SQL order history`

   - 用来保证默认 live wiring 固定在预期的 VEX account-bound backend 上

2. `废弃 env 覆盖项会被忽略`

   - 用来保证已经移除的 startup env knob 不会再偷偷改变行为

3. `默认 service policy 收敛为 host 内互信 + 全服务开启`

   - 用来保证 trusted-host 默认值已经生效，而不是可选项

4. `默认 route context 只携带 VEX account-bound 路由信息`

   - 用来保证 live credential payload 已经变成 route-oriented，而不是 secret-oriented

5. `account-bound live venue 默认调用通用 Submit/Cancel/Account 服务`

   - 用来保证 live venue 确实打到预期的 account-bound 服务名

6. `observer provider 默认结合 pending/account 与 SQL order history`

   - 用来保证默认 observer 走的是 `pending + account snapshot + SQL order history`

7. `只在探测到 VEX account-bound 服务时声明默认 live capability`
   - 用来保证 capability 声明依赖真实探测到的服务形状，而不是拍脑袋配置

### 7.2 signal-trader-app.test.ts

1. `校验 runtime config 的 live/mock 约束`

   - 保护最基本的 runtime config 不变量

2. `mock 路径可跑通 event -> effect -> report -> projection 闭环与 replay`

   - 证明 mock happy path 能完整跑通

3. `binding 写入后 live cancel 只能使用 external_operate_order_id`

   - 证明 live cancel 必须使用 operate-order 身份，而不是内部 id

4. `restart 后仍可提交，但重启时保留 audit_only 锁态`

   - 证明重启会保留持久化的锁态，但当前 trusted-host submit 路径已经更宽松

5. `observer 缺失时 live 不进入 normal`

   - 证明 live 仍然要求 observer provider，不能裸跑

6. `live 在首次 observe 后直接进入 normal，不再等待初始 reconcile gate`

   - 记录当前 trusted-host 下被放宽后的 boot 行为

7. `stale snapshot 不允许 live 进入 normal`

   - 证明明显陈旧的账户快照仍然会阻止 healthy boot

8. `fresh matched reconciliation 过期后 observer 会切到 audit_only`

   - 证明 reconcile freshness 依旧会影响运行期状态

9. `submit 前不再执行 reconciliation freshness gate`

   - 证明 submit 不再因为 freshness 漂移被前置拦截

10. `重启后同一 fresh matched snapshot 仍可恢复 normal`

    - 证明重启后只要 reconcile 证据还够新，runtime 仍可回到正常状态

11. `observer 可回灌 report/account snapshot，并在缺失观测时锁定`

    - 证明 observer 输出确实会驱动 report、account snapshot 和 fail-close 决策

12. `modify_order effect 会直接 fail-close`

    - 证明不支持的 live modify 流程仍然会硬失败

13. `缺失 external id 会直接 fail-close`

    - 证明缺失外部身份会被当成执行级别的严重损坏

14. `backfill/unlock 收紧并写入 audit log`

    - 证明人工修复操作仍然有约束，且会留下审计痕迹

15. `unlock 在同一 fresh matched snapshot 下也可恢复 normal`

    - 证明在证据充足时 operator recovery 可以恢复 normal

16. `observer 异常会显式降级并写 audit log`

    - 证明 observer 异常不会静默吞掉，而是显式降级并留 audit

17. `order history source unavailable 时会直接 fail-close`

    - 证明 closed-order 证据源不可用时不会被静默容忍

18. `存在 in-flight binding 时 order history source unavailable 会直接 fail-close`

    - 证明存在在途执行时，如果终态证据源消失，会被视为更高风险

19. `读接口不隐式 boot 且服务默认只暴露只读面`

    - 保护底层 service helper 的原始契约；它不覆盖当前默认 trusted-host app 入口的放宽行为

20. `observer normalizer 支持 binding 翻译与缺失 external id fail-close`

    - 证明 normalizer 会把外部观察稳定翻译成 binding 语义

21. `非 OKX product/backend 在提供 capability descriptor 时可正常 boot`

    - 证明 live 支持是 capability 驱动，而不是硬编码 OKX

22. `live 缺 capability descriptor 时 boot fail-close`

    - 证明宿主没声明 live 能力时，runtime 不能硬 boot

23. `live capability 缺关键能力时 boot fail-close`

    - 证明 capability 不完整时仍然不允许 live 启动

24. `缺 descriptor 时进入 stopped`

    - 证明 health 能清楚表达“缺能力声明”这种状态

25. `ListLiveCapabilities 返回带 descriptor_hash 的 support matrix`

    - 证明宿主可以暴露稳定、可机器消费的 support summary

26. `audit log 包含 phase / descriptor_hash / validator_result`

    - 证明 live admission 的校验过程在事后仍然可解释

27. `live 运行中执行异常会 fail-close 到 audit_only`

    - 证明运行期执行异常仍然会硬锁 runtime

28. `live binding 持久化异常会 fail-close 到 audit_only`
    - 证明 live binding 持久化损坏也会被当成致命问题

## 8. 如何正确理解 UI 里的信息

当 GUI 显示：

- 一个 `runtime_id`
- 一个 `execution_mode`
- 一个 `health.status`

正确理解方式是：

- `runtime_id`：我当前在操作哪条 runtime 实例？
- `execution_mode`：它走 paper 还是 live？
- `health.status`：它当前健康、降级、审计锁定还是停止？

所以 `live normal` 的意思非常简单：

- 这条 runtime 配置成了 live 执行
- 它当前 health.status 是 `normal`

## 9. 一句话记忆法

如果只记一句话：

- `profile` 描述策略形状
- `runtime` 是这个 profile 在具体执行上下文里的实例
- `runtime_id` 是这个实例的稳定名字
