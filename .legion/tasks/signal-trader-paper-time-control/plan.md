# signal-trader-paper-time-control

## 目标

为 paper stack 增加可运行时控制的时间偏移能力，使本地联调时可推进到下一天验证 daily burn 与资本系统行为。

## 问题定义

- 当前 signal-trader runtime 在运行态直接使用 `Date.now()`，只有 Jest 测试里能用 fake timers 控时间。
- 这意味着本地 paper stack 虽然能跑完整后端和前端，但用户无法在不改系统时间的前提下推进到 D+1 / D+2 验证 daily burn、capital projection 与 signal 行为。
- 用户已经明确希望“运行中的 paper stack”支持时间前进，因此本轮需要给 paper-only 路径补一个可操作的时间控制能力。

## 验收标准

- 运行中的 paper stack 支持查询当前 paper clock 状态。
- 运行中的 paper stack 支持在不改系统时间的前提下推进 paper 时间（至少支持 `+1d`）。
- paper time advance 会影响：
  - `QueryProjection`
  - `SubmitSignal`
  - runtime replay / budget refresh
- live 语义不受影响；live 仍继续使用真实 `Date.now()`。
- 提供可直接给人类使用的脚本入口，至少支持：
  - `status`
  - `advance 1d`
  - `set`
  - `reset`
- 新增测试至少覆盖：
  - manager 级 paper clock advance
  - service 注册与 paper clock service 可读性
- 生成并落盘：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- 本轮时间控制只对 paper 生效，不扩到 live。
- 首版时间控制采用“全局 paper offset”模型，不做每个 runtime 独立时钟。
- 首版不要求加前端时间按钮；CLI 脚本足够满足本地联调。
- paper clock 状态可以只保存在进程内存中；stack 重启后归零。

## 约束

- 文档语言使用中文；代码默认 ASCII。
- Scope 限制在：
  - `.legion/tasks/signal-trader-paper-time-control/**`
  - `apps/signal-trader/**`
  - `ui/signal-trader-web/scripts/**`
  - `.legion/playbook.md`
- 不改 live transfer / quote / capital 主链协议。
- 不引入数据库 schema 或持久化 paper clock 状态。

## 风险分级

- **等级**：Medium
- **标签**：`continue` `paper` `time-control`
- **理由**：这会新增 paper-only 服务与脚本入口，并改变 paper 运行态的时间来源；虽然不触及 live 资金链，但仍会影响 runtime replay/query/submit 的行为，需要任务级设计与验证闭环。

## 要点

- 只对 paper 生效
- 不改系统时间
- 运行中的 stack 可直接推进到下一天
- 通过 CLI/service 控制，而不是只在测试里 fake timers

## 范围

- `.legion/tasks/signal-trader-paper-time-control/**`
- `apps/signal-trader/**`
- `ui/signal-trader-web/scripts/**`
- `.legion/playbook.md`

## Design Index

- 前端 paper stack 启动：`/Users/c1/Work/signal-trader/ui/signal-trader-web/scripts/run-paper-stack.mjs`
- paper bootstrap：`/Users/c1/Work/signal-trader/ui/signal-trader-web/scripts/bootstrap-paper-app.mjs`
- runtime manager：`/Users/c1/Work/signal-trader/apps/signal-trader/src/runtime/runtime-manager.ts`
- runtime worker：`/Users/c1/Work/signal-trader/apps/signal-trader/src/runtime/runtime-worker.ts`
- 本任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/rfc.md`

## 最小实现边界

- 包含：paper clock controller、paper-only services、CLI 控制脚本、manager/worker 接线、最小测试与文档。
- 暂不包含：前端时间控制 UI、持久化 clock、live 时间控制、复杂日历/时区语义。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-23 | 最后更新: 2026-03-23 17:13_
