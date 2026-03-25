# Playbook

## [Convention] HTTPProxy trust model follows host trust domain

- 来源任务：`vendor-tokenbucket-proxy-ip`
- 日期：2026-03-21
- 结论：在当前部署模型下，同一 host 网络中的 terminal 默认互信；不要再用 `terminal_id` 做 HTTPProxy allowlist 或 route pin。
- 边界：`terminal_id`、`hostname`、`ip_source` 只适合观测、缓存、诊断上下文；不要把它们重新升级为 trust boundary。
- 若部署前提变化：需要在 host 接入层补身份校验/隔离，不要回退到 `terminal_id` 白名单补丁。

## [Convention] vendor-binance public-api must own requestContext

- 来源任务：`vendor-tokenbucket-proxy-ip`
- 日期：2026-03-25
- 结论：在 `apps/vendor-binance` 中，凡是走 `requestPublic()` 的公共 REST 链路，都应优先封装在 `src/api/public-api.ts`，由 API wrapper 统一负责 `createRequestContext`、主动限流和 `requestPublic`。
- 边界：service 层只负责业务参数与响应映射，不应直接触碰底层 `requestPublic()`；否则在 `USE_HTTP_PROXY=true` 场景极易再次遗漏 `requestContext`。

## [Decision] live readiness 必须基于 matched + freshness，而不是 snapshot id 是否变化

- 来源任务：`app-signal-trader-live-integration`（2026-03-18）
- 对于 live runtime，进入/恢复 `normal` 的条件应是：当前 reconciliation 已 `matched`，且 freshness window 未过期。
- 不要把“snapshot id 本轮是否变化”当成唯一 readiness 条件；静止账户可能长期复用同一 snapshot id。
- `observer tick` 与 `submit` 前必须复用同一套 freshness gate，避免一边可发单、一边应锁定的双轨语义。

## [Convention] boot 成功进入 normal 后应立即持久化 normal checkpoint

- 来源任务：`app-signal-trader-live-integration`（2026-03-18）
- 如果 boot 期间先以 `audit_only` 运行 observe/reconcile，再切回 `normal`，必须把最终 `normal` 健康态写回 checkpoint。
- 否则重启或读路径可能读到过期的 `audit_only` 健康态，导致控制面/恢复逻辑误判。

## [Convention] 独立控制面前端访问 Host `/request` 时，token 只能留在 Node 侧，且高风险写入要做 proxy 复核

- 来源任务：`signal-trader-standalone-ui`（2026-03-22）
- 如果前端需要通过 Host `/request` 调高风险服务（如 `SignalTrader/SubmitSignal`），不要让浏览器直接持有 `HOST_TOKEN`。
- 优先做同源 Node proxy（dev middleware / preview server），并在 proxy 层重复做最小 fail-close 复核：mutation 开关、profile/runtime 一致性、capability、health/freshness、确认输入。
- Host / 服务端仍是最终安全边界，但 UI proxy 至少要拦住“按钮禁用被 devtools 绕过”的直通写入。

## [Convention] lazy-evaluate projection 必须由 core 单点实现，app 只提供单次调用时钟

- 来源任务：`signal-trader-daily-burn-budget`（2026-03-22）
- 对于 `daily_burn_amount` 这类 lazy-evaluate 语义，不要在 paper/live/app 层各自补公式；统一放在 core helper 中，由 command/query/reconciliation 共用。
- app/runtime 侧只负责在“单次请求 / 单次 worker 执行”入口采样一次 `now_ms`，然后沿整条链路复用，避免 query/submit/reconcile 各自重新读 `Date.now()`。
- 若 lazy-evaluate 结果不属于 domain 真相，可以刷新 projection cache，但不要把纯 query refresh 变成新的事件写路径。

## [Convention] 真实资金 transfer 要复用既有 `transfer_order` / controller，并按 runtime 做隔离

- 来源任务：`signal-trader-funding-transfer`（2026-03-23）
- 当 signal-trader 需要真实资金划转时，不要自造第二套 transfer 协议；优先复用 `ITransferOrder`、`transfer_order` 与 `apps/transfer-controller`。
- transfer ack 仍然属于宿主副作用，不要把它写回 core domain 真相；core 只提供 `funding_account` / `trading_account` 这类 logical projection。
- 若 runtime 会发起真实 transfer，活动单查询必须带 `runtime_id` 这类隔离维度；否则跨 runtime 可能误复用彼此的转账状态。
- pre-order transfer-in 与 observer transfer-out 要分开编排：前者保证下单前资金到位，后者在空闲 observer 周期归集闲置余额。

## [Convention] 资本系统升级先做最小可解释闭环，再做 full ledger

- 来源任务：`signal-trader-capital-system-completion`（2026-03-23）
- 对 `buffer_account`、internal netting、profit target、reconciliation 这类资本语义，先冻结最小闭环与守恒关系，再扩完整会计模型；不要一开始把 rounding/fee/transfer/PnL 全塞进同一轮。
- account-scoped 结论必须按 `account_id / reserve_account_ref` 计算 projected balance；不能把全局资本误当成单账户真相。
- 新增资本聚合 query（如 investor/signal/reconciliation）应默认按更保守的读权限发布；匿名读应视为显式配置，而不是默认值。

## [Convention] 正式价格证据必须来自受控行情源，不能复用 submit payload

- 来源任务：`signal-trader-formal-quote-source`（2026-03-23）
- 当 signal-trader 需要把价格写进事件真相（如 `MidPriceCaptured`）时，正式价格证据不能继续来自 `submit_signal.entry_price` 这类外部 payload。
- 正式价格源应由 app 基础设施层读取（例如 SQL `QUOTE` 表）并注入到 core；core 只消费规范化后的 evidence，不直接触基础设施。
- 若同一 `product_id` 存在多 datasource 而未显式配置选择规则，应 fail-close，不要偷偷 latest-wins。
- quote 缺失时可以让 internal netting fail-close，但至少要留下可观测审计痕迹。

## [Convention] 前端同步后端新能力时，默认走“可读摘要 + 受控证据面”，不要整对象裸透传

- 来源任务：`signal-trader-ui-capital-sync`（2026-03-23）
- 当前端需要同步后端新能力（capital、investor、signal、advisory、formal evidence 等）时，优先先做 summary card，再保留原始证据下钻。
- 事件流 / 审计 / runtime config / projection 的“原始”展示也应经过前端 allowlist/sanitize 处理，不要把后端 payload/detail 整对象直接丢进浏览器。
- 前端写区不要补传后端内部增强字段（如 `reference_price*`）；这类字段若存在，也应由后端 worker / server 自己注入。

## [Convention] 本地联调需要运行时推进时间时，优先做 paper-only clock offset，不改系统时间

- 来源任务：`signal-trader-paper-time-control`（2026-03-23）
- 若目标只是验证 daily burn / capital projection / D+1 行为，应优先引入 paper-only clock offset，而不是改宿主系统时间。
- manager / worker / query / submit 必须共用同一个 paper clock；live 路径不得读取 offset。
- 对外入口优先做 service + CLI，且默认 bootstrap 不注册 clock service，只有显式启用的 paper bootstrap 才开放。

## [Convention] daily burn 若目标是“固定日拨资本”，就不能再把 trading account 当成已占用风险额度

- 来源任务：`signal-trader-daily-transfer-allocation`（2026-03-23）
- 当业务目标是“无论下单与否，每天固定从 funding 向 trading 拨资”时，`trading_account` 应表示已拨资本池，而不是 `current_reserved_vc`。
- 对应地：`funding_account` 表示未拨资本，`available_vc` 才表示还能继续扩张的容量。
- runtime transfer target 应统一走 `max(trading_account, current_reserved_vc + precision_locked_amount) + buffer`，这样 over-reserved 场景不会误 sweep 现有仓位所需资金。
- paper/live 的日拨资金入口要独立于下单动作：paper 通过 boot / paper clock / submit，live 通过 boot / observer / submit 兜底。

## [Convention] 带后台轮询的 runtime 测试默认要让 timer 可退出

- 来源任务：`signal-trader-jest-open-handles`（2026-03-24）
- 如果 runtime 在测试里会启动后台轮询（如 observer loop），默认要么显式 `dispose()`，要么让 timer `unref()`，最好两者同时具备。
- 不要用 `forceExit`、吞 warning、拉长 timeout 这种方式压问题；先修真正的 open handles。
- 对这类修复的验收口径，优先看单包 build 与 Rush build 中的 worker forced exit warning 是否真正消失。

## [Convention] 资本系统的正式流程测试要优先断言资金语义，而不是只数事件

- 来源任务：`signal-trader-formal-process-tests`（2026-03-24）
- 对 daily allocation / VC / observer 这类正式流程，优先断言 `released_vc_total`、`funding_account`、`trading_account`、`available_vc` 等资金语义。
- 事件数、audit 次数可以作为辅助断言，但不应成为唯一护栏。
- live formal-process 测试若必须依赖轮询节奏，优先用 fake timers 控住“同一 snapshot 不重复、跨天 + 新 snapshot 才继续”的业务边界。

## [Convention] mock 账户若要接入前端，优先复用标准 `AccountInfo`，并使用派生 `mock account_id`

- 来源任务：`signal-trader-mock-exchange-account-ui`（2026-03-24）
- mock/paper 路径如果需要把账户状态给前端看，优先输出标准 `QueryAccountInfo` / `AccountInfo`，不要再造第三套 mock-only 账户协议。
- 不要直接复用 runtime 原始 `account_id`；应派生唯一 `mock account_id`，避免多个 paper runtime 复用同一原始 account_id 时串线。
- allocation balance 与 mock account equity 需要分层维护：transfer 预算语义继续走 `queryTradingBalance`，交易盈亏只进 mock `IAccountInfo`。
- 若标准读面会对外暴露，至少绑到 `allowAnonymousRead === true` 这类显式门禁；authenticated-only 标准读面应另开任务设计授权模型。

## [Convention] profit target auto-flat 应由 app/runtime 编排，外部不得伪造 internal `agent` 来源

- 来源任务：`signal-trader-mock-exchange-account-ui`（2026-03-25）
- `profit_target_value` 命中后的自动动作，优先由 runtime worker 在 app 层追加 `submit_signal(signal=0, source='agent')`，不要在 core 的 account snapshot command 里直接伪造成交事件。
- `audit_only` 可以为内部 `agent` forced-flat 开绿灯，但外部请求若传 `source='agent'` 必须在入口降级或拒绝，避免绕过 fail-close 写边界。
- auto-flat 进入 `flatten_requested` 后，要显式封住外部新 signal；直到真正 flat 并把 subscription 关到 `closed`，才算生命周期结束。
- forced-flat 订单 attribution 要按 `target_position_qty - settled_position_qty` 计算，而不是只看 `target_position_qty`，否则 close fill 会丢失回写目标。
