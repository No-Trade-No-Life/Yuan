# signal-trader-ui-console - 上下文

## 会话进展 (2026-03-19)

### ✅ 已完成

- 已生成 `docs/rfc.md`，收敛 signal-trader 控制台首版页面结构、接口/SQL 映射、SubmitSignal 字段策略与 live 风险控制。
- 已根据 `review-rfc.md` 的 blocker 重写 RFC：取消通用 SQL 直读审计，改为新增标准只读服务 `SignalTrader/QueryRuntimeAuditLog`；同时把 live 提交 gate、服务端权威校验、milestones/observability/rollback 收敛为可执行门禁。
- 已完成 signal-trader 控制台实现：在 `ui/web` 新增 `SignalTraderConsole` 页面，支持 runtime 选择、状态查看、SubmitSignal、projection、event stream、audit log。
- 已新增只读服务 `SignalTrader/QueryRuntimeAuditLog`，替代高风险控制面复用通用 SQL 直读审计表。
- 已完成验证与评审：`apps/signal-trader` `npm run build` 通过；`ui/web` `npm run build` 失败但归因为仓库既有 workspace/type 问题；`review-code.md` / `review-security.md` 均为 PASS-WITH-NITS。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

- `ui/web` 整体 build 仍被仓库既有依赖/类型问题阻塞（缺失多个 workspace 包类型声明与若干旧 TS 错误），本次新增 `SignalTraderConsole` 未在失败列表中单独冒烟。

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                | 原因                                                                                                                                                                                                                    | 替代方案                                                                                                                                             | 日期       |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| signal-trader 控制台首版采用“服务优先、SQL 兜底”的数据读取策略。                                                    | runtime/config/health/projection/event 已有明确 `SignalTrader/*` 契约，应优先复用；但 runtime audit log 当前没有标准只读服务，若环境允许受限只读 SQL，则首版可直接查询 `signal_trader_runtime_audit_log` 形成最小闭环。 | 在实现前先补一个新的审计只读服务；优点是权限与语义更清晰，缺点是会增加后端修改与交付范围。                                                           | 2026-03-19 |
| signal-trader 控制台首版不复用通用 SQL 入口读取审计表，而是补一个标准只读服务 `SignalTrader/QueryRuntimeAuditLog`。 | 对于 high-risk control-plane，audit 读取边界必须可辩护、可授权、可回滚。继续复用通用 SQL 会让读取面与 shared/prod 授权模型变得模糊；新增只读服务能把字段白名单、权限检查与未来脱敏策略收敛到后端。                      | 继续用参数化 SQL 模板直读 `signal_trader_runtime_audit_log`；优点是首版更快，缺点是难以证明没有扩大读取面，也更难在 shared/prod 环境下说明授权边界。 | 2026-03-19 |

---

## 快速交接

**下次继续从这里开始：**

1. 如需提交/开 PR，直接复用 `.legion/tasks/signal-trader-ui-console/docs/pr-body.md`。
2. 若要继续收口，可优先处理 `ui/web` 既有 build blocker，再重跑 `ui/web` 全量构建。
3. 若要进一步安全收敛，可继续做：`QueryRuntimeAuditLog` action-specific DTO 白名单、repository/SQL 层分页、`SubmitSignal.metadata` 后端体积/深度限制。

**注意事项：**

- 关键产物：`docs/rfc.md`、`docs/review-rfc.md`、`docs/test-report.md`、`docs/review-code.md`、`docs/review-security.md`、`docs/report-walkthrough.md`、`docs/pr-body.md`。
- 本次 live submit gate 已落地：health 复读 + stale fail-close + 手工输入 runtime_id 确认 + 后端权威校验。

---

_最后更新: 2026-03-19 22:14 by Claude_
