# signal-trader-ui-console

## 目标

在 `ui/web` 中新增一个 signal-trader 控制台页面，支持选择 runtime、发布 `-1 / 0 / 1` 信号，并查看 runtime 状态、事件流与审计信息。

## 问题定义

- `@yuants/app-signal-trader` 已具备 `SignalTrader/*` 服务面与 SQL 审计表，但当前缺少可直接复用的 GUI 页面，导致日常联调、paper 验证与 live 值班排障仍需要手工调服务或查 SQL。
- 用户需要一个最小但可用的前端控制台，用于两类核心动作：
  - 发信号：向选中的 runtime 发布 `-1 / 0 / 1`
  - 看状态：查看 runtime health、projection、event stream 与 audit log
- 该页面虽然首版很小，但它位于 high-risk live host 的控制面边界上；如果把读写权限、状态语义或 live 风险提示做模糊，会放大误操作风险。

## 验收标准

- 在 `ui/web` 中新增 signal-trader 页面，并能通过现有页面注册机制打开。
- 页面至少包含以下区块：
  - runtime 选择与刷新
  - runtime 状态卡
  - `SubmitSignal` 信号提交卡
  - projection 视图
  - event stream 明细
  - runtime audit log 明细
- runtime/config/health/projection/event 优先通过现有 `SignalTrader/*` 服务读取：
  - `SignalTrader/ListRuntimeConfig`
  - `SignalTrader/GetRuntimeHealth`
  - `SignalTrader/QueryProjection`
  - `SignalTrader/QueryEventStream`
  - `SignalTrader/QueryRuntimeAuditLog`
  - `SignalTrader/SubmitSignal`
- 为避免在高风险控制面复用通用 SQL 入口，首版补一个标准只读服务 `SignalTrader/QueryRuntimeAuditLog`，由后端以 runtime 维度返回受限审计字段。
- `SubmitSignal` 表单默认只暴露最小必要字段：
  - `signal`（`-1 / 0 / 1`）
  - 可选高级字段：`entry_price`、`stop_loss_price`、`metadata`
  - `signal_id`、`signal_key`、`product_id`、`source`、`command_type`、`upstream_emitted_at` 由页面根据 runtime/config 自动生成或带出
- `SignalTrader/SubmitSignal` 的真实安全边界仍在服务端：UI 自动带出只是便捷性；后端必须继续基于 `runtime_id` 对 health / freshness / signal scope 做权威校验并拒绝不匹配请求。
- live runtime 必须有明显风险提示与二次确认；`stopped` / `degraded` / `audit_only` 默认禁用发信号按钮。
- 无权限或服务未开放时，页面需明确展示 `403`/失败原因，不得静默失败。
- 生成并通过：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- `ui/web` 继续复用现有 Host/Terminal 连接、页面注册、表单、表格与 SQL 查询模式，不新建独立前端工程。
- `SignalTrader/*` 的已发布服务契约保持稳定，可满足 runtime/config/health/projection/event 的首版读取与写入需求。
- 首版 audit log 可以接受走 SQL 直读，前提是不绕过敏感字段保护边界，不读取 `signal_trader_runtime_config` 原表中的潜在敏感内容。
- 首版不引入新的鉴权体系，仍沿用 Host / `servicePolicy` 现有授权结果。

## 约束

- 只在以下路径内修改：
  - `ui/web/**`
  - `apps/signal-trader/**`
  - `docs/zh-Hans/packages/@yuants-ui-web.md`
  - `apps/signal-trader/GUIDE.md`
- 文档语言使用中文；前端页面标题/i18n 继续遵循 `ui/web` 现有多语言结构。
- 首版不做新的后端 mutating/operator 服务；仅复用现有 `SignalTrader/SubmitSignal` 与只读服务。
- 首版允许新增一个只读服务 `SignalTrader/QueryRuntimeAuditLog`，用于替代通用 SQL 直读审计表。
- 首版不把 operator backfill/unlock 放进页面，避免把高危人工接管操作与发信号 MVP 混在一起。
- 首版不做自动轮询或复杂图表；以手动刷新 + 简单表格/卡片为主。

## 风险分级

- **等级**：High
- **标签**：`ui` `signal-trader` `control-plane` `risk:high`
- **理由**：该任务虽然以 GUI 为主，但页面会直接触发 `SignalTrader/SubmitSignal`，并面向 live runtime 展示与操作高风险控制面。若状态语义、权限提示或交互护栏处理不当，可能造成误触发实盘信号或误判运行态。

## 要点

- 优先复用 `ui/web` 现有 Host/Terminal、Form、DataView、SQL 访问与页面注册机制，避免单独起一个前端重复造轮子
- runtime/config/health/projection/event 优先走 `SignalTrader/*` 服务；audit log 若无标准只读服务，首版按现有 UI 模式 SQL 直读
- 发布信号页面必须显式展示 runtime、mode、product、signal，并避免重复点击导致的误操作
- 默认把 mutating action 与只读信息分区，延续 signal-trader 现有 fail-close / 审计 / 高风险提示语义
- 首版只覆盖“发信号 + 看状态/审计”，不把 operator runbook 动作并入同页

## 范围

- `ui/web/**`
- `apps/signal-trader/**`
- `docs/zh-Hans/packages/@yuants-ui-web.md`
- `apps/signal-trader/GUIDE.md`

## Design Index

- signal-trader 宿主指南：`/Users/c1/Work/signal-trader/apps/signal-trader/GUIDE.md`
- UI 控制台 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-ui-console/docs/rfc.md`
- RFC 审查：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-ui-console/docs/review-rfc.md`

## 最小实现边界

- 包含：新增 `SignalTraderConsole` 页面、runtime 选择/状态/提交/事件/审计 6 个区块、最小 i18n 标题、最小文档更新。
- 暂不包含：operator backfill/unlock UI、自动轮询、复杂图表、独立鉴权层、独立前端工程。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 1 个任务

---

_创建于: 2026-03-19 | 最后更新: 2026-03-19 21:25_
