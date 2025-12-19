# review-new-scheduler-design - 上下文

## 会话进展 (2025-12-19)

### ✅ 已完成

- 完成 Cell 模型和 Dirty Check 流程分析
- 完成复杂度分析（20,000 products × 7 fields 场景）
- 识别接口设计问题（cells/services/route）
- 识别流程设计问题（handleServiceGroupId/handleService）
- 提出数据结构优化方案（Map/Set/PriorityQueue）
- 提出索引结构优化方案（dirtyByGroup/servicesByPrefix）
- 总结优化收益（复杂度对比表）
- 补充正确性与一致性风险清单，并给出“单写者 + per-group 队列 + micro-batch”落地路线（对齐 executor.ts）
- 已闭环 plan.md 内联 review（新增公平调度设计草案、修正风险项措辞与范围，并移除对 upstream 现有实现的引用）
- 实现 apps/virtual-exchange/src/quote/upstream/refine.ts：以 per-group FIFO（RR）替代全量 sort/扫描，并按要求移除侵入式 profiler

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `apps/virtual-exchange/src/quote/upstream/new.ts`：被 review 的新调度器原型实现（cells/route/handleService...）；存在性能瓶颈与正确性/一致性风险
- `apps/virtual-exchange/src/quote/upstream/executor.ts`：现有 GetQuotes 执行层（全局并发限制 + per-group 串行 + in-flight 去重）；建议优先复用其模式
- `apps/virtual-exchange/src/quote/service.ts`：服务侧 SWR 更新队列实现（入队 + 串行消费 + 可观测统计）；可借鉴其“micro-batch 入队”思路

---

## 关键决策

| 决策                                                                                                                                                     | 原因                                                                                                                                              | 替代方案                                                                                                                                                                                       | 日期       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 当前设计不适用于 20,000 products 规模，需要重构数据结构                                                                                                  | O(n²) 的 markDirty 和 O(n log n) 的调度循环在大规模场景下性能不可接受                                                                             | 1. 保持现有设计，限制 product 数量；2. 局部优化（只改 Map）；3. 全面重构（Map + 倒排索引 + 优先队列）                                                                                          | 2025-12-19 |
| 调度层采用“单写者 + per-group 串行 runner + micro-batch 入队”模型，并尽量复用 executor.ts 的并发限制与 in-flight 去重；markDirty 不直接触发全量遍历/排序 | 同时解决性能（避免 O(n²)/O(n log n) 全量操作）与一致性（services 快照/版本、避免竞态），并减少重复实现执行层并发控制                              | 继续沿用当前数组+while(true) 结构，仅做局部优化（Map 替代 find、删冗余循环）,完全重写为全局优先队列（PriorityQueue）驱动的公平调度,将所有调度逻辑迁移到上游路由层，按 planner 结果直接下发请求 | 2025-12-19 |
| 不在 refine.ts 内置侵入式 profiler（计数器/分段耗时/event loop delay），性能定位改用外部 benchmark/采样工具                                              | 避免长期维护成本与运行期开销/噪音；性能问题定位应依赖可复用的 benchmark（例如 quote/benchmark 目录）与 Node/系统级 profiler，而不是在线上持续埋点 | 保留轻量计数器并默认关闭（env 开关）,只保留 trace 日志用于人工排查                                                                                                                             | 2025-12-19 |

---

## 快速交接

**下次继续从这里开始：**

1. （如需落地）确认调度器入口处切换到 refine.ts，并用 apps/virtual-exchange/src/quote/benchmark 下的基准测试验证吞吐/延迟
2. （如需增强）补齐 route 未命中/失败语义的明确契约（best-effort vs eventual），再决定是否需要 backoff/重试

**注意事项：**

- 本任务已完成 review + 方案落地草案 + refine.ts 实现；侵入式 profiler 已按要求移除
- refine.ts 仍保留可选 trace：VEX_QUOTE_UPSTREAM_REFINE_TRACE=1（如不需要也可进一步删除）

---

_最后更新: 2025-12-19 18:56 by Claude_
