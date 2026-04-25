# signal-trader-formal-quote-source - 上下文

## 会话进展 (2026-03-23)

### ✅ 已完成

- 已完成初步调研：确认正式价格源应直接使用 SQL `QUOTE` 表，当前 `MidPriceCaptured` 仍依赖 `submit_signal.entry_price`。
- 已完成 task-local RFC 与 review-rfc，正式价格源方案已收敛：SQL `QUOTE` provider + worker 注入 + quote 缺失 fail-close。
- 已在 `apps/signal-trader` 落地 SQL quote provider，并通过 `RuntimeWorker` 注入 formal reference price evidence。
- 已在 `libraries/signal-trader` 切换 internal netting 正式价格判定，`reference_price*` 不再进入 idempotency fingerprint。
- 已完成验证：`libraries/signal-trader` build 通过、26 tests passed；Rush 下 `@yuants/signal-trader` 与 `@yuants/app-signal-trader` 联合构建通过。

### 🟡 进行中

- 正在整理测试报告、代码/安全评审与 walkthrough / PR body。

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                                   | 原因                                                                                                                   | 替代方案                                                                                              | 日期       |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| 正式价格源由 app 层 SQL quote provider 注入到 core；core 只消费规范化后的价格证据，不直接触 SQL。                                      | 这样可以保持 `libraries/signal-trader` 的纯事件溯源/纯函数边界，同时让 `apps/signal-trader` 负责基础设施访问。         | 让 core 直接查询 SQL quote 表；缺点是会把基础设施依赖硬塞进共享库，破坏边界。                         | 2026-03-23 |
| quote 缺失时 internal netting fail-close，不再把 `submit_signal.entry_price` 当作正式价格真相回退。                                    | 用户已经明确要求正式价格源参考 SQL quote 表；继续把 entry_price 当正式真相会让这轮改动失去意义。                       | quote 缺失时回退到 `entry_price`；优点是兼容性更强，缺点是正式价格源语义不成立。                      | 2026-03-23 |
| 未显式指定 datasource 且同一 product 存在多条 quote 行时，直接 fail-close `QUOTE_AMBIGUOUS_DATASOURCE`，不做 latest-wins。             | SQL `QUOTE` 的主键是 `(datasource_id, product_id)`；若没有唯一来源却偷偷选最新行，就会把隐式仲裁误包装成正式价格真相。 | 按 `updated_at DESC LIMIT 1` 直接选最新 quote；优点是实现更省事，缺点是会把 datasource 歧义静默吞掉。 | 2026-03-23 |
| `reference_price*` 只作为 app->core 内部增强字段使用；外部 submit payload 即使带这些字段，也必须在 worker 内被忽略并由 provider 覆盖。 | 否则正式价格真相仍可能来自外部输入，任务目标会在边界层失效。                                                           | 公开信任外部 `reference_price*`；优点是接线更简单，缺点是安全与审计语义都不成立。                     | 2026-03-23 |

---

## 快速交接

**下次继续从这里开始：**

1. 将 `.legion/tasks/signal-trader-formal-quote-source/docs/pr-body.md` 作为 PR 描述发起 review。
2. 如需继续加强正式价格源，下一轮优先补 freshness gate 与 quote miss 的 health/metric 可观测性。

**注意事项：**

- 关键产物已齐：`rfc.md`、`review-rfc.md`、`test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。
- 当前审查结论：code/security review 均为 `PASS-WITH-NITS`；剩余主要是 freshness gate、公共命令类型边界与 app test teardown warning。

---

_最后更新: 2026-03-23 15:43 by Claude_
