# RFC：signal-trader paper 运行时时间控制

## 背景 / 问题

`signal-trader` 目前在运行态默认直接读取真实时间。测试里可以借助 fake timers 推进到下一天，但本地运行中的 paper stack 还缺少一个可操作的时间控制面，导致无法在不改系统时间的前提下验证 D+1 / D+2 的 `daily_burn_amount`、capital projection、replay 后视图以及 `SubmitSignal` 相关行为。

本任务只解决 paper 模式下的运行态时间推进，不改变 live 语义，也不引入持久化时钟。目标是让本地开发者在 paper stack 已经启动后，仍能通过服务或 CLI 直接查看、推进、设置、重置 paper 时间。

## 抽象 / 动机

引入一个进程内、paper-only 的 `PaperClockController`，用“真实时间 + 全局 offset”的方式为 paper runtime 提供统一的有效时间。manager 持有唯一 controller，worker 与 query 路径统一经 manager/controller 取时；外部则通过 Host `/request` 暴露 paper clock service，并由 `ui/signal-trader-web/scripts/paper-clock.mjs` 提供人类可用的 CLI 入口。

## 目标与非目标

### 目标

- 只对 `execution_mode = 'paper'` 生效，live 继续使用真实 `Date.now()`。
- 运行中的 stack 可查看当前 paper clock 状态，并支持 `advance`、`set`、`reset`。
- `QueryProjection`、`SubmitSignal`、worker replay / observer 相关读时路径复用同一 paper clock。
- 不修改宿主系统时间；时间推进通过服务 / 脚本触发。
- 首版采用全局 paper offset，不做每个 runtime 独立时钟。

### 非目标

- 不为 live runtime 提供 time travel 或独立时钟注入。
- 不引入数据库 schema、配置文件持久化或跨重启恢复 paper offset。
- 不新增前端按钮或可视化时间控制面板。
- 不实现交易日历、节假日、时区对齐等复杂时钟语义。

## 定义

- `real_now_ms`：调用宿主 `Date.now()` 的真实时间。
- `offset_ms`：仅对 paper 生效的全局偏移量，可正可负。
- `effective_now_ms`：`real_now_ms + offset_ms`，为 paper 运行态实际使用的时间。
- `paper clock state`：对外暴露的 `{ real_now_ms, offset_ms, effective_now_ms }`。

重要说明：这不是“冻结时间”，而是“真实时间 + 偏移”。也就是说 `advance 1d` 之后，`effective_now_ms` 仍会随着真实时间继续向前流动。

## Paper Clock 模型

### 核心约定

`PaperClockController` 作为单进程唯一时间控制器，维护一个内存内 `offset_ms`。其语义如下：

- 对 paper runtime：`now('paper') = Date.now() + offset_ms`
- 对 live runtime：`now('live') = Date.now()`
- `advance(delta_ms)`：在当前 offset 基础上累加
- `setOffset(offset_ms)`：直接覆盖 offset
- `reset()`：把 offset 归零

### 设计理由

- **改动最小**：无需给每个 runtime 建独立 clock registry，也不用改系统时间。
- **语义单点**：query、submit、replay 共用一套取时入口，避免一条链路里多次读不同时间。
- **便于联调**：本地运行中直接 `advance 1d` 即可验证 daily burn / projection。

## Manager / Worker 接线

### 组件边界

- `RuntimeManager` 持有唯一 `PaperClockController` 实例。
- `RuntimeWorker` 在构造时接收该 controller，而不是自行维护 offset。
- manager 级 query 路径在加载 checkpoint / projection 前按 runtime `execution_mode` 取时。
- worker 内部新增唯一公共取时入口 `this.now()`；所有影响 paper 业务时间语义的路径必须统一通过它取时，避免局部还在读裸 `Date.now()`。
- 本轮允许仍保留少量与业务时间无关的真实时间（如日志/响应相关辅助时间），但 budget / query / submit / replay / freshness gate 必须统一走 controller。

### 端到端流程

1. paper stack 启动，bootstrap 创建 `signal-trader` app，并显式打开 `enablePaperClockServices` 后注册 paper clock services。
2. CLI 调用 Host `/request`，请求 `SignalTrader/GetPaperClock` 或变更型 clock service。
3. service handler 调用 `RuntimeManager` 的 clock 方法。
4. manager 更新内存内 offset，并返回新的 `paper clock state`。
5. 后续所有 paper runtime 的 query / submit / replay 再次取时时，自动读到新的 `effective_now_ms`。
6. live runtime 因 `execution_mode = 'live'`，继续走真实时间，不受 offset 影响。

### 约束

- offset 是 **全局 paper 级**，不是 runtime 级。
- offset 只存在于 app 进程内；paper bootstrap 重启后归零。
- 同一进程内多个 paper runtime 共享同一有效时间，这符合首版“约定大于配置”的范围约束。

## 服务接口

### 对外服务

这些服务只有在本地 paper bootstrap 显式启用 `enablePaperClockServices` 时才会注册；默认 live / 普通 bootstrap 不暴露它们。

- `SignalTrader/GetPaperClock`

  - 请求：`{}`
  - 响应：`SignalTraderPaperClockState`
  - 语义：只读查询当前真实时间、offset 与有效时间

- `SignalTrader/AdvancePaperClock`

  - 请求：`{ delta_ms: number }`
  - 响应：`SignalTraderPaperClockState`
  - 约束：`delta_ms` 必须为有限数值；允许负值用于回退

- `SignalTrader/SetPaperClockOffset`

  - 请求：`{ offset_ms: number }`
  - 响应：`SignalTraderPaperClockState`
  - 语义：直接设置全局 offset

- `SignalTrader/ResetPaperClock`
  - 请求：`{}`
  - 响应：`SignalTraderPaperClockState`
  - 语义：offset 归零

### 数据模型 / 接口兼容性

- `SignalTraderPaperClockState`
  - `real_now_ms: number`
  - `offset_ms: number`
  - `effective_now_ms: number`
- 新增请求类型
  - `AdvancePaperClockRequest { delta_ms: number }`
  - `SetPaperClockOffsetRequest { offset_ms: number }`

兼容策略：

- 仅新增 service 与类型，不修改现有 query / write 协议结构。
- 老调用方不使用这些 service 时，paper 行为与此前一致，默认 `offset_ms = 0`。
- live 路径不读取 offset，因此不存在协议污染。

## CLI 脚本

`ui/signal-trader-web/scripts/paper-clock.mjs` 作为首版人工操作入口，约定：

- `status`：读取当前状态
- `advance 1d`：把 offset 累加一天
- `set-offset 2d`：把 offset 直接设为两天
- `reset`：offset 清零

脚本通过 `SIGNAL_TRADER_HOST_ORIGIN` 或默认 `http://127.0.0.1:8888` 请求 Host `/request`，并将服务响应格式化为包含毫秒值与 ISO 时间的 JSON。持续时间解析支持 `ms|s|m|h|d`，默认单位为 `ms`。

## 错误语义

- `OFFSET_MS_INVALID` / `DELTA_MS_INVALID`：输入非有限数值；为调用方错误，不自动重试。
- `HTTP_*` / `EMPTY_RESPONSE` / `REQUEST_FAILED`：CLI 到 Host 的请求失败；可在 stack 存活后人工重试。
- `FORBIDDEN`：service policy 未授权；需要调整 bootstrap 或调用环境，而不是重试。
- `RUNTIME_NOT_FOUND`：仅 runtime 相关 query / write 路径可能出现；clock service 本身不依赖特定 runtime。

可恢复性与重试语义：

- clock 状态变更是内存内、单步原子操作；成功后立即对后续 paper 读时生效。
- `advance/set/reset` 为显式人工操作，不做自动重试，以避免重复推进时间。
- stack 重启导致 offset 丢失属于预期恢复路径；通过 `set` 或 `advance` 重新施加即可。

## 安全性考虑

- 该能力能改变 paper runtime 的业务视图与预算释放节奏，因此必须保持 **paper-only**，不得向 live runtime 透传 offset。
- `paper-only` 不只是时间语义，还包括接口面：live bootstrap 默认不注册 `Get/Advance/Set/ResetPaperClock` 这些 service。
- clock 变更 service 属于 mutating service，应沿用已有授权门禁；匿名只读仅限 `GetPaperClock`。
- CLI 仅通过受控 Host `/request` 调用，不直接修改系统时间或 OS 级 clock。
- 输入只接受数值毫秒偏移；拒绝非有限数值，避免 `NaN` / `Infinity` 污染运行态。
- 不做持久化，降低“长期脏状态”与跨环境误用风险。

## 备选方案

### 方案 A：修改系统时间

放弃原因：会污染整机环境，影响其他进程、浏览器、数据库、日志时间与开发者日常使用，风险明显超出 paper 联调范围。

### 方案 B：每个 runtime 独立时钟

放弃原因：灵活度更高，但会引入 runtime 级 clock registry、隔离配置、并发语义与更复杂的 CLI 目标选择。本轮只需要“整套 paper stack 前进到下一天”，全局 offset 足够且更容易验证。

## 向后兼容、发布与回滚

### 向后兼容

- 默认 offset 为 0，未使用 clock service 的部署行为不变。
- live mode 继续读取真实时间，不受影响。
- 既有 bootstrap / frontend 若不调用新脚本，也不会触发任何语义变化。

### Rollout

1. 在 `apps/signal-trader` 内引入 `PaperClockController` 与 service handler。
2. 在 paper bootstrap 打开 mutating service 权限，确保本地 stack 可调用 clock service。
3. 在 `ui/signal-trader-web/scripts` 暴露 `paper-clock.mjs`，并与 `run-paper-stack.mjs` 共同用于本地联调。
4. 先以测试与本地 smoke 验证 `advance 1d` 对 projection 的影响，再交付给人类使用。

### 回滚

- 代码级回滚：撤销 paper clock controller、service 注册与 CLI 脚本。
- 运行态回滚：若仅需恢复真实时间语义，直接执行 `reset` 或重启 paper bootstrap 即可。
- 由于不改数据库 schema、不做持久化，因此无数据迁移回滚成本。

## 测试计划 / 验证计划

关键行为与测试映射：

- `PaperClockController` 初始 `offset_ms = 0`
  - 单测：manager `getPaperClock()` 返回 0
- `advance 1d` 后 `QueryProjection` 读到新的有效时间
  - 单测：subscription projection 的 `released_vc_total` 从 D0 变为 D1
- `advance 1d` 后 `SubmitSignal` 也读到新的有效时间
  - 单测：paper runtime 在不改系统时钟下推进一天后，submit/query 共享同一 budget 语义
- `reset` 后恢复真实时间基线
  - 单测：`resetPaperClock()` 返回 `offset_ms = 0`
- service 成功注册并暴露只读 / 变更接口
  - 单测：默认 bootstrap 不注册 paper clock services；只有显式启用 `enablePaperClockServices` 时才注册，且授权策略生效
- live 不受污染
  - 验收：同一 manager 内 paper offset 改变后，paper query/submit 看到 shifted time，而 live 仍看到 real time；live bootstrap 不注册 paper clock services
- CLI 能完成 status / advance / set / reset
  - 验收：本地 paper stack 启动后，通过 `node ui/signal-trader-web/scripts/paper-clock.mjs <cmd>` 成功返回状态

建议执行：

- `npm test`（在 `apps/signal-trader`）覆盖 manager / service 级单测
- 本地 smoke：启动 paper stack 后执行 `status -> advance 1d -> status -> reset`

## 风险

- **全局 offset 共享风险**：多个 paper runtime 共用一个 offset，适合首版，但不适合未来多场景并行沙盒。
- **重启即丢失状态**：offset 不持久化，若开发者忘记这一点，可能误判行为；CLI 输出应明确展示 real/effective 时间。
- **误授权风险**：若 bootstrap 对 mutating service 放得过宽，可能让不该调用的环境也能推进 paper 时间；需保持仅本地 paper wrapper 启用。
- **时间跳变副作用**：一次推进多天会同时影响 budget / projection / replay 结果；这是期望能力，但需在 RFC 与脚本帮助里说明。

## 里程碑

### M1：核心时钟模型

- 新增 `PaperClockController`
- manager / worker 统一接线并按 `execution_mode` 取时
- 单测覆盖 `advance/reset` 对 paper projection 的影响

### M2：服务与脚本入口

- 注册 `Get/Advance/Set/ResetPaperClock` services
- paper bootstrap 开启本地可调用策略
- 提供 `paper-clock.mjs` CLI，支持 `status|advance|set-offset|reset`

### M3：交付验证

- 跑通 service 注册与授权单测
- 进行本地 smoke，验证运行中 stack 可推进到 D+1
- 补充 task-local 文档与后续 playbook 沉淀

## 未决问题

- 首版是否需要再增加“绝对时间戳设定”命令，而不只接受 offset 语义？本 RFC 暂不要求；当前 CLI 明确采用 `set-offset` 命名，避免歧义。
- 若后续出现多 paper runtime 并行联调需求，是否需要升级为 runtime-scoped clock registry？本轮先不扩展。

## 落地计划

### 预计文件变更点

- `apps/signal-trader/src/runtime/paper-clock.ts`：定义 paper clock controller
- `apps/signal-trader/src/runtime/runtime-manager.ts`：持有 controller，并暴露 get/advance/set/reset
- `apps/signal-trader/src/runtime/runtime-worker.ts`：统一通过 controller 取 paper/live 时间
- `apps/signal-trader/src/services/signal-trader-services.ts`：注册 paper clock services
- `apps/signal-trader/src/types.ts`：新增 state / request / handler 接口
- `ui/signal-trader-web/scripts/bootstrap-paper-app.mjs`：确保 paper stack 可调用 clock services
- `ui/signal-trader-web/scripts/paper-clock.mjs`：提供 CLI 入口
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`：补 manager / service / smoke 级单测

### 验证步骤

1. 启动 paper stack：`node ui/signal-trader-web/scripts/run-paper-stack.mjs start`
2. 查询初始时间：`node ui/signal-trader-web/scripts/paper-clock.mjs status`
3. 推进一天：`node ui/signal-trader-web/scripts/paper-clock.mjs advance 1d`
4. 再次查询并确认 `effective_now_iso` 前进一天
5. 执行与 subscription / projection 相关的查询或提交流程，确认 paper 行为发生变化
6. 执行 `node ui/signal-trader-web/scripts/paper-clock.mjs reset`，确认 offset 清零
