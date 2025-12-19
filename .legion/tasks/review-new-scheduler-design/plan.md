# review-new-scheduler-design

## 目标

审视 virtual-exchange/src/quote/upstream/new.ts 新调度器设计的合理性，针对 20,000 products 规模场景进行复杂度分析并提出优化建议

## 要点

- Cell-based Dirty Check 模型分析
- 复杂度评估：O(n²) markDirty、O(n log n) 调度循环
- 接口设计问题：全局可变状态、route 语义、services 同步
- 流程设计问题：触发频率、无限循环风险、冗余操作
- 数据结构优化建议：Map 替代 Array、倒排索引、优先队列

## 范围

- apps/virtual-exchange/src/quote/upstream/new.ts
- apps/virtual-exchange/src/quote/upstream/new.test.ts

## 阶段概览

1. **架构审视** - 4 个任务
2. **优化建议** - 3 个任务

---

## 设计概览

### 核心模型：Cell-based Dirty Check

```
Cell = (product_id, field, service_group_id, is_dirty, is_fetching, round)
```

### 核心流程

```
Query → markDirty() → handleServiceGroupId() → handleService() → makeRequest()
                                                     ↑______________|
                                                     (while loop)
```

### 流程详解

```
1. markDirty(product_id, field):
   - 通过 route() 找到 service_group_id
   - 在 cells 数组中查找或创建 cell
   - 设置 is_dirty = true
   - 触发 handleServiceGroupId()

2. handleServiceGroupId(serviceGroupId):
   - 遍历所有 services
   - 对匹配 group 且未运行的 service 启动 handleService()

3. handleService(service):
   - while(true) 循环：
     a. 复制并排序 cells（按 round）
     b. 筛选 dirty + not fetching + 匹配 group/field 的 cells
     c. 按 max_products_per_request 限制收集 product_ids
     d. 设置 is_fetching = true
     e. 调用 makeRequest()
     f. 设置 is_fetching = false, is_dirty = false
     g. 若无更多 dirty cells 则退出
```

---

## 复杂度分析（20,000 products × 7 fields = 140,000 cells）

| 操作                 | 当前实现                     | 复杂度         | 每秒调用量估算                     |
| -------------------- | ---------------------------- | -------------- | ---------------------------------- |
| `markDirty` 查找     | `cells.find()`               | **O(n)**       | 140,000 × 70,000 = **9.8B 次比较** |
| `route` 路由         | 遍历 services + `startsWith` | O(m)           | 140,000 × m                        |
| `handleService` 排序 | `[...cells].sort()`          | **O(n log n)** | 每批次 2.4M 次比较                 |
| `handleService` 过滤 | 遍历全部 cells               | O(n)           | 每批次 140,000                     |

**结论**：当前设计在 20,000 products 规模下，单次 markDirty 是 O(n)，全量 markDirty 是 **O(n²)**，不可接受。

---

## 接口设计问题

### 1. `cells` 数组暴露为 `export`

```typescript
export const cells: Array<ICellState> = []; // line 51
```

**问题**：

- 全局可变状态，无封装
- 任何模块都可以直接修改，破坏状态一致性
- 无法做单元测试 mock

### 2. `services` 数组无同步机制

```typescript
const services: Array<IQuoteService> = []; // line 29

// 订阅中直接清空重建
services.length = 0;
x.forEach((xx) => services.push(xx)); // line 190-193
```

**问题**：

- 在 `handleService` 的 `while(true)` 循环中，`services` 可能被其他异步流清空重建
- 没有版本号或快照机制，可能导致路由不一致

### 3. `route` 函数的匹配逻辑

```typescript
const route = (product_id: string, field: IQuoteField) => {
  return (
    services.find((x) => product_id.startsWith(x.meta.product_id_prefix) && x.meta.fields.includes(field))
      ?.service_group_id || ''
  );
};
```

**问题**：

- 返回空串 `''` 表示未找到，但下游 `handleServiceGroupId('')` 仍会执行
- `fields.includes(field)` 是 O(k)，应预处理为 Set

---

## 流程设计问题

### 1. `handleServiceGroupId` 的触发逻辑

每次 `markDirty` 都触发此函数（140,000 次/秒），遍历所有 services 检查 group_id。即使 `isServiceIdRunning` 阻止重复，判断本身的开销已经很大。

### 2. `handleService` 的 while(true) 循环

- 每次循环都**复制并排序**整个 cells 数组（O(n log n)）
- 没有退出条件的上限保护（可能无限循环）
- 排序只是为了公平性，但开销过大

### 3. 冗余的 dirty 状态更新

```typescript
// 第一次更新（line 129-132）
cellsToFetching.forEach((cell) => {
  cell.is_fetching = false;
  cell.is_dirty = false; // ← 已设置
});

// 第二次更新（line 136-140）—— 完全冗余
for (const cell of cells) {
  if (res[cell.product_id]?.[cell.field]) {
    cell.is_dirty = false; // ← 重复设置
  }
}
```

---

## 正确性与一致性风险（补充）

> 这部分是对 plan 中“接口/流程”问题的补强：不仅是性能，现实现还存在明显的正确性与一致性风险，建议在重构时一并收口。

### 1. 请求失败也会把 dirty 清掉（语义确认：best-effort）

```typescript
const res = await makeRequest(...).catch(() => ({} as IQuoteUpdateAction));
cellsToFetching.forEach((cell) => {
  cell.is_fetching = false;
  cell.is_dirty = false; // ❌ error 时也会清理
});
```

**说明**：

- 若系统允许 best-effort（失败不保证最终更新），则该行为是合理的，实现可以保持简单
- 若系统要求 eventual consistency（失败后仍需最终更新），则需要把失败视为“仍 dirty”并引入 backoff/重试（避免热循环）

> [REVIEW] 这个是有意而为之的，不用管它。
>
> [RESPONSE] 收到。这里按你确认是设计选择（best-effort），我已把措辞从“正确性风险”改为“语义确认”，并补充了 best-effort / eventual consistency 两种前提分支；本次不再作为必改项。
> [STATUS:resolved]

### 2. `makeRequest` 未指定 `service_id`（未来 TODO：实例级路由）

```typescript
terminal.client.requestForResponseData('GetQuotes', { ... })
```

**说明**：

- 这是“实例级路由/执行控制”的问题，本次先不展开；后续要做实例级治理时再补齐约束与接口

> [REVIEW] 这个不用管它，是为以后留的 TODO
>
> [RESPONSE] 收到。该点作为未来 TODO，本次评审先不展开；我已将标题与说明改成“未来 TODO：实例级路由”，避免把它当作当前结论。
> [STATUS:resolved]

### 3. `services` 更新无快照/版本控制（可预测性/一致性）

```typescript
services.length = 0;
x.forEach((xx) => services.push(xx));
```

**说明**：

- 这类竞态更偏“可预测性/一致性/可维护性”，通常不直接导致数据错误，但会导致行为难以复现与调试

**建议（可选）**：

- 维护 `servicesVersion`，调度循环只使用同一版本的快照
- 或采用“单写者模型”：所有状态变更（含 services 变更）统一投递到调度线程/队列里串行处理

> [REVIEW] 这个应该是不影响正确性的。
>
> [RESPONSE] 同意。该点更偏可预测性/一致性而非正确性；我已调整标题，并把对应改动标注为“可选”，避免误导为 correctness 问题。
> [STATUS:resolved]

### 4. `route` 返回 `''` 的语义不清

```typescript
return ...?.service_group_id || '';
```

**建议**：

- 明确三态：`matched` / `no-route` / `disabled`
- 对 `no-route` 打日志/指标并保留 dirty（或进入 dead-letter 队列），避免静默丢更新

### 5. `service_group_id` 计算对 `fields.join()` 的顺序敏感（前提：fields 是否已标准化）

```typescript
const service_group_id = meta.product_id_prefix + meta.fields.join() + (meta.max_products_per_request ?? '');
```

**风险**：

- 若 fields 未标准化（排序/去重），不同 service schema 的 fields 顺序不一致会被误判为不同 group，导致不必要的并发与重复请求

**建议**：

- 在构造 group_id 时对 fields 做标准化（排序/去重）

> [REVIEW] field 是排好序的，所以不会有这个问题。
>
> [RESPONSE] 收到。如果 fields 已保证排序/去重，则该风险前提不成立；我已在该条目里补充“前提：fields 是否已标准化”的说明。
> [STATUS:resolved]

---

## 优化建议

### 数据结构优化

| 优化项                 | 当前                | 优化后                                | 收益                           |
| ---------------------- | ------------------- | ------------------------------------- | ------------------------------ |
| **Cell 存储结构**      | `Array` + `find()`  | `Map<"${product_id}:${field}", Cell>` | O(n) → O(1)                    |
| **Dirty Cell 索引**    | 遍历全部 cells      | `Set<cellKey>` 维护 dirty cells       | 只遍历脏数据                   |
| **Service Group 索引** | 遍历 + filter       | `Map<service_group_id, Cell[]>` 倒排  | O(n) → O(1) 定位               |
| **公平调度**           | 每次排序            | 优先队列或 round 桶                   | O(n log n) → O(log n)          |
| **Route 优化**         | 遍历 services       | Trie 或 prefix 排序二分               | O(m) → O(log m)                |
| **Field 匹配**         | `fields.includes()` | `Set<field>.has()`                    | O(k) → O(1)                    |
| **批量 markDirty**     | 单个触发            | 批量收集后统一触发                    | 减少 handleServiceGroupId 调用 |
| **删除冗余循环**       | 两次 dirty 更新     | 删除 line 136-140                     | 减少 140,000 次遍历            |

### 落地路线（建议按风险从低到高推进）

1. **先修正确性语义**：失败不清 dirty + backoff；`route` 未命中可观测（日志/指标）
2. **消除 O(n²) 的根因**：`cells` 用 `Map` 做 O(1) upsert/读取；dirty 只在索引里流转
3. **从“全量扫描”改为“事件驱动”**：`markDirty` 只入队（micro-batch），调度 loop 只处理 dirty 集合
4. **并发模型收口**：按 `service_group_id` 单通道执行（每 group 一个 runner），全局再加并发上限
5. **执行层约束（抽象）**：提供
   - 全局并发限制
   - per-group 串行（避免同组乱序/重入）
   - in-flight 去重（同 key 合并）

> [REVIEW] 绝对不要参考现有的实现，因为现有的实现是有问题的。
>
> [RESPONSE] 收到。我已从 plan 中移除对具体 upstream 文件/实现的引用，只保留抽象约束与两套公平调度方案；后续补充也会以抽象接口与复杂度推导为依据。
> [STATUS:resolved]

### 建议的“单写者 + per-group 队列”结构（偏工程可落地）

```typescript
type CellKey = string; // encodePath([product_id, field])

interface ISchedulerState {
  cells: Map<CellKey, ICellState>;
  dirtyByGroup: Map<string, Set<CellKey>>;
  groupRunnerScheduled: Set<string>;
  servicesSnapshot: IQuoteService[]; // 带 version
}
```

### 建议的数据结构重构

```typescript
interface ISchedulerState {
  // O(1) 查找
  cells: Map<string, ICellState>; // key = `${product_id}:${field}`

  // 按 service_group_id 索引的 dirty cells
  dirtyByGroup: Map<string, Set<string>>; // group_id -> Set<cellKey>

  // 服务路由索引
  servicesByPrefix: PrefixMatcher<IQuoteService[]>; // Trie 或排序数组
  servicesByField: Map<IQuoteField, IQuoteService[]>;

  // 公平调度
  roundQueue: PriorityQueue<ICellState>; // 按 round 排序的堆
}
```

---

## 公平调度设计草案（去掉 O(n log n) 全量排序）

> 目标：不再对全量 cells 进行 `sort`，而是只对“活跃的脏集合”做增量维护；并提供公平性（避免某些 product/field 饿死）。

### 方案 A：Round-Robin（按 product 轮转，推荐优先落地）

**核心想法**：调度单位从 “cell” 变为 “product”。同一个 product 的多个 field 可以在一次请求中一起被覆盖（取决于服务是否支持多 fields）。

**数据结构（按 service_group_id 维度维护）**：

```typescript
type ProductId = string;

type GroupState = {
  productQueue: ProductId[]; // FIFO
  inQueue: Set<ProductId>; // 去重：避免同 product 重复入队
  dirtyFieldsByProduct: Map<ProductId, Set<IQuoteField>>; // product -> dirty fields
  fetchingProducts: Set<ProductId>; // 防止重入
};
```

**markDirty（O(1)）**：

```typescript
dirtyFieldsByProduct.get(product_id)?.add(field) ?? dirtyFieldsByProduct.set(product_id, new Set([field]));
if (!inQueue.has(product_id) && !fetchingProducts.has(product_id)) {
  inQueue.add(product_id);
  productQueue.push(product_id);
  scheduleGroupRunner(group_id);
}
```

**group runner（只处理 active queue，不扫描全量）**：

- 每轮取 `max_products_per_request` 个 product（FIFO）
- 对每个 product 组装本次要请求的字段集合（通常是 service 支持字段与 dirtyFields 的交集）
- 请求成功后，仅清本次确实返回/覆盖到的字段；若仍有残留 dirtyFields，则把 product 重新入队（放队尾）
- 请求失败时：不清 dirtyFields，把 product 延迟重入队（可以用“延迟队列/时间轮/最小堆”做 backoff，见方案 B）

**公平性**：

- FIFO + 重入队尾天然 round-robin
- 一个 product 若持续更新，会被去重合并，不会挤爆队列

**复杂度**：

- `markDirty`: O(1)
- 调度：每轮 O(k)（k=本轮处理的 product 数），不依赖全量 cell 数

### 方案 B：PriorityQueue（按 nextEligibleAt + seq 公平）

**核心想法**：把“下一次可被处理的 product”放入最小堆，天然支持 backoff 与更强的公平控制。

**节点**：

```typescript
type QueueNode = {
  product_id: string;
  nextEligibleAt: number; // backoff 控制
  seq: number; // 单调递增，用于公平（越小越先）
};
```

**调度**：

- pop 出 `nextEligibleAt <= now` 的节点，最多取 `max_products_per_request`
- 成功：若该 product 仍有 dirtyFields，push 新节点（seq++，nextEligibleAt=now）
- 失败：push 新节点（seq++，nextEligibleAt=now+backoffMs）

**复杂度**：

- `markDirty`: O(log d)（d=活跃 product 数）
- 调度：每 pop/push O(log d)

### 两案取舍

| 维度       | 方案 A：RR 队列                 | 方案 B：PQ              |
| ---------- | ------------------------------- | ----------------------- |
| 实现复杂度 | 低                              | 中                      |
| 公平性     | 足够（轮转）                    | 更强（可控）            |
| backoff    | 需要额外结构（时间轮/延迟队列） | 原生支持                |
| 适用场景   | 优先落地、先把 O(n log n) 删掉  | 需要严格限速/重试治理时 |

---

## 总结

| 维度         | 评估        | 说明                                         |
| ------------ | ----------- | -------------------------------------------- |
| **接口设计** | ⚠️ 需改进   | 全局可变状态、无封装、route 返回空串语义不清 |
| **流程设计** | ⚠️ 需改进   | 触发过于频繁、无限循环风险、冗余操作         |
| **复杂度**   | ❌ 不可接受 | O(n²) 的 markDirty，O(n log n) 的调度循环    |
| **可测试性** | ❌ 差       | 依赖全局状态、副作用混杂                     |

**核心问题**：当前设计是为小规模（几十到几百个 product）设计的，直接应用到 20,000 products 场景会有严重性能问题。需要从数据结构层面重新设计，将 O(n) 查找优化为 O(1)，将 O(n log n) 排序优化为增量维护。

> [REVIEW] 现在首先设计一下如何把 O(n log n) 的这个排序变成比如优先队列，或者说用 round-robin 的方式来做公平调度。你先给一版设计到 plan.md 里，我再 review 一下。你在调研的时候绝对不要参考现有的实现（upstream 里的其他文件），因为现有的实现是有问题的。别改别的。
>
> [RESPONSE] 已按要求在 plan.md 补充“公平调度设计草案”（Round-Robin 与 PriorityQueue 两案），包含数据结构、关键流程、复杂度与取舍；且不再引用 upstream 现有实现作为依据。请你继续 review 该段。
> [STATUS:resolved]

---

_创建于: 2025-12-19 | 最后更新: 2025-12-19 16:32 by Codex_
