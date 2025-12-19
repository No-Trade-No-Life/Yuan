# task-vex-queryquotes-swr

## 目标

将 `apps/virtual-exchange/src/quote/service.ts` 的 `VEX/QueryQuotes` 改为 SWR：请求立即返回本地缓存结果，同步触发 `scheduler.markDirty` 做后台补全。

## 当前实现（2025-12-19）

> 说明：本任务最初设计过“RxJS 串行队列 + 队列状态服务”的版本；但在后续代码整理中，相关逻辑已收敛到 `apps/virtual-exchange/src/quote/scheduler.ts`，因此最终实现不再保留队列与状态服务。下文旧设计保留作为历史记录，避免丢失推导。

### `VEX/QueryQuotes` 的最终行为

- 同步阶段：计算 cache missed（`miss + stale`），对每个 `{ product_id, field }` 调用 `markDirty(product_id, field)`
- 返回：直接 `return quoteState.filterValues(product_ids, fields)`（缺失字段返回空字符串）
- 不再提供：`VEX/QuoteUpdateQueueStatus`（因为已无 service.ts 内的队列）

## 背景与现状

当前 `VEX/QueryQuotes`（见 `apps/virtual-exchange/src/quote/service.ts`）是“同步补全”模式：

- 同步计算 `cacheMissed`
- 若 miss 非空：`await quoteProviderRegistry.fillQuoteStateFromUpstream(...)` 拉取上游并回写 `quoteState`
- 返回 `quoteState.filter(...)` 后，会执行 `assertFreshnessSatisfied(...)`（缺字段直接抛 `VEX_QUOTE_FRESHNESS_NOT_SATISFIED`）

上游补全能力已在前置任务完成分层（见 `apps/virtual-exchange/src/quote/upstream/registry.ts`）：

- `fillQuoteStateFromUpstream` 负责：路由规划（prefix + field 倒排 + 交集）→ 分批 → 执行（LB / 并发治理 / in-flight 去重）→ 回写 `quoteState`

问题是：在高频轮询下，`QueryQuotes` 的同步 `await` 会显著抬高延迟，并可能在缓存尚未满足 freshness 时反复触发上游请求，增加瞬时压力。

## 变更目标（SWR 语义）

把 `VEX/QueryQuotes` 改为 stale-while-revalidate（best-effort）：

- **同步路径永远立即返回**：不再等待上游补全
- **后台补全由 scheduler 驱动**：同步路径发现 `stale/miss` 就调用 `scheduler.markDirty`，由 scheduler 负责后续请求调度与回写

### 非目标（本次不做）

- 不做调用侧协议改动（仍是 `{ product_ids, fields, updated_at }`）
- 不引入 service.ts 内部的专用队列/合并/限流（调度由 scheduler 统一处理）
- 不改动 `VEX/UpdateQuotes` / `VEX/DumpQuoteState` 的行为

## 关键接口与数据结构

### 1) QueryQuotes 请求参数

保持现有参数形状（不改协议）：

- `product_ids: string[]`
- `fields: IQuoteKey[]`
- `updated_at: number`

> 设计语义：`updated_at` 代表“鲜度下界（min_updated_at）”，不是“现在时间”。调用方用它表达可接受的最大陈旧。

### 2) UpdateTask（入队任务参数）

`UpdateTask` 必须只包含你要求的三元组：

- `product_ids + fields + updated_at`

类型草图：

```ts
type UpdateTask = { product_ids: string[]; fields: IQuoteKey[]; updated_at: number };
```

建议在入队前做规范化（降低“同集合不同顺序”的重复任务概率）：

- `product_ids = uniq(sort(product_ids))`
- `fields = uniq(sort(fields))`

## 新算法（详细流程）

- 同步路径：总是遍历请求的 `(product_id, field)`，区分三类状态：
  - `fresh`：存在且 `tuple.updated_at >= req.updated_at`
  - `stale`：存在但 `tuple.updated_at < req.updated_at`（应返回该 stale 值，同时触发后台更新）
  - `miss`：不存在（同步直接报错返回，同时触发后台更新）
- 入队条件：只要存在 `stale` 或 `miss`，立即 `Subject.next(updateTask)`（updateTask 仍只包含 `product_ids + fields + updated_at`）。
- 同步返回：使用一个“不带 updated_at 阈值”的过滤（暂定 `filterLatest`），返回当前缓存里能拿到的最新 tuple（因此 stale 会被返回）；若存在任一 tuple 缺失（= miss），则同步抛错（类似当前 `assertFreshnessSatisfied` 的结构，但语义只针对 miss）。
- 队列模型：用 RxJS `Subject<UpdateTask>` 作为更新任务队列，消费者用 `concatMap` 串行处理（任务之间严格顺序执行）。
- UpdateTask 参数：`{ product_ids: string[]; fields: IQuoteKey[]; updated_at: number }`（建议在入队前对 `product_ids/fields` 做排序+去重以减少“同集合不同顺序”的重复任务）。
- 单任务执行：处理时重新计算“需要更新的集合”（`stale + miss`）；若仍非空则调用 `quoteProviderRegistry.fillQuoteStateFromUpstream({ quoteState, cacheMissed, updated_at: task.updated_at })`；为空则 no-op。
- 鲁棒性：队列内任何一次 `fillQuoteStateFromUpstream` 抛错都不能导致队列停止（在 inner observable `catchError` 吞掉并记录日志），并避免输出过大的 `product_ids/actions` JSON。
- `updated_at` 讨论：在 SWR 语义下它更像 `min_updated_at`（鲜度下界/容忍度），用于区分 `fresh/stale` 并决定是否需要后台更新；若下游只是“尽量新”，可考虑未来把它变为可选并增加 `max_staleness_ms` 默认值（但这会改动契约，建议先保持必填）。
- 性能评估：同步延迟显著下降（不再 await 上游）；后台会增加一次（甚至多次）miss 计算开销，但通常远小于上游 RPC；串行队列会降低并发、可能延长收敛时间，但能显著降低上游瞬时压力，并通过“执行时重新算 miss”对重复轮询天然去重（很多任务会 no-op）。可选增强：队列长度监控/报警，或对连续任务做合并（不在本次最小实现范围内）。

> [REVIEW] quoteState.filter 需要一个不带 updated_at 的版本，以便于返回最新的缓存数据。然后如果不带 updated_at 的 filter 都无法满足要求，则直接报错返回（类似目前的 assert 逻辑）
>
> [RESPONSE] 采纳。SWR 的同步返回不应把 stale 隐藏成“缺字段”。调整设计为：
>
> - 同步阶段区分 `stale`（有值但旧）与 `miss`（完全没值）。
> - 返回值使用一个“不带 updated_at 阈值”的过滤（暂定 `filterLatest`：返回当前缓存里能拿到的最新 tuple），从而 stale 也能返回。
> - 若 `filterLatest` 仍存在任一 requested tuple 缺失（= miss），则同步直接报错返回（类似当前 assert），同时仍会把 update 任务入队以触发后台补全。实现上不一定要改 `IQuoteState`：可以在 `service.ts` 里基于 `getValueTuple` 构造 `filterLatest`。
>   [STATUS:resolved]

### 1) 同步路径（VEX/QueryQuotes）

输入：`{ product_ids, fields, updated_at }`

流程：

1. 遍历请求 `(product_id, field)`，基于 `quoteState.getValueTuple` 计算：
   - `missing`: tuple 不存在（miss）
   - `needUpdate`: tuple 不存在或过旧（miss + stale，用于后台更新）
2. 若 `needUpdate.length > 0`：立刻 `updateQueue$.next({ product_ids, fields, updated_at })`
3. 构造 `data = filterLatest(product_ids, fields)`（不带 `updated_at` 阈值，只要 tuple 存在就返回）
4. 若 `missing.length > 0`：同步直接抛错返回（并携带 `missing` 摘要）；否则返回 `data`

对外语义变化（需要明确）：

- 从“strict freshness（不满足就抛错）”变为 “stale-OK + miss-error”：stale 会返回，但 miss 仍会同步报错
- 同步抛错的语义从“freshness 不满足”收敛为“缓存完全缺失（miss）”，且仍会触发后台更新

### 2) 队列与串行执行（RxJS）

核心约束：**任务之间顺序执行**。采用 RxJS 串行化而不是手写 Promise 链，便于可观测与错误隔离。

实现要点：

- `updateQueue$ = new Subject<UpdateTask>()`
- 消费者：`updateQueue$.pipe(concatMap(task => processTask$(task)))`
- `processTask$` 用 `defer/from(Promise)` 包装，使每个任务的执行在订阅时才开始
- 每个任务内部 `catchError`：记录日志并返回 `EMPTY`，确保队列不断流

注意：这里的“串行”指 **UpdateTask 之间严格串行**；单个任务内部调用 `fillQuoteStateFromUpstream` 时，上游 executor 仍会按既定策略做并发（例如跨 provider group 并发 + 全局上限 32）。

### 3) 单任务处理（执行时重算 miss）

`processTask(task)` 的职责是：把“同步阶段发现的需要更新（stale + miss）”变成“后台阶段此刻真正需要补全的集合”。

流程：

1. `needUpdate2 = computeCacheMissed(quoteState, task.product_ids, task.fields, task.updated_at)`（语义：stale + miss）
2. 若 `needUpdate2.length === 0`：直接返回（no-op）
3. 否则：`await quoteProviderRegistry.fillQuoteStateFromUpstream({ quoteState, cacheMissed: needUpdate2, updated_at: task.updated_at })`

这个“执行时重算”带来的关键效果：

- 对高频轮询的天然去重：很多重复任务会变成 no-op，不再反复打上游
- 对竞争更新的自适应：如果 `VEX/UpdateQuotes` 或前序任务已经补齐，则后续任务自动跳过

## `updated_at` 是否必要（结论与建议）

### 结论：短期保留必填，语义按 “min_updated_at” 理解

原因：

- 它是 VEX 判断“是否需要补全”的唯一 freshness 约束（区分 `fresh/stale`，并决定是否入队后台更新）
- 下游“尽量新”并不等价于 “updated_at = Date.now()`：如果调用方把 `updated_at` 设为当前时间，几乎会导致永远 miss（上游报价时间戳不可能稳定 ≥ now），从而持续触发后台补全

### 给调用方的建议（契约层面的使用方式）

推荐把 `updated_at` 设为一个“可接受的最大陈旧阈值”，例如：

- `Date.now() - 1000`（容忍 1s 延迟）
- 或 `Date.now() - polling_interval_ms - jitter_ms`（以轮询周期推导容忍度）

### 可选演进（不在本次实现范围）

若你希望调用方只表达“尽量新”而不关心阈值，可考虑未来演进：

- 把 `updated_at` 改名为 `min_updated_at`
- 或让 `updated_at` 变为可选，并新增 `max_staleness_ms`（VEX 内部计算 `min_updated_at = Date.now() - max_staleness_ms`）

以上都会改变协议/调用方行为，需要单独评审与联调窗口，不建议与本次 SWR 改造捆绑。

## 性能影响评估（是否会显著降低性能）

### 预期收益

- `VEX/QueryQuotes` 的同步延迟显著降低（移除 `await fillQuoteStateFromUpstream`）
- 上游压力更平滑：后台队列串行化避免“每个轮询请求都并发打上游”

### 额外开销

- 同步路径仍需 `computeCacheMissed`，复杂度 `O(|product_ids| * |fields|)`（原来也需要）
- 后台每个任务会再算一次 miss；但算 miss 通常远小于网络 RPC 成本

### 主要风险：队列积压（backlog）

在“轮询很密 + 上游慢/不稳定”时，串行队列可能积压，导致收敛时间变长并带来内存压力。

可选兜底（不影响本次最小实现，但建议至少留日志/指标点位）：

- 周期性输出队列长度/处理耗时（避免 silent backlog）
- 后续若需要：引入合并策略（例如相邻任务 union 后一次补全），但这会改变“立即 push 并逐个处理”的可观测性与时序，需要再确认

> [REVIEW] 这倒是提醒我了，你要添加一个 ProvideService 来输出队列长度指标（rxjs Subject 做得到吗？）
>
> [RESPONSE] 采纳。RxJS `Subject` 本身不维护“队列长度”，但我们可以在 `service.ts` 维护可观测的计数器来暴露指标：
>
> - `pendingCount`：入队时 `+1`，任务完成（success/error）时在 `finalize` 里 `-1`
> - `inFlight`：当前是否正在处理（串行时是 0/1）
> - 提供一个新的 `provideService`（例如 `VEX/QuoteUpdateQueueStatus`），返回 `{ pending, in_flight, last_error?, last_processed_at? }` 之类的轻量状态。
>   实现不依赖 Subject 的“长度”，而依赖我们自己对入队/出队事件的计数。
>   [STATUS:resolved]

## 日志与可观测性（建议）

为了避免日志打爆（尤其是 `product_ids/actions` 很大时），建议：

- 同步路径只记录：`missing_count`、`stale_count`、task 摘要（截断数组）
- 后台任务记录：开始/结束/耗时、补全的 miss/stale 数、错误码（若有）
- 提供服务端指标：新增 `provideService`（例如 `VEX/QuoteUpdateQueueStatus`）返回队列状态（`pending/in_flight/last_error/last_processed_at` 等），用于排查 backlog 与稳定性问题
  > [REVIEW] 同意
  >
  > [RESPONSE] 收到。该条确认已纳入当前设计与后续实现检查点。
  > [STATUS:resolved]

## 验收标准（实现后用于自检）

- `VEX/QueryQuotes` 在存在 stale 时能立即返回（不等待上游），并且返回结果包含 stale 值
- `VEX/QueryQuotes` 在存在 miss 时会同步报错，但同时会触发后台更新（下次轮询可收敛）
- 连续轮询同一组 `(product_ids, fields, updated_at)`：miss 会随着后台补全逐步收敛为“可返回”（fresh 或 stale）
- 单次上游失败不会导致后台队列停止（后续任务仍会继续执行）
- 无明显日志爆量（数组/响应体有截断或仅输出摘要）

## 范围

- apps/virtual-exchange/src/quote/service.ts
- apps/virtual-exchange/src/quote/scheduler.ts

## 阶段概览

1. **Discovery** - 1 个任务
2. **Design** - 1 个任务
3. **Implementation** - 1 个任务
4. **Validation** - 1 个任务

---

_创建于: 2025-12-17 | 最后更新: 2025-12-19 19:12 by Codex_
