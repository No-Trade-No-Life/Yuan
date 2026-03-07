# 实盘交易库 heavy RFC 设计 - 上下文

## 会话进展 (2026-03-05)

### ✅ 已完成

- 已创建并完善 task-brief.md，写入 rfcProfile=heavy 与 stage=design-only。
- 已完成 research.md 与 heavy rfc.md 产出。
- 已完成 RFC 对抗审查两轮：首轮 NEEDS_CHANGES、二轮 PASS。
- 已生成 RFC-only Draft PR 产物（report-walkthrough.md / pr-body.md）。
- 已按新增约束完成 RFC 收敛：仅提供单一 core lib，副作用通过 ports/effects 外置，不在库内绑定协议/数据库/消息场景。
- 已完成最终 focused review：RFC 满足“只提供一个 lib、无 Yuan 场景副作用”约束，review-rfc 结论 PASS（blocking=0）。
- 已复核 live-trading 当前实现并更新 security review；received_at 绕过面与拒绝审计缺口仍为 blocking。
- 已复核 now 漂移超窗与 non_monotonic 测试覆盖，并更新 review-code.md 为 PASS（blocking=0）。
- 已按 stage=design-only 更新 task-brief.md（rfcProfile=heavy）。
- 已融合会议结论重写 docs/research.md 与 docs/rfc.md（含公式、状态机、边界与 TBD）。
- 已完成 review-rfc focused re-review，blocking 已清零（PASS）。
- 已生成 RFC-only 报告产物：report-walkthrough.md 与 pr-body.md。
- 完成 `libraries/live-trading/**` 最终状态安全复核，并更新 `docs/review-security.md` 为 PASS（blocking=0）。
- 已完成 engineer 实现里程碑：submit_signal 拒绝路径统一审计（SignalRejected + emit_audit_event）并保持 core lib 无副作用边界。
- 已完成测试验证：npx heft test --clean（23/23）与 rush build --to @yuants/live-trading 通过。
- 已完成 review-code 终审：PASS（blocking=0）。
- 已完成 review-security 终审：PASS（blocking=0）。
- 已生成实现阶段 report-walkthrough.md 与 pr-body.md。
- 实现阶段端到端闭环完成：engineer 实现 + run-tests + review-code + review-security + report-walkthrough 全部执行。
- 测试通过：`npx heft test --clean`（23/23）与 `rush build --to @yuants/live-trading` 通过。
- 评审通过：review-code PASS（blocking=0）、review-security PASS（blocking=0）。
- 已刷新交付文档：test-report.md、review-code.md、review-security.md、report-walkthrough.md、pr-body.md。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `.legion/tasks/heavy-rfc/docs/task-brief.md`
- `.legion/tasks/heavy-rfc/docs/research.md`
- `.legion/tasks/heavy-rfc/docs/rfc.md`
- `.legion/tasks/heavy-rfc/docs/review-rfc.md`
- `.legion/tasks/heavy-rfc/docs/report-walkthrough.md`
- `.legion/tasks/heavy-rfc/docs/pr-body.md`

---

## 关键决策

| 决策                                                                                                                    | 原因                                                                                                                   | 替代方案                                                                  | 日期       |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- |
| 当前阶段固定为 stage=design-only，本轮不写生产代码。                                                                    | 按用户要求先收敛设计并走 RFC-only Draft PR 审阅流程，Merge 视为设计批准。                                              | 直接进入实现（不采用）                                                    | 2026-03-05 |
| 本任务设计档位固定为 rfcProfile=heavy。                                                                                 | 涉及资金风控、仓位与订单状态机，属于 High-risk，需要完整 RFC 约束后再进入实现。                                        | design-lite（不采用，约束不足）                                           | 2026-03-05 |
| 风险分级判定为 High。                                                                                                   | 设计直接决定实盘资金安全边界（止损/止盈/仓位/账户隔离），错误后果高且回滚成本高。                                      | Medium（不采用）                                                          | 2026-03-05 |
| 架构方案选择 Option B（分层状态机 + 命令/事件接口 + 投资者独立账本）。                                                  | 在可审计、可回滚、可测试之间平衡最佳，且复杂度显著低于全量事件溯源。                                                   | Option A 单体同步执行；Option C 全量事件溯源 + CQRS                       | 2026-03-05 |
| 冻结默认策略：reverse_mode=close_then_open、流动性分配=pro-rata、资金回流=逐笔。                                        | 先消除阻塞级歧义，保证实现阶段单一路径；后续变更通过 policy_version 升级与复审。                                       | 在实现阶段临时决定（不采用）                                              | 2026-03-05 |
| 本轮交付采用 RFC-only docs Draft PR，Merge 视为设计批准门禁。                                                           | 符合 stage=design-only 与少打扰原则，可在 PR 一次性收敛评审意见。                                                      | 会话内多轮口头确认（不采用）                                              | 2026-03-05 |
| RFC 设计文档强制对齐 Yuan 现有库建模（仅风格不绑运行时）：字段 snake_case、错误 newError、纯库无副作用边界。            | 减少实现分叉与接口风格漂移，同时满足“当前只提供一个 lib、不做场景副作用”。                                             | 沿用独立命名与在库内直接做协议/数据库副作用（不采用）                     | 2026-03-05 |
| 任务标签收敛为 `rfc:heavy` + `epic` + `risk:high` + `continue`，进入实现与验证闭环阶段。                                | 用户明确要求按 Autopilot 端到端交付，不再停留在 plan-only。                                                            | 继续仅文档交付（不采用）                                                  | 2026-03-05 |
| 本轮 review-code 结论调整为 PASS（blocking=0）。                                                                        | 已在 live-trading-core.test.ts 增补 received_at 漂移超窗（过旧/过新）与 non_monotonic 拒绝用例，覆盖此前两个阻塞缺口。 | 维持 FAIL 并继续要求补测；但当前缺口已被实质覆盖，不再满足阻塞条件。      | 2026-03-05 |
| 全局 signal_id 幂等继续对齐 RFC 已冻结约束；安全评审中的跨租户冲突风险记录为残余风险，不在本轮改为复合键。              | RFC 明确 signal_id 为全局唯一幂等键，并已有对应测试与代码复核结论。                                                    | 改为 investor/product/source 复合键；被 RFC 与 code-review 当前约束否决。 | 2026-03-05 |
| 根据新增会议讨论，任务切回 RFC-only 收敛流程：rfcProfile=heavy、stage=design-only，本轮仅更新设计文档与 Draft PR 文案。 | 用户要求先收敛 Epic/High-risk 设计并减少人工打断，Merge 作为设计批准门禁。                                             | 继续推进实现与安全阻塞修复；本轮不采用。                                  | 2026-03-07 |

---

## 快速交接

**下次继续从这里开始：**

1. 将 `.legion/tasks/heavy-rfc/docs/pr-body.md` 作为 PR 描述发起 Review/合并。
2. 如本地需要自动化提交/开 PR，可运行 `/legion-pr`。

**注意事项：**

- 当前 active task 已达到实现阶段验收标准。
- 产物均已落盘于 `.legion/tasks/heavy-rfc/docs/`。

---

_最后更新: 2026-03-07 22:46 by Claude_
最终 focused review 结论 PASS，当前无 blocking 与无剩余 non-blocking。

- 本阶段仍为 design-only，未触碰 `libraries/live-trading` 生产代码。

---

_最后更新: 2026-03-05 23:08 by Claude_

_最后更新: 2026-03-07 22:19 by Claude_
最终 focused review 结论 PASS，当前无 blocking 与无剩余 non-blocking。

- 本阶段仍为 design-only，未触碰 `libraries/live-trading` 生产代码。

---

_最后更新: 2026-03-05 23:08 by Claude_
