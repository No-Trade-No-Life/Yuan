# signal-trader-mock-exchange-account-ui - 任务清单

## 快速恢复

**当前阶段**: 已完成
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 盘点 mock exchange、账户信息接口、主前端与独立前端当前的数据流和展示缺口 | 验收: plan.md 明确问题定义、验收、风险分级、允许 Scope 与设计入口；列出涉及文件/模块。
- [x] 形成 mock 成交记账与前端同步方案，并根据风险决定是否需要 task-local RFC | 验收: Low 则在 plan.md 写 design-lite；Medium/High 则生成 docs/rfc.md 并通过 review-rfc 收敛。

---

## 阶段 2: 实现 ✅ COMPLETE

- [x] 实现 mock exchange 的仓位/账户管理与任意成交后的账户变更逻辑 | 验收: mock order 成交后可更新 position/account，账户净值变化符合设计用例与 IAccountInfo 语义。
- [x] 同步主前端与独立前端展示账户状况 | 验收: 两个前端都能读取并展示 mock 账户状态，信息与后端/服务返回一致。

---

## 阶段 3: 验证与交付 ✅ COMPLETE

- [x] 运行相关测试/构建并生成测试报告 | 验收: docs/test-report.md 记录实现后的验证结果。
- [x] 完成代码评审、安全评审（如需要）与交付报告/PR body | 验收: 生成 review-code.md、必要时 review-security.md、report-walkthrough.md、pr-body.md。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-24 22:05_
