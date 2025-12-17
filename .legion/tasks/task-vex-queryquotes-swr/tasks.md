# task-vex-queryquotes-swr - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - Validation
**当前任务**: 最小验证：运行 prettier；本地用 `.c1-cellar/vex-query-quotes.ts` 轮询观察：stale 可返回且逐步变 fresh；若命中 miss 则先报错、随后收敛；并确认队列状态服务可用且日志没有爆量。

- `VEX/QueryQuotes` 当前是否被任何调用方依赖“必须满足 updated_at freshness，否则抛错”的语义（目前 `assertFreshnessSatisfied` 会在缺字段时抛 `VEX_QUOTE_FRESHNESS_NOT_SATISFIED`）。
  > [REVIEW] quoteState.filter 需要一个不带 updated_at 的版本，以便于返回最新的缓存数据。然后如果不带 updated_at 的 filter 都无法满足要求，则直接报错返回（类似目前的 assert 逻辑）
  >
  > [RESPONSE] 采纳，同 plan.md 的结论一致：同步返回要能返回 stale（用 `filterLatest`/不带 updated_at 的过滤），只在真的 miss（完全没值）时同步报错；同时仍入队触发后台补全。
  > [STATUS:resolved]
- 轮询调用（例如 `.c1-cellar/vex-query-quotes.ts`）是否接受第一次返回缺字段/空结果并重试。
- `quoteProviderRegistry.fillQuoteStateFromUpstream` 对字段不可用的 `defaultAction`（写 `""` + `updated_at`）是否仍能减少重复 miss。
  输出：把需要保留/改变的对外语义列清单（尤其是是否要保留 strict 模式）。
  **进度**: 1/2 任务完成

---

## 阶段 1: Discovery ✅ COMPLETE

- [x] 确认现状契约与调用方期望：
- `VEX/QueryQuotes` 当前是否被任何调用方依赖“必须满足 updated_at freshness，否则抛错”的语义（目前 `assertFreshnessSatisfied` 会在缺字段时抛 `VEX_QUOTE_FRESHNESS_NOT_SATISFIED`）。
- 轮询调用（例如 `.c1-cellar/vex-query-quotes.ts`）是否接受第一次返回缺字段/空结果并重试。
- `quoteProviderRegistry.fillQuoteStateFromUpstream` 对字段不可用的 `defaultAction`（写 `""` + `updated_at`）是否仍能减少重复 miss。
  输出：把需要保留/改变的对外语义列清单（尤其是是否要保留 strict 模式）。 | 验收: context.md 记录：现有语义（strict vs stale-OK+miss-error）、主要调用方行为、以及 SWR 变更的兼容性结论。

---

## 阶段 2: Design ✅ COMPLETE

- [x] 设计 SWR 算法与队列实现细节（不写代码，只定接口/流程/边界）：

## 1. 新的 `VEX/QueryQuotes` 同步路径

- 输入：`{ product_ids, fields, updated_at }`
- 步骤：
  1. 基于 `quoteState.getValueTuple` 遍历 `(product_id, field)`，计算：
     - `missing`（miss，完全没值）
     - `needUpdate`（miss + stale，用于后台更新）
  2. 若 `needUpdate.length > 0`：`updateQueue$.next({ product_ids, fields, updated_at })`
  3. 构造 `data = filterLatest(product_ids, fields)`（不带 `updated_at` 阈值，返回当前缓存里能拿到的最新 tuple）
  4. 若 `missing.length > 0`：同步抛错返回；否则 `return data`
- 语义：stale-OK + miss-error（同步不等待上游；stale 会返回但会触发后台更新；miss 会同步报错但仍会触发后台更新）。

> [REVIEW] 我们要区分 stale 和 miss，stale 的数据要返回，miss 要报错返回并触发后台更新。
>
> [RESPONSE] 采纳。将 SWR 语义改为：
>
> - `stale`（有值但 `tuple.updated_at < req.updated_at`）：同步返回该值，同时入队触发后台更新。
> - `miss`（`getValueTuple` 为 undefined）：同步直接报错返回，同时入队触发后台更新。
>   文档侧需要补充：同步返回应使用 `filterLatest`（不带 updated_at 阈值），并用一个“缺失检查”来决定是否抛错。
>   [STATUS:resolved]

## 2. UpdateTask 定义

- `type UpdateTask = { product_ids: string[]; fields: IQuoteKey[]; updated_at: number }`
- 规范化建议（减少重复任务）：
  - `product_ids = uniq(sort(product_ids))`
  - `fields = uniq(sort(fields))`
  - 不改变外部返回顺序语义（因为 filter 输出是对象，顺序不敏感）。

## 3. 队列消费（严格顺序执行）

- `const updateQueue$ = new Subject<UpdateTask>()`
- `updateQueue$.pipe(concatMap(task => defer(() => processTask(task)).pipe(catchError(...))))
.subscribe()`
- `processTask(task)`：
  1. `needUpdate2 = computeCacheMissed(quoteState, task.product_ids, task.fields, task.updated_at)`（语义：stale + miss）
  2. 若为空：return（no-op）
  3. 否则：`await quoteProviderRegistry.fillQuoteStateFromUpstream({ quoteState, cacheMissed: needUpdate2, updated_at: task.updated_at })`
- 错误处理：单任务失败只记日志（含 task 摘要、error code），不影响后续任务。

## 4. 关于 `updated_at` 是否必要

- 保留的理由：
  - 它是“鲜度下界”而不是“想要最新”的绝对时间点；调用方可用 `Date.now() - 容忍延迟` 表达可接受的最大陈旧。
  - 它让 VEX 能区分 `fresh/stale` 并决定是否需要补全（是否入队后台更新）。
- 潜在问题：调用方若传 `Date.now()` 会导致永远 miss（因为上游 quote.updated_at 不可能稳定 >= now），需要文档/示例约束。
- 可选演进（不建议本次做）：
  - 改名为 `min_updated_at`；或让 `updated_at` 可选并新增 `max_staleness_ms` 默认值，VEX 内部计算 `min_updated_at = Date.now() - max_staleness_ms`。

## 5. 性能与风险评估

- 预期收益：降低 `QueryQuotes` p99 延迟（无 await 上游），并通过串行队列降低上游峰值压力。
- 潜在成本：
  - 背景任务会重复做 miss 计算（O(product_ids \* fields)），但通常远小于 RPC 成本。
  - 串行队列可能产生 backlog（高频轮询 + 上游慢），导致“收敛时间”变长。
- 风险兜底（可选，不在最小实现强制）：
  - 队列长度监控（例如计数器+周期日志/报警）；
  - 合并策略：在消费者侧把相邻任务 union 成更大的一次补全（但会增加实现复杂度，且需再确认是否符合你的“立即 push”语义）。

输出：plan.md 固化上述流程（不引入 strict 模式）。 | 验收: plan.md 给出：同步路径/后台队列/错误语义/updated_at 取舍/性能风险与可选兜底的明确结论。

---

## 阶段 3: Implementation ✅ COMPLETE

- [x] 在 `apps/virtual-exchange/src/quote/service.ts` 落地 SWR：新增 `Subject<UpdateTask>` + 串行消费者；调整 `VEX/QueryQuotes` 不再 await 上游，只 enqueue 并立即返回 `filterLatest` 结果；若存在 miss 则同步报错。另新增一个 `provideService` 输出队列长度/在途状态（例如 `VEX/QuoteUpdateQueueStatus`）。 | 验收: 手工验证：stale 会返回且后台更新能收敛；miss 会报错但后台更新会触发；并确认不会因单次上游失败导致队列停转。

---

## 阶段 4: Validation 🟡 IN PROGRESS

- [ ] 最小验证：运行 prettier；本地用 `.c1-cellar/vex-query-quotes.ts` 轮询观察：stale 可返回且逐步变 fresh；若命中 miss 则先报错、随后收敛；并确认队列状态服务可用且日志没有爆量。 | 验收: 格式无噪音；行为符合 SWR 预期；无明显内存增长/队列停止。 ← CURRENT

---

## 发现的新任务

- [x] 确认并移除文档/实现中所有 `VEX/QueryQuotesStrict` 的残留（含 context 决策与 tasks 描述）。 | 来源: 用户反馈：不需要 strict 模式

---

_最后更新: 2025-12-17 22:54_
