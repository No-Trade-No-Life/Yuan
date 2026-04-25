# signal-trader-formal-process-tests - 任务清单

## 快速恢复

**当前阶段**: 已完成
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 盘点当前 daily allocation / VC / paper/live 测试缺口，明确本轮 formal process coverage。 | 验收: plan.md 明确问题定义、scope、风险与验收标准；design/RFC 说明新增测试矩阵。
- [x] 完成 task-local RFC 并做设计审查，收敛新增测试用例与边界。 | 验收: `docs/rfc.md` 与 `docs/review-rfc.md` 达到可编码状态。

---

## 阶段 2: 实现 ✅ COMPLETE

- [x] 补充 core 与 app 正式流程测试，覆盖 VC 按天释放、paper/live 跨天、不下单日拨资、重复触发幂等等关键路径。 | 验收: 新增测试在 library/app 中稳定通过，能解释关键资本系统语义。
- [x] 如有必要，补最小测试辅助工具或 teardown 支撑。 | 验收: 测试不依赖人工清理，输出稳定。

---

## 阶段 3: 验证与交付 ✅ COMPLETE

- [x] 重跑相关 build/test，并生成测试报告。 | 验收: `docs/test-report.md` 记录新增 formal process 用例的通过结果。
- [x] 完成代码评审/安全评审/交付报告与 PR body。 | 验收: 生成 `review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-24 16:22_
