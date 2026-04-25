# What

本 PR 补强 `signal-trader` 的正式流程测试，重点覆盖 VC 按天释放、paper 日拨资，以及 live observer 在同 snapshot / 跨天新 snapshot 下的分配行为。
交付范围限定在 `libraries/signal-trader/**`、`apps/signal-trader/**` 与任务文档，未修改业务协议或生产运行态实现。

# Why

现有测试更偏功能点回归，对 formal process 的连续资金语义覆盖不够密，后续很容易在 daily allocation、observer transfer 或前端展示语义上再次漂移。
这批用例的目标是把“同日幂等、按天推进、预算封顶、跨 snapshot 才继续拨资”变成稳定的回归护栏。

# How

library 层新增 VC 正式流程测试，锁定同日重复 query 不双释放、跨多天后释放总额封顶到 `vc_budget`。
app 层新增 paper/live 正式流程测试，分别锁定不下单按日拨资、同日不重复补资、达到 cap 后停止拨资，以及 live 只有跨天且收到新 snapshot 才继续分配。
实现上优先断言资本语义，并保持 observer / transfer / balance 主链仍走真实调用路径，而不是通过过度 mock 降低测试价值。

# Testing

- 测试报告：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/test-report.md`
- `npm run build`（`libraries/signal-trader`）通过，Jest `27/27` 通过
- `npm run build`（`apps/signal-trader`）通过，Jest `51/51` 通过
- `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader` 通过
- 当前 warning 为工具链/环境提示，不是本次 formal-process 用例新增导致

# Risk / Rollback

- 风险整体较低，本轮只增加测试，不改生产逻辑
- 主要风险是 app/live 测试对 fake timers 与轮询节奏仍有一定依赖，未来若轮询机制调整需要同步维护
- 如需回滚，仅回退新增测试与相关文档，不回退业务代码

# Links

- Plan: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/plan.md`
- RFC: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/rfc.md`
- RFC Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/review-rfc.md`
- Code Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/review-code.md`
- Security Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/review-security.md`
- Walkthrough: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/report-walkthrough.md`
