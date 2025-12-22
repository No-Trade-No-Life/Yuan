# VEX `series-data` 设计说明

> 本文描述 `apps/virtual-exchange/src/series-data/` 的第一版实现思路与关键取舍，便于后续维护与迭代。

## 1. 背景与目标

在 vendor 侧已提供 `IngestOHLC` / `IngestInterestRate` 写库服务（由 `@yuants/exchange` 定义 contract），但缺少 VEX 侧统一调度：

- **拉新（head）优先**：尽快把数据写到接近“当前时间”；
- **回补（tail）闲暇**：在不影响拉新的前提下，逐步向过去填历史；
- **稳态运行**：避免启动时把 DB 或 Vendor 打爆；失败可退避；不会无限堆积待调度任务；
- **可观测**：能够从 VEX 查看“发现了哪些能力、当前队列、inflight 等”。

本模块第一版实现目标：

- 发现所有可用的 `IngestOHLC` / `IngestInterestRate` 服务能力；
- 基于 `product` 表扫描（方案 A）枚举目标 `series`；
- 按 head/tail 策略调度请求；
- 维护并收敛 `series_data_range`（范围合并），避免范围碎片爆炸；
- 提供最小观测接口 `VEX/SeriesData/Peek`；
- Vendor 端用 `IServiceOptions` 做**兜底限流**（即使 VEX 放飞也不会把 vendor 自己打爆）。

## 2. 依赖与 contract 对齐

### 2.1 Ingest contract（来自 `@yuants/exchange`）

两类服务均采用 “`time + direction`” 模型（direction 为 schema const）：

- `IngestOHLC` request: `{ product_id, duration, direction, time }`
- `IngestInterestRate` request: `{ product_id, direction, time }`
- response: `{ wrote_count, range?: { start_time, end_time } }`
  - 调度推进只依赖 `range`，不依赖 `wrote_count`（`wrote_count` 可能与实际 insert 数不一致）

### 2.2 `series_id` 编码（按 review 的约定）

- OHLC：`series_id = product_id + '/' + duration`
  - helper：`@yuants/data-ohlc` 的 `encodeOHLCSeriesId` / `decodeOHLCSeriesId`
- InterestRate：`series_id = product_id`
  - helper：`@yuants/data-interest-rate` 的 `encodeInterestRateSeriesId` / `decodeInterestRateSeriesId`

### 2.3 表结构与写入落点

- OHLC 写入新表：`ohlc_v2`
  - migration：`tools/sql-migration/sql/ohlc_v2.sql`
  - 字段去除：`datasource_id/product_id/duration`（均可由 `series_id` 推导或不再需要）
- InterestRate 仍写 `interest_rate`
- 范围记录表：`series_data_range(series_id, table_name, start_time, end_time)`
  - vendor ingest 服务每次写库后 append 一条 range
  - VEX 调度器会对同 `(series_id, table_name)` 做合并收敛

## 3. 模块边界与文件组织

第一版对齐 `apps/virtual-exchange/src/quote/scheduler.ts` 的思路：**先集中在一个文件**，保证可读与可维护（后续复杂了再拆）。

- `apps/virtual-exchange/src/series-data/index.ts`：启动入口（import `./scheduler`）
- `apps/virtual-exchange/src/series-data/scheduler.ts`：集中实现
  - 服务发现
  - `product` 扫描
  - head/tail 队列与并发控制
  - range merge
  - `VEX/SeriesData/Peek`

## 4. 能力发现（service discovery）

数据来源：`terminal.terminalInfos$`。

做法：

1. 遍历 `terminalInfos[].serviceInfo`；
2. 过滤 method：`IngestOHLC` / `IngestInterestRate`；
3. 用 `parseOHLCServiceMetadataFromSchema` / `parseInterestRateServiceMetadataFromSchema` 从 schema 派生：
   - `product_id_prefix`
   - `duration_list`（OHLC）
   - `direction`（const）
4. 将能力压成 `capKey`，形成 `capabilities[]`：
   - OHLC：`capKey = encodePath('IngestOHLC', product_id_prefix, direction, duration_list.join(','))`
   - IR：`capKey = encodePath('IngestInterestRate', product_id_prefix, direction)`

第一版**不做显式指定实例**（不关心同能力多实例的负载均衡），请求阶段直接使用：

- `terminal.client.requestForResponseData('IngestOHLC', req)`
- `terminal.client.requestForResponseData('IngestInterestRate', req)`

由 `TerminalClient` 按 schema 匹配候选服务并随机选择目标实例。

## 5. 目标 series 枚举（方案 A：扫描 `product` 表）

核心思路：对每个 capability 的 `product_id_prefix` 去 `product` 表做前缀扫描：

```sql
SELECT product_id
FROM product
WHERE product_id LIKE '${prefix}%'
  AND product_id > '${cursor}'
ORDER BY product_id ASC
LIMIT ${batch_size};
```

### 5.1 扫描游标与渐进 enqueue

每个 capability 维护自己的扫描游标：

- `scanCursorProductId`：上次扫到的最大 `product_id`
- `nextScanAt`：本轮扫完后休眠（避免无穷循环占资源）

渐进策略：

- 每次只扫一小批（默认 `SCAN_BATCH_SIZE=200`）；
- 扫到的产品不会“全量无脑入队”，而是交给 `scheduleIfNeeded()`：
  - 只在“确实需要拉新/回补”时才入队；
  - 且 head 队列有目标上限（默认 `HEAD_QUEUE_TARGET_SIZE=200`），到顶就停止继续扫描/入队。

### 5.2 InterestRate 的 `no_interest_rate` 过滤（可选）

如果希望跳过 `product.no_interest_rate=true` 的品种：

- 设置 `VEX_SERIES_DATA_FILTER_NO_INTEREST_RATE=1`

该过滤只对 `interest_rate` 扫描生效；默认关闭以避免依赖字段存在性。

## 6. 调度模型：head 优先 + tail 闲暇

### 6.1 数据结构

每个 series 在内存里对应一个 `ISeriesState`：

- `seriesType`: `ohlc` | `interest_rate`
- `table_name`: `ohlc_v2` | `interest_rate`
- `series_id`: 由 helper 编码
- `direction`: `backward` | `forward`（来自 capability const）
- `union_start_ms` / `union_end_ms`: 当前已覆盖范围（从 `series_data_range` merge 得到）
- `last_window_ms`: 最近一次成功 page 的窗口大小（`range.end - range.start`）
- `pendingHead` / `pendingTail`: 去重标记（同类型最多一个 pending）
- `inFlight`: 是否正在请求（避免重复并发）
- `nextEligibleAt` / `backoff_ms`: 失败退避
- `tailExhausted`: tail 连续空页后可标记为“暂时别回补”

队列：

- `headQueue`: FIFO（拉新）
- `tailQueue`: FIFO（回补）

### 6.2 入队规则（`scheduleIfNeeded`）

优先级：

1. 只要 head 需要，就只入 head，不入 tail；
2. tail 只有在 “head 队列很小/很闲” 的时候才入队。

判定：

- head 需要：`union_end_ms` 不存在，或 `now - union_end_ms > headLagMs`
  - IR 默认 `headLagMs=8h`（可通过 env 调整）
  - OHLC 默认 `headLagMs ≈ 2 * duration`（至少 60s）
- tail 需要：`union_start_ms` 存在，且 `tailExhausted=false`

### 6.3 请求参数：`time` 的计算

只依赖 `direction + union + last_window_ms`：

- `direction=backward`
  - head：`time = now`
  - tail：`time = union_start_ms`
- `direction=forward`
  - head：若有 `union_end_ms` 则 `time = union_end_ms`；否则用 `now - seedWindowMs` 做种子（默认 365d）
  - tail：`time = union_start_ms - windowMs`（windowMs 优先用 `last_window_ms`，否则退回 seedWindowMs）

### 6.4 并发、背压与退避

目标：pending 不会无限增长。

- 全局并发：`MAX_INFLIGHT`（默认 4），达到上限时停止出队；
- 队列去重：每个 series 的 head/tail 各最多一个 pending；
- 扫描限制：head 队列到达 `HEAD_QUEUE_TARGET_SIZE` 就停止继续扫描；
- tail 限制：只有 `headQueueSize < TAIL_ONLY_WHEN_HEAD_BELOW` 才允许出队 tail（默认 20）；
- 失败退避：
  - 失败后 `backoff_ms` 线性增长（上限 5min），并设置 `nextEligibleAt`
  - 退避期间不会重复入队/重复执行

## 7. range 合并（防止 `series_data_range` 碎片爆炸）

写库端会不断 append `(start_time, end_time)`，长时间运行会形成大量重叠/相邻区间。

合并目标：对同 `(series_id, table_name)` 把区间收敛为尽可能少的段。

第一版实现采用 SQL（单 key transaction）：

- `SELECT ... FOR UPDATE` 锁住该 key 的所有行；
- 用窗口函数把重叠/相邻区间归并成组；
- `DELETE` 原行，`INSERT` merged 行；
- 最后返回合并后的 ranges，再计算 `union_start_ms/union_end_ms`。

合并判定：只要 `next.start_time <= current.end_time`（overlap 或 touch）就合并，不引入“允许 gap”的假设。

## 8. 可观测与运维入口

### 8.1 启停

- 默认不启用：`VEX_SERIES_DATA_ENABLED!=1` 时只打印 Disabled 日志，不做任何调度；
- 启用：`VEX_SERIES_DATA_ENABLED=1`

### 8.2 Peek

`VEX/SeriesData/Peek` 返回：

- `capabilities`（能力列表/扫描游标/下次扫描时间）
- `series_count`
- `head_queue_size` / `tail_queue_size`
- `inflight`

### 8.3 常用调参（env）

- `VEX_SERIES_DATA_MAX_INFLIGHT`
- `VEX_SERIES_DATA_HEAD_QUEUE_TARGET_SIZE`
- `VEX_SERIES_DATA_TAIL_QUEUE_TARGET_SIZE`
- `VEX_SERIES_DATA_TAIL_ONLY_WHEN_HEAD_BELOW`
- `VEX_SERIES_DATA_SCAN_BATCH_SIZE`
- `VEX_SERIES_DATA_SCAN_FULL_LOOP_INTERVAL_MS`
- `VEX_SERIES_DATA_INTEREST_RATE_HEAD_LAG_MS`
- `VEX_SERIES_DATA_FORWARD_SEED_WINDOW_MS`
- `VEX_SERIES_DATA_FILTER_NO_INTEREST_RATE=1`

## 9. Vendor 侧限流兜底（`IServiceOptions`）

为避免“启动时打爆 vendor”，各 vendor 的 `provideOHLCService/provideInterestRateService` 在第一版统一加了较保守的 `serviceOptions`：

- `concurrent=1`
- `max_pending_requests=20`
- token bucket（ingress/egress）用于限制进出队速率

这让 VEX 即使误配置了较大的并发，也会被 vendor 端拒绝（429/503）或排队，从而触发 VEX 的 backoff。

## 10. 已知限制与后续改进方向

### 10.1 已知限制

- **不做显式实例调度**：当前请求完全依赖 `TerminalClient` 的随机选择，无法做“按实例配额/冷却/权重”的更精细策略；
- **series_data_range merge 是按 key 全量锁**：对极大碎片的 key 合并会有一定开销（但可保证收敛与一致性）；
- **历史数据不搬迁/不双写**：`ohlc` 与 `ohlc_v2`、旧/新 series_id 可能并存，需要在读取侧明确选用哪个表/编码。

### 10.2 可选改进

- 引入 per-capability 的“速率预算/动态熔断”（比如 429 后对该 capability 冷却）；
- 维护更精确的 union（例如缓存 ranges，避免每次都做 merge）；
- 把 `scheduler.ts` 拆分成 registry/scan/queue/range 等模块（在复杂度上升后再做）；
- 如果需要更可控的采集范围，可引入配置表替代全量扫描（方案 B）。
