# signal-trader-ui-capital-sync - 上下文

## 会话进展 (2026-03-23)

### ✅ 已完成

- 已完成 task-local RFC 与 review-rfc，前端 capital 同步方案已收敛。
- 已在 `ui/signal-trader-web` 同步 capital/investor/signal/formal quote/advisory/reconciliation 视图，并保留经过 sanitize 的原始证据面。
- 已完成前端验证：`npm run build` 与 `npm run test:e2e:paper` 均通过。

### 🟡 进行中

- 正在整理 walkthrough / PR body 并收尾任务文档。

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                    | 原因                                                                                                                | 替代方案                                                                                          | 日期       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| 原始证据面保留，但一律通过 `sanitize*` 过滤后展示，而不是整对象裸透传。 | 前端既要给用户核对 formal quote / netting / advisory 结论来源，又不能把后端未来可能新增的敏感字段自动暴露到浏览器。 | 1) 完全删掉原始证据面；缺点是排障能力下降。2) 直接展示完整 payload/detail；缺点是信息暴露面过大。 | 2026-03-23 |

---

## 快速交接

**下次继续从这里开始：**

1. 将 `.legion/tasks/signal-trader-ui-capital-sync/docs/pr-body.md` 作为 PR 描述发起 review。
2. 如需继续增强回归保护，下一轮优先补 front-end Playwright 对 capital / investor / signal / quote / reconciliation 字段值的稳定断言。

**注意事项：**

- 关键产物已齐：`rfc.md`、`review-rfc.md`、`test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。
- 当前审查结论：code/security review 均为 `PASS-WITH-NITS`；剩余主要是 front-end 自动化断言强度与更严格的 sanitize allowlist。

---

_最后更新: 2026-03-23 16:21 by Claude_
