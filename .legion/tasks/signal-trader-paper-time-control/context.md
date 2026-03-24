# signal-trader-paper-time-control - 上下文

## 会话进展 (2026-03-23)

### ✅ 已完成

- 已完成现状调研：确认运行态 paper stack 没有 time-travel 能力，只有测试在用 fake timers。
- 已在 `apps/signal-trader` 引入 `PaperClockController`，并让 manager/worker/query/submit 共用 paper-only 时间源。
- 已注册 paper-only 时钟服务：`Get/Advance/SetOffset/ResetPaperClock`，且默认 bootstrap 不暴露，只有显式启用的 paper bootstrap 才注册。
- 已在 `ui/signal-trader-web/scripts/paper-clock.mjs` 提供 CLI 入口，并完成 `status -> advance 1d -> reset` smoke。
- 已完成验证：`npm run build` 与 Rush build 通过，app 测试 48 passed。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                | 原因                                                                                       | 替代方案                                                                                             | 日期       |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------- |
| paper 时间控制采用“全局 paper offset + live 真实时间”的双轨模型，由 manager/worker 在运行态按 execution_mode 取时。 | 这样改动最小，又能保证 query/submit/replay 共用同一 paper 时间源，不污染 live 语义。       | 1) 改系统时间；缺点是危险且影响全机。2) 为每个 runtime 做独立 clock；缺点是 scope 更大，本轮不必要。 | 2026-03-23 |
| 运行态控制入口选 paper-only services + CLI 脚本，而不是先做前端按钮。                                               | 用户首先需要能马上手动推进到下一天验证行为；CLI/service 入口最直接，也不要求再改前端交互。 | 直接做前端按钮；优点是更直观，缺点是会额外扩大前端范围。                                             | 2026-03-23 |

---

## 快速交接

**下次继续从这里开始：**

1. 将 `.legion/tasks/signal-trader-paper-time-control/docs/pr-body.md` 作为 PR 描述发起 review。
2. 如需继续增强该能力，下一轮优先统一 paper adapter 的附属时间戳，并考虑是否需要 clock mutation 审计日志。

**注意事项：**

- 当前 paper stack 已可通过 `node ui/signal-trader-web/scripts/paper-clock.mjs status|advance 1d|set-offset 1d|reset` 控制时间。
- 关键产物已齐：`rfc.md`、`review-rfc.md`、`test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

_最后更新: 2026-03-23 17:34 by Claude_
