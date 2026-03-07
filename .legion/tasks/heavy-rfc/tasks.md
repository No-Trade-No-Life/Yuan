# 实盘交易库 heavy RFC 设计 - 任务清单

## 快速恢复

**当前阶段**: (unknown)
**当前任务**: (none)
**进度**: 11/11 任务完成

---

## 阶段 1: 任务定义与边界收敛 ✅ COMPLETE

- [x] 读取根目录两张参考图与用户补充说明，产出 task-brief（目标/验收/假设/风险/验证）。 | 验收: task-brief.md 完成，包含 High-risk 判定理由与待确认问题列表。
- [x] 在 context 决策表登记 rfcProfile=heavy 与 stage=design-only。 | 验收: context.md 决策表可追溯并标注仅设计阶段。

---

## 阶段 2: Heavy 研究与 RFC ✅ COMPLETE

- [x] 生成 research.md，整理领域模型、约束、接口抽象、风控与测试策略。 | 验收: research.md 覆盖信号、仓位、投资者状态、资金安全和工程可测试性。
- [x] 生成 heavy rfc.md，给出架构、状态机、API、数据模型、失败语义、里程碑与回滚策略。 | 验收: rfc.md 达到可审查可执行标准，未决问题显式列在 Open Questions。

---

## 阶段 3: RFC 对抗审查 ✅ COMPLETE

- [x] 运行 review-rfc 并生成 review-rfc.md。 | 验收: review-rfc.md 给出 blocking/non-blocking 结论和修改建议。

---

## 阶段 4: RFC-only Draft PR 产物 ✅ COMPLETE

- [x] 生成 walkthrough 与 RFC-only PR body。 | 验收: report-walkthrough.md 与 pr-body.md 可直接用于 Draft PR（docs-only）。

---

## 阶段 5: Core Lib 实现 🟡 IN PROGRESS

- [x] 调用 engineer 落地 `libraries/live-trading` 单一 core lib（无副作用）实现与测试。 | 验收: 核心 API 与测试文件已产出，且不包含协议/数据库/消息副作用实现。

---

## 阶段 6: 测试与验证 🟡 IN PROGRESS

- [x] 运行 run-tests 并生成 test-report.md。 | 验收: `.legion/tasks/heavy-rfc/docs/test-report.md` 落盘，含通过/失败摘要。

---

## 阶段 7: 代码与安全评审 🟡 IN PROGRESS

- [x] 运行 review-code 并生成 review-code.md。 | 验收: `.legion/tasks/heavy-rfc/docs/review-code.md` 落盘。
- [x] 运行 review-security 并生成 review-security.md。 | 验收: `.legion/tasks/heavy-rfc/docs/review-security.md` 落盘。

---

## 阶段 8: 报告与 PR 产物 🟡 IN PROGRESS

- [x] 运行 report-walkthrough 生成 report-walkthrough.md 与 pr-body.md。 | 验收: PR 描述可直接使用。

---

## 发现的新任务

- [x] 按 Yuan 现有 library 建模与仓库规约完善 heavy RFC（接口命名、字段风格、错误处理、模块边界、测试映射） | 来源: 用户新增要求：参考现有代码风格与通用建模设计
- [x] 根据新增要求将 RFC 收敛为“仅提供单一 core lib，副作用外置 ports/effects，不绑定 Yuan 场景运行时” | 来源: 用户新增要求：目前只提供一个 lib，不要针对 yuan 的场景做任何副作用
- [ ] 创建 docs-only Draft PR（仅 .legion/tasks/heavy-rfc/docs/\*）并等待 Merge 作为设计批准；merge 后评论 continue 进入实现里程碑。 | 来源: 用户最新执行要求（Epic/High-risk 重 RFC 流程）

---

_最后更新: 2026-03-07 22:43_
要求：目前只提供一个 lib，不要针对 yuan 的场景做任何副作用

---

_最后更新: 2026-03-07 21:27_
