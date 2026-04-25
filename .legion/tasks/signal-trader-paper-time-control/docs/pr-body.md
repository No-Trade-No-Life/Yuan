# 变更说明

## What

- 为 `signal-trader` 的 paper stack 增加运行态时间偏移能力，支持在不修改系统时间的前提下查询、推进、设置与重置 paper clock。
- 新增 paper-only service 与 CLI 脚本入口，并将 manager / worker / query / submit / replay 的关键业务取时路径统一到同一个 paper clock。
- live 语义保持不变，默认/bootstrap live 路径不暴露 paper clock service。

## Why

- 现有本地 paper 联调只能依赖真实时间流逝或测试里的 fake timers，无法在运行中的 stack 上直接验证 D+1 / D+2 的 `daily burn`、capital projection 与 signal 行为。
- 本次改动让开发者可以在 stack 已启动后手动推进 paper 时间，降低联调成本，同时避免修改整机系统时间带来的副作用与风险。

## How

- 在 `apps/signal-trader` 内引入全局 `PaperClockController`，以“真实时间 + 全局 offset”生成 paper 的 `effective_now_ms`。
- `RuntimeManager` 持有唯一 controller，`RuntimeWorker` 与 manager 级 query/submit/replay 统一经该 controller 取时；service 层新增 `Get/Advance/SetOffset/ResetPaperClock`。
- `ui/signal-trader-web/scripts` 中启用 paper bootstrap 的 clock services，并新增 `paper-clock.mjs` 供人类执行 `status`、`advance`、`set-offset`、`reset`。

## Testing

- 详见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/test-report.md`
- `npm run build`（workdir=`apps/signal-trader`）通过；Jest 2 个 suite / 48 个测试通过，存在已知 warning（TypeScript 版本提示、Jest worker 未优雅退出）。
- `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader` 通过；存在 Node 版本未验证与 worker forced exit warning。
- 手工 smoke `status -> advance 1d -> reset` 通过，确认 `offset_ms` 与有效时间变化符合预期。

## Risk / Rollback

- 风险主要集中在 paper-only 暴露面与单进程全局 offset 语义；若误把该能力暴露到共享或 live 环境，会扩大误用面。
- 回滚运行态可直接执行 `reset` 或重启 paper bootstrap；代码级回滚仅需撤销 paper clock controller、相关 services 与 CLI 脚本，不涉及 schema 或持久化数据回滚。

## Links

- Plan: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/plan.md`
- RFC: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/rfc.md`
- RFC Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/review-rfc.md`
- Code Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/review-code.md`
- Security Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/review-security.md`
- Walkthrough: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/report-walkthrough.md`
