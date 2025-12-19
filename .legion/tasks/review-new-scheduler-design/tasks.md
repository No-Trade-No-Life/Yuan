# review-new-scheduler-design - 任务清单

## 快速恢复

**当前阶段**: (unknown)
**当前任务**: (none)
**进度**: 7/7 任务完成

---

## 阶段 1: 架构审视 ✅ DONE

- [x] 分析 Cell 模型和 Dirty Check 流程设计 | 验收: 完成流程图和核心模型描述
- [x] 复杂度分析（20,000 products × 7 fields 场景） | 验收: 完成各操作的时间/空间复杂度表格
- [x] 接口设计问题识别 | 验收: 列出 cells/services/route 等接口的设计缺陷
- [x] 流程设计问题识别 | 验收: 列出 handleServiceGroupId/handleService 的问题

---

## 阶段 2: 优化建议 ✅ DONE

- [x] 提出数据结构优化方案 | 验收: 完成 Map/Set/PriorityQueue 替代方案设计
- [x] 提出索引结构优化方案 | 验收: 完成 dirtyByGroup/servicesByPrefix 索引设计
- [x] 总结优化收益 | 验收: 完成优化前后复杂度对比表

---

## 发现的新任务

- [ ] 补齐正确性语义：request 失败不清 dirty，并引入 backoff/重试策略；仅在响应确实包含对应字段时才清 dirty | 来源: plan.md 正确性与一致性风险（补充）
- [ ] 服务注册表做快照/版本控制，避免 services 在调度循环中被替换导致的竞态；或改为“单写者”调度线程串行处理所有状态变更 | 来源: plan.md 正确性与一致性风险（补充）
- [ ] 标准化 service_group_id 计算：对 fields 排序/去重后再 join，避免同语义服务被拆成多个 group | 来源: plan.md 正确性与一致性风险（补充）
- [ ] 调度与执行层对齐：优先复用 apps/virtual-exchange/src/quote/upstream/executor.ts 的 per-group 串行、全局并发限制、in-flight 去重；scheduler 只负责 dirty 合并与 micro-batch | 来源: plan.md 落地路线
- [ ] 增加回归验证：单测覆盖 route 未命中、request 失败重试语义、services 版本切换一致性；补充基准测试（20k products）并在 CI 中以阈值/趋势方式约束 | 来源: plan.md 落地路线
- [ ] （如需落地）确认编排层/入口切换到 refine.ts，并跑 apps/virtual-exchange/src/quote/benchmark 的基准测试验证性能收益 | 来源: context.md 快速交接

---

_最后更新: 2025-12-19 18:56_
