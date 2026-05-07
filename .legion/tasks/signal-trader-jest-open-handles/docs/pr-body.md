# What

本 PR 修复 `@yuants/app-signal-trader` 在 Jest/Heft 构建链路中的 open handles / worker forced exit 问题。
改动聚焦 `apps/signal-trader` 运行时生命周期：让 observer loop 的 timer 不再阻塞进程退出，并明确 manager 级清理出口。
本次不引入测试框架重构，也不通过 `--forceExit`、过滤 warning 等方式做“假修复”。

## Why

当前 warning 虽不一定导致测试失败，但会污染 CI / 本地构建信号，并掩盖真实的 teardown 缺口。
RFC 判断根因集中在 live runtime observer loop 与生命周期未闭环，而不是 Jest 配置本身。
因此采用最小修复面，优先消除真实资源残留，同时保持业务行为不变。

## How

- 收口 observer timer 调度，并对 timer 使用 `unref()`，避免其单独持有 Node 进程。
- 明确 `RuntimeManager.dispose()` 的清理职责，作为运行时资源回收入口。
- 用单包 build、Rush 定向 build 与 `--detectOpenHandles` 辅助命令回归，确认 worker forced exit warning 已消失。

## Testing

- 详见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/test-report.md`
- `npm run build`（`apps/signal-trader`）: PASS
- `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`: PASS
- `npx jest lib/__tests__/signal-trader-app.test.js --runInBand --detectOpenHandles`: PASS

## Risk / Rollback

- 风险等级：Low；本次仅涉及 observer timer 生命周期与 manager 清理边界，不改业务协议或权限面。
- 若出现运行态时序异常，可优先回滚 `RuntimeManager.dispose()` 相关接入或 observer loop 生命周期调整。
- 代码审查与安全审查均已通过。

## Links

- Plan: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/plan.md`
- RFC: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/rfc.md`
- RFC Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/review-rfc.md`
- Code Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/review-code.md`
- Security Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/review-security.md`
- Walkthrough: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/report-walkthrough.md`
