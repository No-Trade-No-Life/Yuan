# signal-trader-paper-to-mock-terminology - 任务清单

## 快速恢复

**当前阶段**: 阶段 1 - 调研与设计
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研与设计 🟡 IN PROGRESS

- [x] 盘点 signal-trader 相关用户可见的 paper 用词，并划清哪些是协议/内部标识不能改。 | 验收: plan.md 明确问题定义、范围、风险与兼容边界；RFC 收敛术语替换策略。 ← CURRENT
- [x] 完成 task-local RFC 并做设计审查，明确前端/脚本/服务文案修改边界。 | 验收: `docs/rfc.md` 与 `docs/review-rfc.md` 达到可编码状态。

---

## 阶段 2: 实现 🟡 IN PROGRESS

- [x] 修改用户可见的 paper 文案为 mock，并保持 execution_mode / stack / tests 兼容。 | 验收: 前端和脚本的人类可见用词改为 mock，底层协议仍可正常工作。
- [x] 补齐相关测试或断言，确保术语替换不破坏现有流程。 | 验收: 构建/测试通过，必要的文本断言更新。

---

## 阶段 3: 验证与交付 🟡 IN PROGRESS

- [x] 执行相关 build/test，并生成测试报告。 | 验收: `docs/test-report.md` 记录验证结果。
- [x] 完成代码评审/安全评审/交付报告与 PR body。 | 验收: 生成 `review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-24 17:21_
