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
  - 约定：本模块信任 vendor 写入的 `series_data_range` 语义 —— **单条 range 内没有 gap**；gap 只在 `prev.end_time < next.start_time` 时成立；touch（`=`）不算 gap；range merge 只在严格 overlap（`>`）时发生（见 6.5/7）

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
- `apps/virtual-exchange/src/series-data/scheduler.ts`：集中实现（per-capability 分桶调度）
  - 服务发现
  - `product` 扫描
  - per-capability head/tail 队列与并发控制
  - range merge
  - gap 检测与回补
  - `VEX/SeriesData/Peek`
- `apps/virtual-exchange/src/series-data/fifo-queue.ts`：FIFO 队列实现（带 snapshot 支持）

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
   - OHLC：`capKey = encodePath('IngestOHLC', product_id_prefix, direction)`（duration_list 作为 capability 的属性，不进入 capKey）
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
ORDER BY product_id ASC
```

### 5.1 扫描节奏与公平性

第一版假设 `product_id` 规模不大，采用 **全量扫描**：

- 每次 tick 只扫描一个 capability（轮转），避免单一 prefix 长期占用扫描机会；
- 每个 capability 扫描后会设置 `nextScanAt`（默认 5 分钟）控制全量扫描频率。

InterestRate 固定过滤（需要 `product` 表存在 `no_interest_rate` 列）：

- 在 `interest_rate` 扫描 where 条件追加：`COALESCE(no_interest_rate, false) = false`

## 6. 调度模型：head 优先 + tail 闲暇

### 6.1 数据结构

本模块采用 “per-capability 分桶调度”：

- capability（按 schema 派生）：`capKey = encodePath(method, product_id_prefix, direction)`
- series（调度最小粒度）：`seriesKey = encodePath(table_name, direction, product_id, duration?)`

每个 capability 在内存里对应一个 `ICapabilityState`：

- `capKey`
- `headQueue` / `tailQueue`: FIFO（元素为 series job）
- `inflight`: cap 内串行执行（固定 1）
- `nextEligibleAt` / `backoff_ms`: cap 级退避（429/503/超时只暂停该 cap）
- `pendingHead/pendingTail`: cap 内按 series 去重（每个 series 每种 job 最多 1 个 pending）

每个 series 在内存里对应一个 `ISeriesState`（归属某个 capKey）：

- `capKey`: 所属 capability
- `seriesType`: `ohlc` | `interest_rate`
- `table_name`: `ohlc_v2` | `interest_rate`
- `series_id`: 由 helper 编码
- `direction`: `backward` | `forward`（来自 capability const）
- `ranges`: `series_data_range` merge 后的**多段** ranges（用来识别 gap）
- `union_start_ms` / `union_end_ms`: 当前已覆盖范围的外包框（`min(start), max(end)`；不代表连续覆盖）
- `last_window_ms`: 最近一次成功 page 的窗口大小（`range.end - range.start`）
- `pendingHead` / `pendingTail`: 去重标记（同类型最多一个 pending）
- `inFlight`: 是否正在请求（避免重复并发）
- `nextEligibleAt` / `backoff_ms`: 失败退避
- tail 空页：视为“未推进”，会触发 backoff，稍后继续重试（不永久停止）

### 6.2 入队规则（`scheduleIfNeeded`）

优先级：

1. 只要 head 需要，就只入 head，不入 tail；
2. tail 在 head backlog 较低时执行（避免影响新鲜度）。

实现细节：

- tail job 可以先入 cap 的 `tailQueue`（避免时机错过导致 tail 长期无法入队）；真正的 tail 执行会在出队时根据 `globalHeadBacklog < TAIL_ONLY_WHEN_HEAD_BELOW`（以及 cap 内 headQueue 是否为空）做 gate。

判定：

- head 需要：`union_end_ms` 不存在，或 `now - union_end_ms > headLagMs`
  - IR 默认 `headLagMs=8h`（可通过 env 调整）
  - OHLC 默认 `headLagMs ≈ 2 * duration`（至少 60s）
- tail 需要：`union_start_ms` 存在

### 6.3 请求参数：`time` 的计算

只依赖 `direction + union + last_window_ms`，并且**每次请求都主动制造 overlap**（避免大量 touch 段无法被 strict overlap merge 收敛）：

- `direction=backward`
  - head：`time = now`，若已有覆盖则 `time += overlapMs`（并 clamp 到 `<= now`）
  - tail：先算 baseTime，再加 overlap
    - 若存在 gap：`baseTime = gap.right.startMs`（回补“距离 now 最近”的 gap）
    - 否则：`baseTime = union_start_ms`（向过去推进）
    - `time = baseTime + overlapMs`（并 clamp 到 `<= now`）
- `direction=forward`
  - head：若有 `union_end_ms` 则 `baseTime = union_end_ms`；否则用 `baseTime = now - seedWindowMs` 做种子（默认 1d）；`time = baseTime - overlapMs`
  - tail：先算 baseTime，再减 overlap
    - 若存在 gap：`baseTime = gap.left.endMs`（gap 左侧边界，向未来补齐右侧 gap）
    - 否则：`baseTime = union_start_ms - windowMs`（best-effort 向过去回补）
    - `time = baseTime - overlapMs`

其中 `overlapMs` 的经验规则：

- OHLC：优先用 `duration` 的 offset（例如 1m/5m/1h），确保“下一次请求窗口”会压进已有覆盖
- InterestRate：默认用 1h（不会太小，也不会太夸张）
- 若已知 `last_window_ms`：会限制 overlap 到 `< last_window_ms`（避免 overlap 过大导致永远无法推进）

### 6.4 并发、背压与退避

目标：pending 不会无限增长。

- 全局并发：`maxInflight=20`（硬编码在 `CONFIG`），达到上限时停止启动新 job；
- per-capability 串行：同一 `capKey = encodePath(method, product_id_prefix, direction)` 同时最多 1 个 in-flight；
- 队列去重：每个 series 的 head/tail 各最多一个 pending（执行后如仍需要，会重新排到队尾，保证公平性）；
- tail 限制：只有 `globalHeadBacklog < TAIL_ONLY_WHEN_HEAD_BELOW` 才允许执行 tail（默认 20）；
- 失败退避：
  - 失败后 `backoff_ms` 线性增长（上限 5min），并设置 `nextEligibleAt`（按 cap 粒度隔离）
  - 退避期间不会重复入队/重复执行
- 可选限速（TokenBucket）：
  - 若 vendor 有严格 QPS 限制，cap 内串行仍可能触发 429，可按 capKey 增加 token bucket；
  - 实现必须复用 `@yuants/utils` 的 `tokenBucket`（不要自造），在执行 job 前 `await bucket.acquire(1)`；
  - bucketId 建议：`encodePath('series-data', capKey)`。

### 6.5 缺口回补（gap）— 基于 `series_data_range`（融入 tail 逻辑）

核心前提：信任 vendor 写入的 `series_data_range` 语义正确 —— **单条 range 内没有 gap**。但多段 ranges 之间仍可能存在 gap，因此我们约定：

- merge：只在严格 overlap（`prev.end_time > next.start_time`）时发生（用于碎片收敛）
- gap：只在严格缺口（`prev.end_time < next.start_time`）时成立（用于回补）
- touch：`prev.end_time == next.start_time` 不 merge，但也不算 gap（仍视为连续覆盖）

gap 判定（在 merge 后的 ranges 上）：

- 将 ranges 按 `start_time ASC` 排序；
- 若相邻两段满足 `prev.end_time >= next.start_time`（overlap 或 touch），则可视为连续；
- 若存在 `prev.end_time < next.start_time`，则两段之间存在 gap（严格缺口）。

回补策略（把 gap 当作 tail 来处理，不引入单独的 gapQueue）：

- 实现：在 `computeTailTime` 函数中，优先检测 gap；若有 gap 则返回 gap 边界作为 tail 的 `time`。
- gap 检测：`findNearestGap(ranges)` 从 ranges 尾部向前扫描，找到第一个满足 `left.endMs < right.startMs` 的相邻段对。
- 目标：每次优先回补"距离 now 最近"的 gap（即 `ranges[length-2]` 与 `ranges[length-1]` 之间的 gap）。
- `direction=backward`：`time = gap.right.startMs`（右侧段的起点，向过去拉取以填补左侧 gap）
- `direction=forward`：`time = gap.left.endMs`（左侧段的终点，向未来拉取以填补右侧 gap）
- 补齐判据：当 gap 消失（即相邻段变为 touch 或 overlap）时，tail job 会切换为"向过去回补"模式（使用 `union_start_ms`）。

注意：第一版实现**不使用单独的 gapQueue**，gap 检测完全基于内存中的 `ranges` 数组，性能更高且逻辑更简单。

## 7. range 合并（防止 `series_data_range` 碎片爆炸）

写库端会不断 append `(start_time, end_time)`，长时间运行会形成大量重叠/相邻区间。

合并目标：对同 `(series_id, table_name)` 把区间收敛为尽可能少的段。

第一版实现采用 SQL（单 key transaction，窗口函数分组，**差量 compaction**）：

- `SELECT ... FOR UPDATE` 锁住该 key 的所有行（`locked`）；
- 用窗口函数把重叠区间归并成组（`running_end` + `is_new_group` + 分组求 min/max）得到 `merged`；
- **差量 compaction**（关键）：
  - `to_delete = locked - merged`：只删除那些不在 merged 结果里的旧段
  - `to_insert = merged - locked`：只插入那些 merged 结果里新增的段
  - 这样 touch 段（不需要 merge 的段）会既不删也不插，避免被误删
- 最后返回合并后的 ranges，再计算 `union_start_ms/union_end_ms` 和 `segments[]`。

合并判定（按 review 最终确认）：

- **只在严格 overlap 时合并**：`prev.end_time > next.start_time`
- **touch 不合并**：`prev.end_time == next.start_time` 时保持两段独立
- **gap 不合并**：`prev.end_time < next.start_time` 时保持两段独立

窗口函数中的分组条件：`start_time >= lag(running_end)` 则开启新组（即 touch 或 gap 时分组）。

返回结构：

```typescript
{
  segments: { startMs: number; endMs: number }[];  // merge 后的所有段（用于 gap 检测）
  union?: { startMs: number; endMs: number };      // 外包框（用于调度决策）
}
```

## 8. 可观测与运维入口

### 8.1 启停

- 默认不启用：`VEX_SERIES_DATA_ENABLED!=1` 时只打印 Disabled 日志，不做任何调度；
- 启用：`VEX_SERIES_DATA_ENABLED=1`

### 8.2 Peek

`VEX/SeriesData/Peek` 返回（per-capability 详细状态）：

- `enabled: true`
- `only_product_id_prefix`：过滤前缀（可选）
- `inflight`：全局并发数
- `cap_count`：capability 总数
- `global_head_backlog`：全局 head 队列总大小
- `series_count`：series 总数
- `caps[]`（top 50）：每个 cap 的详细状态
  - `capKey`：capability 唯一标识
  - `method`：`IngestOHLC` 或 `IngestInterestRate`
  - `product_id_prefix`：产品前缀
  - `direction`：`backward` 或 `forward`
  - `head_queue_size`：该 cap 的 head 队列大小
  - `tail_queue_size`：该 cap 的 tail 队列大小
  - `inflight`：该 cap 是否正在执行
  - `backoff_ms`：该 cap 当前退避时间
  - `nextEligibleAt`：该 cap 下次可执行时间（格式化时间字符串）

Peek 端点名称：`VEX/SeriesData/Peek`

### 8.3 常用调参（env）

第一版实现采用**硬编码 CONFIG**，后续可改为支持环境变量覆盖：

- `VEX_SERIES_DATA_ENABLED=1`：启用开关（必填）
- `VEX_SERIES_DATA_ONLY_PRODUCT_ID_PREFIX`：仅处理指定前缀的 product（可选，用于测试/灰度）
- `VEX_SERIES_DATA_LOG_QUEUE_INTERVAL_MS`：定时打印队列状态的间隔（可选，默认 10s）
- ~~`VEX_SERIES_DATA_MAX_INFLIGHT`~~（当前硬编码为 20）
- ~~`VEX_SERIES_DATA_TAIL_ONLY_WHEN_HEAD_BELOW`~~（当前硬编码为 20）
- ~~`VEX_SERIES_DATA_SCAN_FULL_LOOP_INTERVAL_MS`~~（当前硬编码为 5 分钟）
- ~~`VEX_SERIES_DATA_INTEREST_RATE_HEAD_LAG_MS`~~（当前硬编码为 8 小时）
- ~~`VEX_SERIES_DATA_FORWARD_SEED_WINDOW_MS`~~（当前硬编码为 24 小时）

第一版硬编码配置（位于 `scheduler.ts` 的 `CONFIG` 对象）：

```typescript
const CONFIG = {
  tickIntervalMs: 1_000, // 调度循环间隔：1 秒
  scanFullLoopIntervalMs: 5 * 60_000, // 全量扫描间隔：5 分钟
  maxInflight: 20, // 全局最大并发：20
  tailOnlyWhenGlobalHeadBelow: 20, // tail 执行门槛：head 队列 < 20
  defaultInterestRateHeadLagMs: 8 * 60 * 60_000, // IR head lag：8 小时
  defaultForwardSeedWindowMs: 24 * 60 * 60_000, // forward 种子窗口：24 小时
  maxBackoffMs: 5 * 60_000, // 最大退避时间：5 分钟
  backoffStepMs: 5_000, // 退避步长：5 秒
} as const;
```

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

- **环境变量支持**：当前 CONFIG 全部硬编码，建议支持环境变量覆盖（如 `VEX_SERIES_DATA_MAX_INFLIGHT` 等）；
- **cap 内并发 > 1**：例如 head/tail 独立并发，或引入 cap 级速率预算；
- **维护更精确的 union**：当前每次 ingest 成功都会重新 merge，可缓存 ranges 减少数据库查询；
- **文件拆分**：把 `scheduler.ts` 拆分成 registry/scan/queue/range 等模块（在复杂度上升后再做）；
- **配置表支持**：如果需要更可控的采集范围，可引入配置表替代全量扫描（方案 B）；
- **gap 检测优化**：当前 gap 检测只在 tail 时触发，可考虑定期主动扫描（trade-off：增加复杂度）。
