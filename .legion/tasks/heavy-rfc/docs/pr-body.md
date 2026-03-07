## What

本 PR 交付 `@yuants/live-trading` V1 core lib 的实现阶段成果。
核心能力覆盖纯状态机命令分发、风控与仓位规划、审计事件输出、effect 规划和查询接口。
实现保持“单一 core lib、无运行时副作用”边界，副作用通过 `planned_effects` 由宿主执行。

## Why

heavy RFC 已冻结关键语义，需要将设计门禁转为可验证实现，避免后续集成阶段语义漂移。
该能力直接承载实盘资金风控边界（幂等、限流、冷却、TP/SL、拒绝审计），必须先形成可测试内核。
本 PR 目标是让宿主在不引入交易所/DB 耦合的前提下完成集成与灰度演练。

## How

实现集中在 `libraries/live-trading/src/**`：`types` 契约、`domain` 仓位规划、`engine` 命令分发与查询、`index` 导出。
`dispatchCommand` 落地 `submit_signal/update_risk_policy`、`close_then_open`、全局 `signal_id` 幂等、拒绝审计与限流冷却控制。
测试在 `live-trading-core.test.ts` 覆盖 23 个用例，覆盖幂等冲突、时间窗/单调性、风控拒绝、反手和平仓等关键路径。

## Testing

- 见 `.legion/tasks/heavy-rfc/docs/test-report.md`。
- `npx heft test --clean`（workdir: `libraries/live-trading`）: PASS，Jest 1 suite（`lib/live-trading-core.test.js`）`23/23`。
- `rush build --to @yuants/live-trading`（workdir: `/Users/c1/Work/Yuan`）: PASS。
- 代码评审：`.legion/tasks/heavy-rfc/docs/review-code.md`（PASS，blocking=0）。
- 安全评审：`.legion/tasks/heavy-rfc/docs/review-security.md`（PASS，blocking=0）。

## Risk / Rollback

- 残余风险：未知异常审计兜底、错误信息脱敏、审计容量挤出监控仍建议在宿主层加强。
- 回滚策略：触发阈值后切 `execution_mode=audit_only`，停止新开仓 effect，仅保留审计/通知并执行在途补偿。
- 如需代码回退，优先回滚到上一稳定 core lib 版本，并通过审计事件重建状态。

## Links

- Task Brief: `.legion/tasks/heavy-rfc/docs/task-brief.md`
- RFC: `.legion/tasks/heavy-rfc/docs/rfc.md`
- Code Review: `.legion/tasks/heavy-rfc/docs/review-code.md`
- Security Review: `.legion/tasks/heavy-rfc/docs/review-security.md`
- Test Report: `.legion/tasks/heavy-rfc/docs/test-report.md`
- Walkthrough: `.legion/tasks/heavy-rfc/docs/report-walkthrough.md`
