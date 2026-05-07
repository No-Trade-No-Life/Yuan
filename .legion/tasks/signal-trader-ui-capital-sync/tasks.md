# signal-trader-ui-capital-sync - 任务清单

## 快速恢复

**当前阶段**: 已完成
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 盘点当前独立前端与后端资本系统能力差异，明确最小 UI 同步范围。 | 验收: plan.md 明确问题定义、scope、风险与验收标准；RFC 说明前端信息架构与数据接入点。
- [x] 完成 task-local RFC 并做设计审查，收敛 capital 面板、projection 查询与展示边界。 | 验收: `docs/rfc.md` 与 `docs/review-rfc.md` 达到可编码状态。

---

## 阶段 2: 实现 ✅ COMPLETE

- [x] 更新前端类型/API/页面，展示 capital 字段、investor/signal 视图、profit target advisory 与 formal quote source 证据。 | 验收: 独立前端能清晰展示后端最新资本系统能力，不需要人工查事件流。
- [x] 补齐前端相关测试或最小验证入口。 | 验收: 至少有可复现的 build/Playwright 或前端验证步骤。

---

## 阶段 3: 验证与交付 ✅ COMPLETE

- [x] 执行前端相关 build/test，并生成测试报告。 | 验收: `docs/test-report.md` 记录前端验证结果。
- [x] 完成代码评审/安全评审/交付报告与 PR body。 | 验收: 生成 `review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-23 16:20_
