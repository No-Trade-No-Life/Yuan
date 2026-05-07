# app-signal-trader-live-integration

## 目标

创建一个新的 `@yuants/app-signal-trader` 宿主应用，集成 `@yuants/signal-trader`，支持可复现的本地 `paper` 闭环，并在 fail-close 前提下通过宿主注入的 `liveVenue` / `observerProvider` 支持通用 live execution。

## 问题定义

- 仓库已有 `@yuants/signal-trader` core library，但缺少真正可运行的宿主 app：没有 runtime 配置、事件持久化、live/paper 执行适配、订单绑定、重启恢复与故障锁定协议。
- 如果没有这一层，就只能“在库里跑单测”，无法把 signal-trader 作为可部署 app 接入 Yuan 现有 Terminal / vendor / SQL 生态。
- live 风险不在 core 公式，而在宿主边界：凭证引用、`internal/external order id` 翻译、execution observation、replay、fail-close 与人工接管。

## 验收标准

- 新增 `apps/signal-trader`（包名 `@yuants/app-signal-trader`），并接入 Rush 构建体系。
- 存在可重复执行的 SQL migration，至少包含：
  - `signal_trader_runtime_config`
  - `signal_trader_event`
  - `signal_trader_order_binding`
  - `signal_trader_runtime_checkpoint`
  - `signal_trader_runtime_audit_log`
- app 暴露 `SignalTrader/*` 服务面，至少覆盖：
  - `UpsertRuntimeConfig`
  - `ListRuntimeConfig`
  - `ListLiveCapabilities`
  - `SubmitSignal`
  - `QueryProjection`
  - `QueryEventStream`
  - `ReplayRuntime`
  - `GetRuntimeHealth`
  - `DisableRuntime`
  - `BackfillOrderBinding`
  - `UnlockRuntime`
- `paper` 模式能按明确 runbook 跑通一条 signal 的 `event -> effect -> report -> projection` 闭环。
- `live` 模式不再在 app 内部写死 vendor / product 白名单；只允许宿主通过 `observer_backend` 对应的 capability descriptor + 注入的 `liveVenue` / `observerProvider` 声明支持矩阵，且能做到：
  - 缺失 capability descriptor、descriptor key 不匹配或关键能力不足时 fail-close
  - support matrix 可通过 `SignalTrader/ListLiveCapabilities` 枚举，并在 audit log 中追溯 `descriptor_hash` / `validator_result`
  - `authorize_order.account_id` 与配置 `account_id` 不一致时 fail-close
  - 缺失 `external_submit_order_id/external_operate_order_id` 时 fail-close
  - 生成 `modify_order` effect 时 fail-close
  - 重启后可从 event store + checkpoint 恢复，且不重复下单
- 生成并通过：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- 根目录 `signal-trader-rfc-v1-事件溯源重排版.md` 是 core domain 真源；本任务只新增宿主能力，不重写 core 语义。
- 本仓库已有 `@yuants/app-host`、`@yuants/app-postgres-storage`、`@yuants/exchange`、`@yuants/secret`、`@yuants/sql` 等基础能力可复用。
- `account_id` 由 runtime 配置给出，且与 `QueryAccountInfo/QueryPendingOrders` 的账号键一致；宿主不从 secret 自动推导或覆盖它。
- 首版 live 只做最小可信路径：一 runtime = 一 product = 一 subscription = 一 in-flight external order。

## 约束

- 只在以下路径内修改：
  - `apps/signal-trader/**`
  - `libraries/signal-trader/**`
  - `tools/sql-migration/sql/**`
  - `rush.json`
  - `common/config/rush/**`
- 文档语言使用中文。
- 不存储明文 credential；live 只允许 `secret_ref`。
- fail-close 是固定行为，不做 runtime 级关闭开关。
- 首版 live 不支持隐式宿主能力、不支持 `modify_order` 作为正常路径、不支持多 subscription / 多 product / 多 worker。

## 风险分级

- **等级**：High
- **标签**：`app` `live-trading` `event-store` `risk:high`
- **理由**：该任务把纯库能力提升为可执行实盘宿主，涉及真实下单、资金账户、订单归因、故障恢复与人工接管协议；若设计或实现失误，会直接造成重复下单、错单或不可恢复的未知在途订单。

## 要点

- 用 SQL 持久化 runtime 配置、事件流、订单绑定与 checkpoint
- runtime 配置同时承载 canonical subscription 参数，worker 自动镜像为内部 `upsert_subscription`
- `paper` 优先交付可复现 runbook，不再承诺“单命令包打天下”
- live 支持矩阵不再由 app 内部硬编码白名单冻结，而由宿主注入的 `liveVenue` / `observerProvider` 能力与外部观测链决定
- capability registry 必须是显式、可枚举、可审计的 support matrix 真源
- 执行层必须统一做 `internal_order_id -> external_operate_order_id` 翻译
- 未知订单 / binding 缺失 / 账户漂移 / observer 缺失时，锁死到 `audit_only`，通过人工 runbook 才能解锁
- operator 审计身份必须来自受信认证上下文，不接受请求体自报身份作为审计真源

## 范围

- `apps/signal-trader/**`
- `libraries/signal-trader/**`
- `tools/sql-migration/sql/**`
- `rush.json`
- `common/config/rush/**`

## Design Index

- Core 真源：`/Users/c1/Work/signal-trader/signal-trader-rfc-v1-事件溯源重排版.md`
- 宿主 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/app-signal-trader-live-integration/docs/rfc.md`
- RFC 审查：`/Users/c1/Work/signal-trader/.legion/tasks/app-signal-trader-live-integration/docs/review-rfc.md`

## 最小实现边界

- 包含：新 app、runtime manager、event store、binding/checkpoint repository、SignalTrader 服务面、paper execution adapter、宿主注入 live adapter / observer / capability descriptor 校验、恢复/锁定协议、SQL migration、测试与 runbook。
- 暂不包含：弱能力 live profile、多 product runtime、多 subscription runtime、复杂 order rebasing、改 core 事件语义。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现宿主 app** - 3 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-18 | 最后更新: 2026-03-19 20:00_
