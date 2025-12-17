# Virtual Exchange Quote 模块设计说明

> 范围：`apps/virtual-exchange/src/quote/*`
>
> 目标：解释 quote 缓存/查询模块的职责、数据模型、性能取舍与已知风险，作为后续演进与协作的共同依据。

## 1. 背景与目标

Virtual Exchange（VEX）需要在进程内维护一个“可被 RPC 查询的行情快照/增量缓存”，典型特征：

- **写多读多**：行情更新高频；查询也可能频繁。
- **产品数极大**：可达 100K~1M `product_id`。
- **字段多且独立更新**：同一产品的不同字段更新时间不同。
- **一致性要求是“按字段最新”**：允许乱序到达、重复推送；按 `updated_at` 进行幂等合并。

因此该模块聚焦于：

- 内存占用线性、可预测；
- 更新/查询尽量接近 O(1)；
- 支持“按 product+field 粒度”更新与按需查询；
- 提供基准测试工具用于评估实现方案。

## 2. 非目标

- 不负责主动拉取外部行情源（目前仅缓存/查询；缺失补全仍是 TODO）。
- 不保证跨字段的事务一致性（例如同一时刻的盘口快照）；只保证每个字段按时间戳的“最后写入胜出”。
- 不实现持久化/历史行情；仅内存态。

## 3. 对外接口（RPC）

入口在 `apps/virtual-exchange/src/quote/service.ts`，由进程 `apps/virtual-exchange/src/index.ts` 引入启动。

### 3.1 `VEX/UpdateQuotes`

- 输入：`IQuoteUpdateAction`（见 4.1）
- 行为：调用 `quoteState.update(action)` 写入缓存
- 输出：仅返回 `OK`

用途：上游推送行情增量到 VEX 进程内缓存。

### 3.2 `VEX/QueryQuotes`

- 输入：
  - `product_ids: string[]`
  - `fields: IQuoteKey[]`
  - `updated_at: number`（阈值）
- 行为：
  1. 遍历请求的 product+field，检查本地是否缺失或过期，生成 `cacheMissed`（当前仅分析，不补全）。
  2. 返回 `quoteState.filter(product_ids, fields, updated_at)` 的结果。

语义：返回的结果仅包含 **时间戳不早于 `updated_at`** 的字段；其余字段可能缺失（意味着缓存无数据或过旧）。

### 3.3 `VEX/DumpQuoteState`

- 输出：`quoteState.dumpAsObject()` 的全量导出。
- 用途：调试/诊断（大规模下开销很高，不建议频繁调用）。

## 4. 核心抽象与数据模型

### 4.1 `IQuoteUpdateAction`：批量、稀疏、带时间戳的更新载体

定义在 `apps/virtual-exchange/src/quote/types.ts`：

- 结构：`product_id -> field -> [value: string, updated_at: number]`
- 特点：
  - **稀疏**：只传变化字段，减少负载与写入工作量；
  - **字段级时间戳**：允许乱序到达，通过时间戳比较保证幂等合并；
  - **值是 string**：与 `@yuants/data-quote` 的字段表示保持一致（可直接透传/序列化）。

### 4.2 `IQuoteState`：可替换的存储实现

定义在 `apps/virtual-exchange/src/quote/types.ts`，核心方法：

- `update(action)`：按字段时间戳写入（最后写入胜出）
- `getValueTuple(product_id, field)`：单字段读取
- `filter(product_ids, fields, updated_at)`：按需读取并按阈值过滤
- `dumpAsObject()`：全量导出

`apps/virtual-exchange/src/quote/state.ts` 负责选择生产实现（当前固定为 `v1`）。

## 5. 存储实现方案（v0~v3）

实现位于 `apps/virtual-exchange/src/quote/implementations/*`，并配有对比说明 `apps/virtual-exchange/src/quote/implementations/README.md`。

### 5.1 v0：嵌套 Map（基线）

- 结构：`Map<product_id, Map<field, [value, updated_at]>>`
- 优点：实现直观，读写语义清晰
- 缺点：对象/Map 开销大、内存碎片明显；在大规模下内存与 GC 压力显著
- 用途：对比基线，不作为生产

### 5.2 v1：扁平数组（生产版本）

核心思想：把每个 product 的各字段按固定顺序放进 **连续数组槽位**，避免 Map/Object 的碎片化与元数据开销。

- 固定字段顺序 `FIELDS`，为每个字段预计算偏移 `mapFieldNameToOffset`
- 每个字段占用 2 个槽位：`[value, updated_at]`
- 每个 product 对应一段连续区间：`baseIndex + fieldOffset`

行为要点：

- **写入幂等**：更新时比较时间戳（新时间戳 >= 旧时间戳才覆盖）。
- **读/过滤**：通过偏移量直接索引数组，避免嵌套结构查找成本。

这套结构主要追求：

- 更新/查询的热点路径尽量少分配、少对象；
- 内存增长更线性、可预测；
- 利用连续存储带来的 CPU cache 友好性。

### 5.3 v2：双数组（类型一致性优先）

- 将 `value` 与 `timestamp` 拆分为 `string[]` 与 `number[]`
- 理论上减少引擎对混合类型数组的类型检查
- 实测在更新/大规模场景下并不总是更优（详见 6）

### 5.4 v3：字符串池化 + Float64Array（技术储备）

目标：在保持连续存储的同时，通过字符串去重减少 value 占用。

- `Float64Array` 存储 `[poolIndex, timestamp]` 对
- 字符串池采用引用计数，避免泄漏

适用条件：业务数据字符串重复率足够高时才可能收益；随机数据下池化开销往往更高。

## 6. 性能与基准测试

### 6.1 报告与结论

- 报告：`apps/virtual-exchange/src/quote/QUOTE_STATE_PERFORMANCE_REPORT.md`
- 关键结论（摘要）：
  - v1 相比嵌套 Map，内存可显著降低，且大规模下更稳定；
  - 更新/查询接近 O(1)，过滤/转储为线性遍历，规模大时成本显著；
  - `dumpAsObject` 在百万级产品下会成为明显瓶颈（对象构建与 GC）。

### 6.2 测试套件

位置：`apps/virtual-exchange/src/quote/benchmark/*`

- `ForkedQuoteStateComparisonTest`：通过子进程隔离避免 GC 干扰，公平比较时间/内存
- `worker.ts`：子进程执行具体测试并输出 JSON
- 覆盖：初始化、更新、查询、过滤、转储

## 7. 关键设计取舍与语义说明

### 7.1 字段级时间戳的意义

行情字段可能来自不同来源/链路，更新节奏不同；字段级时间戳可以：

- 用“最后写入胜出”解决乱序到达；
- `QueryQuotes(updated_at)` 让调用方定义“我至少要新到什么程度”，自然形成增量语义；
- 在不引入复杂事务的情况下，满足大多数实时查询需求。

### 7.2 为什么偏向数组而不是 Map/Object

在超大规模（100K~1M 产品）下：

- Map/Object 会带来大量小对象与隐藏类/哈希表元数据；
- GC 与内存碎片带来的抖动很容易成为尾延迟来源；
- 扁平数组连续布局更容易获得稳定的内存与 CPU cache 表现。

## 8. 已知问题与风险（重要）

### 8.1 读路径会隐式创建 product（潜在内存 DoS）

在 v1/v2 中，`getFieldOffset` 如果 `product_id` 不存在，会直接把该 `product_id` 加入 `products` 和 `mapProductIdToIndex` 并分配槽位。

影响：

- 任意调用方通过 `VEX/QueryQuotes` 传入大量不存在的 `product_ids`，会导致状态无限增长；
- 这属于“读导致写”的副作用，难以通过调用方直觉规避。

建议（择一或组合）：

1. **改存储接口/实现**：读操作不创建 product；只有 `update` 才引入新产品。
2. **在 `VEX/QueryQuotes` 限制输入**：限制 `product_ids` 数量、总字段数；对未知产品直接返回空而不触发分配。
3. **增加淘汰策略**：对长期不更新的产品做 TTL/LRU（需要更明确的业务语义与成本评估）。

### 8.2 `dumpAsObject` 的使用边界

全量导出在大规模下极慢且会制造大量对象，建议：

- 仅调试使用；
- 后续可考虑流式/分批导出或仅导出统计信息。

### 8.3 `QueryQuotes` 的 cacheMissed 仍未补全

当前实现只计算缺失字段列表，没有任何补全逻辑，意味着：

- `QueryQuotes` 更像“缓存查询”而不是“查询即保证返回”；
- 需要上层明确在 miss 时如何拉取行情并回写 `UpdateQuotes`。

## 9. 演进路线（建议）

1. 明确 `QueryQuotes` 语义：仅缓存查询 vs 自动补全查询（并给出 in-flight 去重与并发上限设计）。
2. 修复“读路径分配”风险：优先保证 `QueryQuotes` 不会导致无界增长。
3. 给 `IQuoteState` 增加可选统计/容量接口（例如 `size()`、`hasProduct()`、`getStats()`），用于监控与保护。
4. 基于真实业务数据重复率评估 v3 或“仅对少数字段池化”的混合策略。

## 10. `QueryQuotes` 上游补全：服务发现与路由设计（TODO 方案）

本节聚焦于 `apps/virtual-exchange/src/quote/service.ts` 中 `VEX/QueryQuotes` 的 TODO：当本地缓存缺失时，如何从不同交易所的上游服务拉取并回写缓存。

### 10.1 现状观察（来自 vendor 实现）

当前各 vendor 的 quote 逻辑普遍是：

- 以 RxJS 流合并多个来源，按 `(datasource_id, product_id)` 聚合出 `Partial<IQuote>` 的增量；
- 通过 `terminal.channel.publishChannel('quote', { pattern: '^<DS>/' }, ...)` 发布 quote 频道（供订阅）；
- 可选写入 SQL（通常受 `WRITE_QUOTE_TO_SQL` 环境变量开关控制）。

示例（非穷举）：

- `apps/vendor-okx/src/public-data/quote.ts`
- `apps/vendor-gate/src/services/markets/quote.ts`
- `apps/vendor-bitget/src/services/markets/quote.ts`
- `apps/vendor-huobi/src/services/market-data/quote.ts`

重要结论：

- **目前 vendor 侧并没有统一的“按需 QueryQuotes RPC”**；多数是 push 模式（channel/SQL）。
- 因此 `VEX/QueryQuotes` 的 miss 补全，需要引入一个新的“Provider RPC 协议”，或把 channel/SQL 作为 Provider 的内部数据源。

### 10.2 设计目标

- 一个交易所可以提供多个 `QueryQuote Provider`，每个 Provider 覆盖不同字段集合（例如 OKX：BBO 四个字段一组，open_interest 单独一组）。
- VEX 侧可以 **零配置** 发现 Provider 的能力并做路由（服务发现与路由是重中之重）。
- 支持 in-flight 复用、并发控制、超时与降级，避免放大上游压力。
- 补全结果以 `IQuoteUpdateAction` 回写 `quoteState`，保持字段级时间戳语义。

### 10.3 关键前提：`product_id` 的全局命名

为实现路由，VEX 需要能从 `product_id` 推导 `datasource_id`。

推荐约定：`product_id` 本身是全局路径（使用 `encodePath`），第 1 段为 `datasource_id`，例如：

- `OKX/SWAP/BTC-USDT-SWAP`
- `GATE/SPOT/BTC_USDT`

VEX 路由可用：`decodePath(product_id)[0]`。

备选方案：在 `VEX/QueryQuotes` 请求体中显式增加 `datasource_id` 字段（代价是调用方需要拆分请求）。

### 10.4 Provider RPC 协议（建议）

引入一个统一 method（示例命名）：`Quote/QueryQuotes`。

- 请求（建议）：
  - `datasource_id: string`
  - `product_ids: string[]`（全局 product_id 列表；同一次调用只允许同 datasource）
  - `fields: IQuoteKey[]`（同一次调用只允许 Provider 能覆盖的字段集合）
  - `updated_at: number`
  - `timeout_ms?: number`（可选；用于 Provider 内部等待数据就绪的最长时间）
- 响应：
  - `IQuoteUpdateAction`（只返回 Provider 负责的字段；VEX 会 merge 多个 Provider 的返回）

关键点：Provider 的“能力声明”通过 JSON Schema 表达，而不是通过额外的 registry 服务。

#### 10.4.1 用 JSON Schema 声明字段覆盖（能力发现）

`@yuants/protocol` 的服务发现机制会把服务的 JSON Schema 广播给 Host，`TerminalClient` 会在请求时用 schema 自动筛选可用服务（`libraries/protocol/src/client.ts`）。

因此每个 Provider 只要在 schema 里把自己支持的字段集合约束住，就可以被 VEX 自动发现。

例如：OKX 的 BBO Provider（四个字段）可以用类似 schema：

```json
{
  "type": "object",
  "required": ["datasource_id", "product_ids", "fields", "updated_at"],
  "properties": {
    "datasource_id": { "const": "OKX" },
    "product_ids": { "type": "array", "items": { "type": "string", "pattern": "^OKX/" } },
    "fields": {
      "type": "array",
      "items": { "enum": ["ask_price", "bid_price", "ask_volume", "bid_volume"] }
    },
    "updated_at": { "type": "number" }
  }
}
```

同一个 OKX 进程再注册另一个 Provider（只支持 `open_interest`），即可形成“多个 Provider 覆盖不同字段”的组合。

#### 10.4.2 Provider Schema 约束（便于 VEX 解析能力）

为了让 VEX 能做“按字段集合路由”（而不仅仅是发起一次请求），Provider 的 schema 需要满足可解析约束，否则 VEX 很难从任意 JSON Schema 中可靠地推导“支持哪些字段”。

建议把以下约束写入 Provider 规范（强约束）：

- `properties.datasource_id.const` 必须存在，且为唯一 datasource（例如 `"OKX"`）。
- `properties.fields.items.enum` 必须存在，且枚举值即 Provider 支持的字段集合。
- `properties.product_ids.items.pattern` 建议包含 `^<DS>/`，用于约束该 Provider 只处理本交易所产品。

在此约束下，VEX 可以：

- 直接从 `terminalInfo.serviceInfo[service_id].schema` 解析出 `datasource_id` 与 `fieldSet`，构建 ProviderRegistry；
- 同时依赖 `TerminalClient` 的 schema 校验作为“最后一道防线”，避免路由错误时误调不匹配的服务。

### 10.5 VEX 的路由与聚合算法（建议实现路径）

对 `VEX/QueryQuotes` 的一次请求：

1. **本地命中分析**：对每个 `(product_id, field)` 判断缺失或过期，得到 `cacheMissed`。
2. **按 datasource 拆分**：对 `cacheMissed` 按 `decodePath(product_id)[0]` 分组。
3. **按字段集合路由到 Provider**：
   - 目标：用尽量少的 Provider 覆盖所需字段集合（近似 set cover）。
   - 实用策略：贪心选择“当前能覆盖最多未覆盖字段”的 Provider，直到覆盖完或无 Provider 可用。
4. **发起上游请求**：对每个选中的 Provider 构造请求：
   - `datasource_id` 固定
   - `product_ids` 为该 datasource 下有 miss 的产品集合（建议去重）
   - `fields` 为该 Provider 负责的字段子集
   - `updated_at` 传入阈值
5. **merge 回写**：把每个 Provider 返回的 `IQuoteUpdateAction` 直接 `quoteState.update(...)`。
6. **返回结果**：再做一次 `quoteState.filter(product_ids, fields, updated_at)` 作为最终响应。

### 10.6 in-flight 复用、并发限制与失败语义

必须避免“miss 放大上游请求”，建议：

- **in-flight 复用**：同一个 `(datasource_id, provider_fields, product_ids_hash, updated_at_bucket)` 的请求在途时复用同一个 Promise/Observable。
- **微批**：把短时间窗口内的 miss 合并成一次 provider 请求（例如 10~50ms 窗口）。
- **并发限制**：全局和 per-provider 两级限制（例如全局 32、per-provider 4）。
- **超时与降级**：
  - Provider 失败/超时时：不阻塞整体，返回本地已有的（可能不完整）结果；
  - 可选：把失败的 provider 标记为短暂熔断（例如 1~5s）避免雪崩。

### 10.7 与 `quoteState` 的交互风险（必须先处理）

当前 v1/v2 的实现存在“读路径隐式创建 product”的副作用（见 8.1）。

这对 `VEX/QueryQuotes` 的 miss 分析是灾难级风险：攻击者用不存在的 `product_id` 查询会导致内存无限增长。

因此在实现上游补全前，必须先确保：

- miss 分析不会引入新 product（例如提供 `peekValueTuple`/`hasProduct` 接口，或在 `getValueTuple` 内不做创建）；
- 或在服务层做严格限流与输入校验，且对未知 product 直接跳过、不触发分配。

### 10.8 Provider 的数据来源建议

Provider 本身不一定要直连交易所接口；更推荐复用既有 push 体系：

- 如果 vendor 已 publish `quote` channel：Provider 可在进程内维护轻量缓存（订阅/聚合本地 quote$），然后为 `Quote/QueryQuotes` 提供读取。
- 如果 vendor 只写 SQL：Provider 可基于 SQL 做查询（注意批量查询与缓存策略），但尾延迟与成本可能更差。

## 11. 变更记录

- 2025-12-13：首次整理设计文档，基于当前代码与性能报告撰写。
  - 追加：补充 `QueryQuotes` 上游补全的服务发现与路由设计方案，以及 vendor/protocol 相关观察。
