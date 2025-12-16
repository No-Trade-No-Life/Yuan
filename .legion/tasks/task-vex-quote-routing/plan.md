# task-vex-quote-routing

## 目标

Design quote routing in virtual-exchange quote service (compute per-upstream requests from cacheMissed + terminal metadata) and implement TODO accordingly.

## 现状（TODO 定位）

`apps/virtual-exchange/src/quote/service.ts` 的 `VEX/QueryQuotes` 目前流程是：

1. 对请求的 `(product_id, field)` 做本地缓存命中分析，得到 `cacheMissed`
2. TODO：根据 `cacheMissed` 规划上游查询请求，拉取后回写 `quoteState`
3. 最后返回 `quoteState.filter(product_ids, fields, updated_at)`

TODO 旁边的约束：

- 需要“集中规划”请求（批量、去重、拆分）
- 需要限制在途请求数量
- 需要复用在途请求结果（in-flight dedup），避免重复打爆上游

## 要点

- Read existing upstream quote service implementation and metadata mapping patterns
- Determine how to locate quote service metadata from terminal service info (per @yuants/exchange quote.ts)
- Design routing algorithm: (cacheMissed, upstream metadata) -> requests per service
- Plan Promise.all execution and result aggregation
- Implement TODO after plan review

## 上游 Quote Service（GetQuotes）契约与元数据来源

本次 TODO 的“上游服务”不是 `VEX/UpdateQuotes`，而是 vendor 侧提供的统一 RPC：`GetQuotes`（由 `@yuants/exchange` 的 `provideQuoteService` 暴露）。

### 1) GetQuotes 请求/响应

- 方法名：`GetQuotes`
- 请求：`IQuoteServiceRequestByVEX`
  - `product_ids: string[]`
  - `fields: IQuoteField[]`（注意：schema 约束为 `const`，必须与 provider 声明完全一致）
- 响应：`IQuoteUpdateAction`（`product_id -> field -> [value, updated_at(ms)]`）

### 2) 如何从 Terminal 的 service info 找到 quote provider metadata

`@yuants/protocol` 会把每个 terminal 提供的服务列表广播到 Host，并同步回所有 terminal（见 `ITerminalInfo.serviceInfo`）。

- `ITerminalInfo.serviceInfo?: Record<string, IServiceInfo>`
- `IServiceInfo` 里包含：
  - `method`（这里是 `GetQuotes`）
  - `service_id`（同一个 terminal 可以注册多个同名 method 的实例）
  - `schema`（JSON Schema，包含路由/能力信息）

quote provider 的能力信息（metadata）编码在 schema 中，并由 `@yuants/exchange` 提供解析函数：

- `parseQuoteServiceMetadataFromSchema(schema)` -> `{ product_id_prefix, fields, max_products_per_request? }`

因此：从 `terminal.terminalInfos` 遍历所有 terminal 的所有 `serviceInfo`，筛选 `method === 'GetQuotes'`，对每个 `schema` 调用 `parseQuoteServiceMetadataFromSchema`，即可构建 provider registry。

## 设计：按 `exchange.md` 的 L1 报价路由算法实现

参考：`docs/zh-Hans/code-guidelines/exchange.md` 的「## L1 报价数据」中“匹配算法（提案）”。

核心结论：

- 这不是“最小覆盖 / set cover”问题：上游通常不会提供大量重叠接口，也不会存在复杂的吸收关系。
- 应按 `O(ProductIds + Fields)` 的思路做候选集过滤：`S_product_id ∩ S_field`，得到“可能用得上的接口集合”，然后并发调用并合并缓存。

### A. ProviderRegistry（运行时快照）

建议在 `apps/virtual-exchange/src/quote/service.ts` 模块级维护一个“可快速查询”的 registry（订阅 `terminal.terminalInfos$` 或在每次 Query 时按需重建）。

每个 provider 记录这些信息（都是实现 TODO 所需的最小集合）：

- `terminal_id`
- `service_id`
- `metadata.product_id_prefix`
- `metadata.fields`（provider 固定字段集合）
- `metadata.max_products_per_request?`（用于拆分批次）

### B. 建立两类索引（与文档一致）

1. `product_id_prefix -> provider 集合`（Trie / 前缀匹配器）

> 文档中建议 Trie；实现上可抽象 `IPrefixMatcher`，让 “AC 自动机 / Trie / prefix 排序线性扫描” 可互换。

2. `field -> provider 集合`（字段索引）

- 对每个 provider 的 `metadata.fields` 建立倒排索引：`Map<IQuoteKey, Set<providerId>>`

### C. 路由算法（不做 set cover）

输入：`product_ids`, `fields`, `updated_at`, `quoteState`。

步骤（与文档的 1~3 对齐）：

1. 计算 cacheMissed（已存在）
2. 对每个 `product_id` 计算候选接口集合 `S_product_id`：由 prefix matcher 返回 provider 集合
3. 对每个 `field` 计算候选接口集合 `S_field`：由字段索引返回 provider 集合
4. 对每个 miss tuple `(product_id, field)`：
   - 取交集 `S_final = S_product_id ∩ S_field`
   - 若 `S_final` 为空：
     - 视为该字段对该 product 不可用：写入 `["", req.updated_at]`（空字符串表示不可用，同时满足 freshness 约束）
   - 若 `S_final` 非空：
     - 把这些 provider 视为“都可能有用”，加入 planned provider 集合
     - （若出现多个 provider 同时匹配同一 tuple：按 prefix 更长优先；仍然保留其它候选用于降级或未来策略）

补充规则（与本任务既定要求对齐）：

- 若某 `product_id` 对应的 `S_product_id` 为空（没有任何 prefix 命中），视为 unknown product，直接抛异常（不填空字符串）。

输出：`plannedProviders`（去重后的 provider 列表），以及 `provider -> product_ids` 的聚合映射。

### D. 生成请求（batch + 负载均衡 + in-flight）

1. 聚合：把所有 miss tuple 归并到 `providerId -> Set<product_id>`（去重）。

2. batch：按 `max_products_per_request` 切分。

3. 负载均衡：对于同一 `providerId` 的多个实例，做 round-robin（后续可扩展 cost/quota）。

4. in-flight 复用：对每个 batch 生成稳定 key（`providerId + hash(product_ids)`），复用在途 Promise。

## 设计：Promise.all 并发、in-flight 复用、失败语义

### A. in-flight 复用（请求去重）

目标：同一个 provider + 同一个 product batch 的请求在途时复用同一 Promise，避免多个并发 QueryQuotes 触发重复上游调用。

实现方式：使用 in-memory `Map<key, Promise>` 做纯 in-flight 去重（请求完成后立即清理），避免跨调用缓存污染与内存堆积：

- cache key 必须稳定且可重复生成
- key 建议包含：
  - `terminal_id + service_id`（provider 唯一标识）
  - `provider.fields`（通常固定，可省略；但为了安全建议纳入 key）
  - `sorted(product_ids)`（batch 内产品集合）

### B. 并发上限（避免过载）

需要同时限制：

- 全局并发：避免一次 QueryQuotes 触发过多上游请求（例如 32）
- 按 provider 并发：同一个 provider（能力签名）并发限制为 1，避免单 provider 被并发打爆

实现上倾向一个简单的 limiter（队列 + active 计数）：

- `limit(() => requestGetQuotesInFlight(...))`

### C. Promise.all / 聚合写回

执行策略：

- 用 `Promise.all(plannedRequests.map(fetch))` 等待所有 planned request 完成
- 任一上游请求失败：直接抛异常退出（不重试、不 best-effort），符合 strict freshness 要求
- 全部成功后：对每个 action 执行 `quoteState.update(action)`
- 最终再执行 `quoteState.filter(product_ids, fields, updated_at)` 返回

### D. 超时与降级（建议）

本任务不做降级：timeout/失败直接抛异常退出（与 strict freshness 一致）。

## 风险与前置约束（必须在实现前确认）

### 1) 重大风险：quoteState 的“读导致写”会导致内存 DoS

当前生产实现 v1/v2 的 `getValueTuple`/`filter` 会在读取不存在的 `product_id` 时隐式创建 product（见 `apps/virtual-exchange/src/quote/implementations/v1.ts:getFieldOffset`）。

这意味着：

- 任何人只要调用 `VEX/QueryQuotes` 传入海量随机 `product_ids`，就能导致内存无限增长
- 即使不实现 TODO，仅当前 `cacheMissed` 分析与 `filter` 也存在风险

实现 TODO 前需要明确处理策略（择一或组合）：

1. 修复 quoteState：读路径不创建 product；只有 `update` 才引入新 product（推荐）
2. 服务层强保护：限制 `product_ids` 数量、`fields` 数量、以及 total pairs；对异常直接 reject

本任务建议在实现 TODO 时一并落地最小修复/保护，否则上游拉取会进一步放大风险。

## 待确认点（供你 review）

1. Provider prefix 重叠时的优先级：是否统一按“最长 prefix”决策？

- 你建议：可以用 AC 自动机完成匹配。
- 约束：为了让调用层无感知，可抽象一个 `IPrefixMatcher` 接口；AC 或“按 prefix 排序线性扫描”都实现该接口。

2. in-flight key 组成：是否需要把 `updated_at`（QueryQuotes 阈值）纳入 key？（当前 GetQuotes 请求体不含 updated_at，理论上不必）

- 你确认：不用纳入。

3. 失败语义：上游失败是否允许返回 `code: 0` 但 data 不完整？（倾向是）

- 你确认：允许（但下方第 4 点你又要求“必须满足 updated_at，否则抛异常”，因此这里需要以“最终 freshness 校验”为准：只要仍有字段不满足就必须 fail）。

4. 并发参数与负载均衡：

- 你确认：需要负载均衡（同能力 provider 多实例）。
- 你确认：不同 provider 可以并发；同一个 provider 建议并发限制为 1（这里的 provider 建议定义为“同一组 schema 能力签名”，便于与负载均衡一致）。

5. 字段数组顺序：

- 你确认：fields 使用字典序；可以直接 `sort()`（如需要可抽一个工具函数统一处理）。

6. in-flight key 长度：

- 你确认：可以对 product_ids 做 hash；建议照搬 `apps/alert-receiver/src/alertmanager-compatible-utils/fingerprint.ts` 的 `fnv1a64Hex` 方案。

7. freshness 与失败策略（关键约束）：

- 你确认：`VEX/QueryQuotes.updated_at` 是硬性鲜度要求；如果本地 state 不满足则必须等待上游返回来补齐；
- 你确认：若补齐后仍不满足（缺失/时间戳仍旧 < updated_at），则直接抛异常退出，不做重试。

8. 类型兼容：

- 你确认：VEX 本地 `IQuoteUpdateAction` 与 exchange 的结构可直接兼容，必要时可直接 `as` 断言赋值。

## 仍需你拍板的问题（否则实现会卡住/行为不确定）

1. 未知 product 的处理：当请求里包含“从未出现过 update、且上游也返回不了”的 product_id 时，是否应当直接抛异常（按 freshness 逻辑），还是要区分“unknown product”并报更明确的错误码？
   直接抛异常
2. quoteState 的 DoS 风险落地方式：你倾向
   - A) 修复 quoteState（读不创建 product，推荐但要改 implementations/v1.ts 等），还是
   - B) 仅在 `VEX/QueryQuotes` 做输入上限/未知 product 拦截作为兜底（风险更高）？
     不要管这个风险，直接开干

## 本次变更请求（来自 review）

- 你指出：当前实现的 set cover/贪心覆盖过于复杂，应按 `exchange.md` 的 L1 报价路由算法（Trie + field index + 交集）重写路由。
- 本计划已按该算法更新；等你 review 后再进入代码重构。

## 范围

- apps/virtual-exchange/src/quote/service.ts
- apps/virtual-exchange/src/quote/state.ts
- libraries/exchange/src/quote.ts

## 阶段概览

1. **Discovery** - 3 个任务
2. **Design** - 2 个任务
3. **Implementation (after review)** - 2 个任务

---

_创建于: 2025-12-15 | 最后更新: 2025-12-15_
