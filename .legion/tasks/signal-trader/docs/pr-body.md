# Summary

- 新增 `@yuants/signal-trader` Rush library，并将其接入 monorepo 构建体系。
- 按 RFC 落地事件溯源核心库：覆盖命令分发、事件追加、replay、projection / event stream 查询、执行 effect 与 mock execution port。
- 补齐关键测试、API report 与评审材料，形成可评审、可验证、可继续集成的 V1 最小闭环。

## What

- 新建 `libraries/signal-trader` 包，并在 `rush.json` 中注册项目。
- 提供 V1 冻结 API：事件溯源状态初始化、命令分发、事件追加/重放、projection 查询、event stream 查询、execution effects 与 mock port。
- 补充 API report、测试报告、代码评审与安全评审文档。

## Why

- 仓库此前缺少与 RFC 对齐的 `signal-trader` 共享核心库，导致后续宿主接入、回放审计与执行闭环没有统一契约。
- 本 PR 先交付 production-grade core lib + mock，优先冻结事件模型、重放一致性和执行边界，为后续 `audit_only -> paper -> live` 接入打基础。

## How

- 以根 RFC 为唯一设计真源，将系统事实收敛到 append-only 事件流，projection/snapshot 仅作为派生读模型。
- 将实现范围收敛到四条主命令链：`upsert_subscription`、`submit_signal`、`apply_execution_report`、`capture_authorized_account_snapshot`。
- 通过 mock execution port、定向 Rush build、API report 与 review 文档完成本轮交付验证。

## Testing

- PASS: `node common/scripts/install-run-rush.js build -t @yuants/signal-trader`
- 详情见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/test-report.md`
- 评审结果：
  - 代码评审 PASS：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/review-code.md`
  - 安全评审 PASS：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/review-security.md`

## Risks/Follow-ups

- `queryEventStream` 当前更偏最小查询面，若未来承担完整审计检索职责，建议补说明或增强检索能力。
- mock execution port 虽已加运行时守门，仍建议后续迁移到显式 testing/unsafe 导出路径。
- 后续宿主接入若出现 replay 不一致、对账异常或不可解释状态漂移，应按 RFC 回滚到 `audit_only`，停止新的外部订单 effect。

## Key Files

- RFC：`/Users/c1/Work/signal-trader/signal-trader-rfc-v1-事件溯源重排版.md`
- 包入口：`/Users/c1/Work/signal-trader/libraries/signal-trader/src/index.ts`
- 命令分发：`/Users/c1/Work/signal-trader/libraries/signal-trader/src/engine/dispatch-command.ts`
- 重放与查询：
  - `/Users/c1/Work/signal-trader/libraries/signal-trader/src/engine/replay-events.ts`
  - `/Users/c1/Work/signal-trader/libraries/signal-trader/src/engine/query-projection.ts`
  - `/Users/c1/Work/signal-trader/libraries/signal-trader/src/engine/query-event-stream.ts`
- 执行端口：
  - `/Users/c1/Work/signal-trader/libraries/signal-trader/src/ports/execution-port.ts`
  - `/Users/c1/Work/signal-trader/libraries/signal-trader/src/ports/mock-execution-port.ts`
- 测试：`/Users/c1/Work/signal-trader/libraries/signal-trader/src/index.test.ts`
- API report：`/Users/c1/Work/signal-trader/libraries/signal-trader/etc/signal-trader.api.md`

## Links

- Plan：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/plan.md`
- RFC：`/Users/c1/Work/signal-trader/signal-trader-rfc-v1-事件溯源重排版.md`
- Walkthrough：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/report-walkthrough.md`
- Review RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/review-rfc.md`
- Review Code：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/review-code.md`
- Review Security：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/review-security.md`
- Test Report：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/test-report.md`
