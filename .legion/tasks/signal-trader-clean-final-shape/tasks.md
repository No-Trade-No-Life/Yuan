# signal-trader-clean-final-shape - 任务清单

## 快速恢复

**当前阶段**: 阶段 1 - 调研与设计
**当前任务**: 盘点废弃前端、兼容 wrapper 与所有引用，明确最终保留/删除清单。
**进度**: 2/6 任务完成

---

## 阶段 1: 调研与设计 🟡 IN PROGRESS

- [ ] 盘点废弃前端、兼容 wrapper 与所有引用，明确最终保留/删除清单。 | 验收: plan.md 明确清理边界、最终保留入口与风险说明；RFC 收敛删除策略。 ← CURRENT
- [ ] 完成 task-local RFC 并做设计审查，确认不再保留兼容层。 | 验收: `docs/rfc.md` 与 `docs/review-rfc.md` 达到可执行状态。

---

## 阶段 2: 实现 🟡 IN PROGRESS

- [x] 删除 ui/web 废弃 signal-trader 前端与所有多余兼容文件，重命名剩余正式入口。 | 验收: 仓库中只剩一套当前正式 signal-trader 前端/脚本入口，不再存在废弃页面和兼容 wrapper。
- [x] 修正文档、脚本、测试与引用到最终形态。 | 验收: 构建/测试路径与文档都指向最终入口，没有悬空引用。

---

## 阶段 3: 验证与交付 🟡 IN PROGRESS

- [ ] 运行相关 build/test，并生成测试报告。 | 验收: `docs/test-report.md` 记录 cleanup 后的验证结果。
- [ ] 完成代码评审/安全评审/交付报告与 PR body。 | 验收: 生成 `review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-24 18:20_
