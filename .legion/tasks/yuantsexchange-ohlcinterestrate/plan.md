# @yuants/exchange 增加 OHLC/InterestRate 历史数据写入服务

## 目标

在 @yuants/exchange 中新增 OHLC 与 InterestRate 历史数据写入服务（schema 元信息可解析、分页拉取、写入 SQL）。

## 非目标（本任务不做）

- 不实现 VEX 侧的调度/搜索算法（例如页码二分搜索、全量任务编排等）
- 不实现任何具体交易所的历史数据抓取逻辑（由各 vendor 传入 `fetchPage`/`requestFunc` 实现）
- 不在本任务内补齐所有历史数据类型（trade 等）

## 要点

- 参考 `libraries/exchange/src/quote.ts` 的 schema 校验与 metadata 解析模式
- 参考 `docs/zh-Hans/code-guidelines/exchange.md` 的“历史数据获取”章节定义翻页语义（仅保留 time + direction）
- 为 OHLC 定义 `IOHLCServiceMetadata`（含 `product_id_prefix`、RFC3339 `duration_list`、`direction`）并提供 `parseOHLCServiceMetadataFromSchema`
- 在 `provideOHLCService` 中注册一个写库服务：按请求参数拉取“一页”数据并写入 `ohlc` 表（不通过 API 返回数据本体，只返回最小调度信息）
  > [REVIEW] 失败要返回失败
  >
  > [RESPONSE] 已在 `### 7) 写库实现策略` 的“错误处理”中明确：`fetchPage`/写库失败必须返回失败（`res.code != 0`），不能吞错或“看起来成功但其实没写进去”。实现上会用 try/catch 包裹并返回失败响应。
  > [STATUS:resolved]
- 每次写入同时落一条“本次拉取范围记录”到 `series_data_range`（`series_id/table_name/start_time/end_time`），用于后续调度/排障（需要新增 migration）
  > [REVIEW] 这个表名可以叫 series_data_range, 更正一下是 series_id + table_name + start_time + end_time(其他信息比如 duration 都被编码在 series_id 里了)
  >
  > [RESPONSE] 已按建议统一：表名为 `series_data_range`，记录维度为 `(series_id, table_name, start_time, end_time)`；并在“拉取范围记录表设计”里明确主键与写入 `ON CONFLICT DO NOTHING`。
  > [STATUS:resolved]
- 同样实现 `interest_rate.ts`（`provideInterestRateService` + metadata + schema 解析），逻辑与 OHLC 对齐
- 补齐 `libraries/exchange/src/index.ts` 导出并保持命名一致、无 vendor 耦合

## 术语与约定

### 1) 时间与 duration

- `duration`：RFC3339 duration（例如 `PT1M`、`P1D`），用于 OHLC；来源参考 `@yuants/data-ohlc`。
- `created_at/closed_at`：RFC3339 `date-time` 字符串（对应 SQL 的 `TIMESTAMPTZ`）。

### 2) series_id 约定（必须与数据类型一致）

- `IOHLC.series_id`：`encodePath(product_id, duration)`（`product_id` 已包含 datasource / exchange name，因此无需额外拼接 `datasource_id`）。
  > [REVIEW] 这里的 encodePath(product_id, duration)，我们现在不需要 datasource_id 了
  >
  > [RESPONSE] 已修改 series_id 约定：`IOHLC.series_id = encodePath(product_id, duration)`，并补充说明 `product_id` 本身已包含 datasource/exchange name，所以不再重复拼 `datasource_id`。
  > [STATUS:resolved]
- `IInterestRate.series_id`：`encodePath(product_id)`（同理不需要 `datasource_id`，且 interest_rate 不包含 `duration` 概念）。
  > [REVIEW] 同上，这里也不需要 datasource_id
  >
  > [RESPONSE] 已修改 InterestRate 的 series_id 约定为 `encodePath(product_id)`，同样不再重复拼接 `datasource_id`。
  > [STATUS:resolved]

### 3) “写库服务”的语义边界

- 服务被调用时：只负责「拉取一页 → 清洗成标准数据结构 → 写入 SQL 表 → 写入范围记录表」。
- API 响应：不返回数据本体；仅返回最小信息（本次写入条数、写入覆盖范围），供调度侧推进。

## 公共分页建模（time + direction）

### 1) 请求参数：`time` + `direction`

以 OHLC 为例（InterestRate 同理，只是是否包含 `duration` 不同）。

> [REVIEW:blocking] 这里改一下设计，不要分类了，只要用一个 time + direction 就可以表达，不需要 id/page/none 这些类型了
>
> [RESPONSE] 已按你的要求把分页模型收敛为“只有 time + direction”：删除 id/page/none 等分类与对应 schema 建模；请求统一为 `direction`（schema const）+ 必传 `time`（date-time），调度推进只依赖响应 `range`。
> [STATUS:resolved]

- `direction`：`backward`（向过去翻页）/ `forward`（向未来翻页）
  - 在 schema 中会固定为 `const`（每个 service 只支持一种方向），用于能力发现与路由分组
- `time`：必传 RFC3339 `date-time`
  - `backward`：`time` 在语义上相当于 `ended_at`
  - `forward`：`time` 在语义上相当于 `started_at`

> [REVIEW] direction 和 time 都必须传，而不是可选的。
>
> [RESPONSE] 已调整为必传：公共分页类型 `IHistoryTimePaging.time` 改为必填；`IIngestOHLCRequest.time` 改为必填；请求 schema 的 `required` 增加 `time`，并把文案从“可选/缺省”改为“必传”。InterestRate 复用同一分页约定。
> [STATUS:resolved]

> [REVIEW] 这里 inclusive | exclusive 可以去掉，不需要出现在这里
>
> [RESPONSE] 已移除所有 `inclusive | exclusive` 相关字段/建模：不再出现在 cursor/request/schema/metadata 中；推进策略改为只用响应 `range`，并依赖写库冲突键处理重叠。
> [STATUS:resolved]

```ts
export interface IHistoryTimePaging {
  direction: 'backward' | 'forward';
  time: string; // RFC3339 date-time
}
```

### 2) 调度侧如何推进下一页（不需要 next_cursor / inclusive/exclusive）

> [REVIEW] 这里的 inclusive | exclusive 可以去掉，不需要出现在这里，以及 pagination metadata 和 cursor 有啥区别啊？不能合并到上面 cursor 里吗
>
> [RESPONSE] 已把“pagination metadata vs cursor”合并掉：只保留请求参数 `direction`（schema const）+ 必传 `time`，并在 `### 2) 调度侧如何推进下一页` 里写清推进规则与为何不需要 inclusive/exclusive。
> [STATUS:resolved]

- 本设计不再单独引入 “pagination metadata vs cursor” 两套结构：只保留请求的 `time+direction`，并把 `direction` 固定在 schema 中（`const`），让 VEX 能从 schema 确定服务的翻页方向。
- 本设计不再建模 `inclusive/exclusive`：写库以 `PRIMARY KEY (series_id, created_at)` 去重，允许调度推进时产生少量重叠；重叠会被 upsert/冲突键自然吞掉。
- 调度推进策略（仅依赖响应中的 `range`）：
  - `direction=backward`：下一页 `time = range.start_time`
  - `direction=forward`：下一页 `time = range.end_time`
  - 若 `wrote_count === 0` 或 `range` 缺失：认为到达边界（没有更多数据）

### 3) 服务响应（最小调度信息）

- `wrote_count`：本次写入条数
- `range`：本页数据覆盖范围（用于 debug/排障/推进下一页）

> [REVIEW] next_cursor 这里可以去掉，不需要出现在响应里
>
> [RESPONSE] 已移除响应里的 `next_cursor`：`IHistoryIngestResult` 现在只包含 `wrote_count` 和可选 `range`；下一页推进规则写在 `### 2) 调度侧如何推进下一页`。
> [STATUS:resolved]

```ts
export interface IHistoryIngestResult {
  wrote_count: number;
  range?: { start_time: string; end_time: string }; // RFC3339 date-time
}
```

## OHLC：接口/类型/Schema 设计（可直接照着写代码）

### 1) 文件与导出

`libraries/exchange/src/ohlc.ts` 导出：

- `IOHLCServiceMetadata`
- `IIngestOHLCRequest`
- `parseOHLCServiceMetadataFromSchema(schema): IOHLCServiceMetadata`
- `provideOHLCService(terminal, metadata, fetchPage, options?)`

公共类型统一放在 `libraries/exchange/src/types.ts` 导出（避免 `index.ts` 通过 `export *` 聚合时产生重复符号）：

- `HistoryPagingDirection`
- `IHistoryTimePaging`
- `IHistoryIngestResult`

### 2) `IOHLCServiceMetadata`

```ts
export interface IOHLCServiceMetadata {
  product_id_prefix: string;
  duration_list: string[]; // RFC3339 duration list
  direction: 'backward' | 'forward';
  // 可选：单页最大条数/建议条数（用于调度侧限流/拆分）
  max_items_per_page?: number;
}
```

说明：

- `product_id_prefix`：用于声明该服务支持的品种范围；用于生成请求 schema 的 `product_id.pattern`，并在 VEX 侧做路由分组。
- `duration_list`：用于声明可拉取的 OHLC 周期集合；用于生成请求 schema 的 `duration.enum`。
- `direction`：用于声明该服务的翻页方向（对齐 `exchange.md`），并会被固化在 request schema 的 `direction.const` 上，便于 VEX 做能力发现与路由分组。

### 3) `provideOHLCService` 的 service method 命名

建议 method 使用明确且可过滤的名字，例如：

- `IngestOHLC`（推荐）：表达“写库”，而不是“查询返回”

这样调度侧可以像 quote scheduler 一样从 `terminalInfo.serviceInfo` 过滤 method 并解析 schema。

### 4) 请求/响应类型（TS）

```ts
export interface IIngestOHLCRequest {
  product_id: string;
  duration: string; // enum = metadata.duration_list
  direction: 'backward' | 'forward'; // const = metadata.direction
  time: string; // RFC3339 date-time
  limit?: number; // 可选：允许调度侧下发单页条数（不保证所有 vendor 支持）
}

export type IIngestOHLCResponse = IHistoryIngestResult;
```

### 5) 请求 Schema（JSON Schema）

注册 service 时生成 schema（关键是把 metadata 编进 schema，便于 parse）：

- `product_id`：`{ type: 'string', pattern: '^' + metadata.product_id_prefix }`
- `duration`：`{ type: 'string', enum: metadata.duration_list }`
- `direction`：`{ const: metadata.direction }`（用于能力发现与路由分组）
- `time`：`{ type: 'string', format: 'date-time' }`（必传）

```ts
{
  type: 'object',
  required: ['product_id', 'duration', 'direction', 'time'],
  properties: {
    product_id: { type: 'string', pattern: `^${metadata.product_id_prefix}` },
    duration: { type: 'string', enum: metadata.duration_list },
    direction: { const: metadata.direction },
    time: { type: 'string', format: 'date-time' },
    limit: { type: 'number' },
  },
}
```

### 6) `parseOHLCServiceMetadataFromSchema`（从 schema 解析 metadata）

参考 `parseQuoteServiceMetadataFromSchema` 的做法：

- 用 `createValidator` 做结构校验（缺 schema / schema 不符合预期 → 抛 `newError`，错误码风格与 quote 对齐）
- 提取：
  - `product_id_prefix`：来自 `schema.properties.product_id.pattern` 去掉开头 `^`
  - `duration_list`：来自 `schema.properties.duration.enum`
  - `direction`：来自 `schema.properties.direction.const`

约束/边界：

- parse 不尝试“猜测” direction：必须能从 schema 结构稳定解析；解析不了就视为 schema invalid（让 vendor 明确声明）。

### 7) 写库实现策略（provideOHLCService 内部）

优先选择可复用的库能力：

- `@yuants/sql`：在 service handler 中直接使用 `requestSQL(buildInsertManyIntoTableSQL(...))` 写库（单次请求只写一页数据，不需要 buffer writer）
- OHLC 冲突键：与表主键一致 `['series_id', 'created_at']`（见 `tools/sql-migration/sql/ohlc.sql`）
- Range 记录写入：写到 `series_data_range`，使用 `ON CONFLICT DO NOTHING` 保证幂等

写库步骤（单次请求）：

1. `fetchPage(req)` 拉取一页，返回 `IOHLC[]`（或等价结构，至少能拿到本页的 OHLC 列表）
2. 对每条数据保证字段完整（至少包含：`series_id/product_id/duration/created_at/closed_at/open/high/low/close`；`datasource_id`、`volume/open_interest` 按表结构填充）
3. 将本页数据写入 `ohlc` 表（`requestSQL(buildInsertManyIntoTableSQL(data, 'ohlc', { conflictKeys: ['series_id','created_at'] }))`）
4. 计算范围：
   - `start_time = min(items[].created_at)`
   - `end_time = max(items[].closed_at)`（如果不可靠则回退到 `max(created_at)`，需在实现时统一约定）
5. 写入 `series_data_range` 一条记录：`{ series_id, table_name: 'ohlc', start_time, end_time }`（冲突忽略，允许重复调用）
6. 返回 `wrote_count/range`

错误处理：

- `fetchPage` 或写库失败：必须返回失败（`res.code != 0`），不要吞错。
  - 允许在实现中包装 `newError('OHLC_SERVICE_FAILED', { req, error })`，但对外必须体现为失败响应，而不是“看起来成功但其实没写进去”。

## InterestRate：接口/类型/Schema 设计（同理）

`libraries/exchange/src/interest_rate.ts` 结构与 OHLC 对齐，差异点：

- 写入表：`interest_rate`（见 `tools/sql-migration/sql/interest_rate.sql`）
- conflict keys：`['series_id', 'created_at']`
- `series_id`：`encodePath(product_id)`（无 `duration`；也不需要 `datasource_id`）

建议导出：

- `IInterestRateServiceMetadata`（至少包含 `product_id_prefix` + `direction` + 可选 `max_items_per_page`）
- `IIngestInterestRateRequest`
- `parseInterestRateServiceMetadataFromSchema`
- `provideInterestRateService`

## “拉取范围记录”表设计（已确认）

目前 `tools/sql-migration/sql` 中没有现成表承载“某个 series 在某个 table 写入了一段时间范围”的记录。

本任务将新增唯一的一张表：

> [REVIEW:blocking] 只要创建 series_data_range 表就可以了: (series_id, table_name, start_time, end_time)
>
> [RESPONSE] 已将范围记录表设计收敛为唯一方案：只新增 `series_data_range(series_id, table_name, start_time, end_time)`，并在设计里写明复合主键与写入 `ON CONFLICT DO NOTHING`，migration 文件名 `tools/sql-migration/sql/series_data_range.sql`。
> [STATUS:resolved]

- 表名：`series_data_range`
- 字段（严格按你给的四元组，不再额外加列）：
  - `series_id TEXT NOT NULL`
  - `table_name TEXT NOT NULL`
  - `start_time TIMESTAMPTZ NOT NULL`
  - `end_time TIMESTAMPTZ NOT NULL`
- 主键：`PRIMARY KEY (series_id, table_name, start_time, end_time)`
- 索引（可选）：`(table_name, series_id, start_time desc)`（便于按 series 回看最近一次覆盖范围）
- 写入策略：`ON CONFLICT DO NOTHING`（同一页重复拉取时允许重复写入而不报错）
- migration 落点：新增 `tools/sql-migration/sql/series_data_range.sql`

## 文件改动清单（最终实现阶段）

- 新增：`libraries/exchange/src/ohlc.ts`
- 新增：`libraries/exchange/src/interest_rate.ts`
- 修改：`libraries/exchange/src/index.ts`（导出新增模块）
- 新增：`tools/sql-migration/sql/series_data_range.sql`

## 范围

- libraries/exchange/src/ohlc.ts
- libraries/exchange/src/interest_rate.ts
- libraries/exchange/src/index.ts
- docs/zh-Hans/code-guidelines/exchange.md（如需补充接口/元信息说明）
- tools/sql-migration/sql（如需新增“拉取范围记录”表）

## 阶段概览

1. **调研** - 1 个任务
2. **设计** - 3 个任务
3. **实现** - 3 个任务
4. **验证与文档** - 1 个任务

---

_创建于: 2025-12-19 | 最后更新: 2025-12-19_
