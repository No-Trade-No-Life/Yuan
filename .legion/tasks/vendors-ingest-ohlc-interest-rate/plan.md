# vendors-ingest-ohlc-interest-rate

## 0. Review 清单（你需要先确认的点）

1. **page-only / one-page 的利率历史要不要接入本次 contract**：
   - BITGET（USDT-FUTURES 资金费率）= page-only（cursor=page）
   - HTX（SWAP 资金费率）= page-only（page_index）
   - GATE（FUTURE 资金费率）= one-page（当前 wrapper 无时间参数）
     > [REVIEW] page-only / one-page 当然要接入，vendor 可以通过 time 参数+二分查找来测试具体的页码
     >
     > [RESPONSE] 接受：page-only / one-page 也接入本次 contract。对 page-only（BITGET/HTX）会实现“按 time 定位 page”的适配层：指数探测 + 二分查找定位目标页，再拉取该页并返回 range。对 one-page（GATE）会优先补齐支持 time range/offset 的 API wrapper，使其变为可按 time 翻页的实现；若 Gate 端点确实无法翻页，会在实现前在 plan 中明确降级行为。
     > [STATUS:resolved]
2. **是否允许 vendor 同时保留旧的 `createSeriesProvider`（data-series）逻辑**：
   - 新增 ingest service 后，vendor 可能同时存在“旧数据链路 + 新 VEX ingest 链路”，需要确认是否接受并行运行期（避免误以为“已经切换完成”）。
     > [REVIEW] 一定要保留旧有数据链路，直到 VEX 确认“切换完成并且不再调用旧链路”为止
     >
     > [RESPONSE] 接受：实现阶段会保留旧有 `createSeriesProvider` 链路不动，仅新增 `IngestOHLC`/`IngestInterestRate` 服务与入口 import；等 VEX 确认完全切换后再单开任务清理旧链路。
     > [STATUS:resolved]
3. **series_id 编码切换风险**：
   - `@yuants/exchange` 新 ingest 侧：`series_id = encodePath(product_id, duration?)`（不再是 `OKX/{product_id}/{duration}` 这种结构化路径）
   - 现有 `createSeriesProvider` 多数仍使用 `series_id_prefix_parts` 的老编码（会导致同一数据在表里出现两套 series_id）
     > [REVIEW] 你就写新的代码，完全不要管 createSeriesProvider 的 series_id 编码问题，等 VEX 切换完成后再统一处理
     >
     > [RESPONSE] 接受：本任务只新增 ingest 服务代码，不处理/不统一旧链路的 series_id 编码差异；风险与后续统一动作会留到 VEX 切换完成后的独立任务处理。
     > [STATUS:resolved]
4. **各 vendor 的 `direction` 是否要统一为 `backward`**：
   - 当前更自然的实现：OKX/BITGET/BINANCE-OHLC/HYPERLIQUID-OHLC 倾向 `backward`；ASTER/BINANCE-InterestRate 更像 `forward`
   - 如果你希望 VEX 调度逻辑“只写一种方向”，那就需要在 vendor 侧把部分 API 改成 window-based 的 backward（需要额外确认 API 行为）
     > [REVIEW] direction 不用统一，vendor 按最自然的方式实现就行
     >
     > [RESPONSE] 接受：direction 不统一；每个 vendor 按其最自然/最稳定的 API 行为选择 `backward` 或 `forward`，并在能力矩阵里写死到 schema const。
     > [STATUS:resolved]

## 目标

在各 vendor 中新增基于 `@yuants/exchange` 的 `IngestOHLC` / `IngestInterestRate` 写库服务（`provideOHLCService` / `provideInterestRateService`），供 VEX 统一调度历史数据。

## 非目标（本任务不做）

- 不改 VEX 调度算法（只做 vendor 侧注册能力与 fetchPage 适配）
- 不在本任务内移除/替换现有 `createSeriesProvider` 链路（除非你明确要求“切换并删除旧链路”）
- 不在本任务内统一所有交易所的分页语义到“同一种方向 + 同一种窗口大小”（只保证满足当前 ingest contract）

## 要点

- 以 `yuantsexchange-ohlcinterestrate` 的接口语义为准：request 必含 `time` + `direction`，服务返回 `wrote_count + range`，不回传数据本体
- 各 vendor 的实现参考其 `src/services/quotes.ts` 的组织方式：`Terminal.fromNodeEnv()` + 顶层注册多个 service
- 优先复用现有 vendor 的历史数据实现/映射（如 OKX/BINANCE 的 `public-data/*`、BITGET/HYPERLIQUID 的 `services/markets/*`）来实现 `fetchPage`
- 明确每个 vendor 支持的 `product_id_prefix`、OHLC `duration_list`、以及 `direction`（必要时同一 vendor 提供多个 prefix/方向的 service）
- 对 page-only / one-page 的历史接口：本次统一接入 ingest contract（page-only 用“按 time 二分定位 page”的适配层；one-page 先补齐 time range/offset 的 API wrapper 使其可翻页）

## 范围

- libraries/exchange/src/ohlc.ts（接口参考）
- libraries/exchange/src/interest_rate.ts（接口参考）
- apps/vendor-aster/src/services/ohlc-service.ts（新增）
- apps/vendor-aster/src/services/interest-rate-service.ts（新增）
- apps/vendor-binance/src/services/ohlc-service.ts（新增）
- apps/vendor-binance/src/services/interest-rate-service.ts（新增）
- apps/vendor-bitget/src/services/ohlc-service.ts（新增）
- apps/vendor-bitget/src/services/interest-rate-service.ts（新增）
- apps/vendor-gate/src/services/ohlc-service.ts（新增）
- apps/vendor-gate/src/services/interest-rate-service.ts（新增）
- apps/vendor-huobi/src/services/ohlc-service.ts（新增）
- apps/vendor-huobi/src/services/interest-rate-service.ts（新增）
- apps/vendor-hyperliquid/src/services/ohlc-service.ts（新增）
- apps/vendor-hyperliquid/src/services/interest-rate-service.ts（新增）
- apps/vendor-okx/src/services/ohlc-service.ts（新增）
- apps/vendor-okx/src/services/interest-rate-service.ts（新增）
- apps/vendor-_/src/api/_（如需补齐 OHLC/利率历史接口 wrapper）

## 1. 接口语义回顾（以 `@yuants/exchange` 当前实现为准）

### 1.1 `IngestOHLC`（`provideOHLCService`）

- service：`IngestOHLC`
- metadata（由 VEX 从 schema 解析）：
  - `product_id_prefix: string`：该服务覆盖的 `product_id` 前缀（schema 用 pattern 表达）
  - `duration_list: string[]`：允许的 RFC3339 duration 列表（schema 用 enum 表达）
  - `direction: 'backward' | 'forward'`：该服务固定支持的翻页方向（schema 用 const 表达）
- request（Vendor 接收，VEX 发出）：
  - `product_id: string`（pattern：`^${product_id_prefix}`）
  - `duration: string`（enum：`duration_list`）
  - `direction: const`（必须等于 metadata.direction）
  - `time: number`（毫秒级 Unix 时间戳，必传）
- **time/direction 语义（vendor 侧实现需遵守）**：
  - `direction='backward'`：`time` 语义等价于“结束时间 ended_at”，取 `time` 之前（不含 time 点）的更早数据
  - `direction='forward'`：`time` 语义等价于“开始时间 started_at”，取 `time` 之后（含/不含由交易所决定，但写库冲突键允许少量重叠）
- `series_id`：由 `@yuants/exchange` 统一计算：`encodePath(product_id, duration)`（vendor 的 `fetchPage` 会收到该值）
- `fetchPage`（vendor 实现）：
  - 入参：`{ product_id, duration, direction, time, series_id }`
  - 返回：`IOHLC[]`（至少要包含可写库字段：`created_at/closed_at/open/high/low/close/volume`；其余字段可填默认）
- 写库行为（vendor 不需要管）：
  - 写 `ohlc` 表：conflict keys = `(series_id, created_at)`
  - 同时写 `series_data_range`：`(series_id, table_name='ohlc', start_time, end_time)`（幂等）
- response：
  - 成功：`{ code: 0, data: { wrote_count, range? } }`
  - 失败：`{ code: 1, message }`（vendor `fetchPage` 抛错会被捕获并返回失败）

### 1.2 `IngestInterestRate`（`provideInterestRateService`）

- service：`IngestInterestRate`
- metadata：
  - `product_id_prefix: string`
  - `direction: 'backward' | 'forward'`
- request：
  - `product_id: string`（pattern：`^${product_id_prefix}`）
  - `direction: const`
  - `time: number`（毫秒级 Unix 时间戳，必传）
- `series_id`：`encodePath(product_id)`
- `fetchPage`：
  - 入参：`{ product_id, direction, time, series_id }`
  - 返回：`IInterestRate[]`（至少：`created_at/long_rate/short_rate/settlement_price`）
- 写库行为：
  - 写 `interest_rate` 表：conflict keys = `(series_id, created_at)`
  - 同时写 `series_data_range`：`(series_id, table_name='interest_rate', start_time, end_time)`

## 2. 代码落点与启动方式（可直接照着写）

### 2.1 每个 vendor 新增文件（顶层 side-effect 注册）

每个 vendor（ASTER/BINANCE/BITGET/GATE/HTX/HYPERLIQUID/OKX）新增：

- `src/services/ohlc-service.ts`
- `src/services/interest-rate-service.ts`

文件风格参考 `src/services/quotes.ts`：

- 顶层 `const terminal = Terminal.fromNodeEnv();`
- 顶层多次调用 `provideOHLCService(...)` / `provideInterestRateService(...)` 注册多个 prefix（如需）
- 不导出任何东西（保持与 quotes 一致：文件被 import 即完成注册）

### 2.2 每个 vendor 的启动入口需要显式 import 新文件

在各 vendor `src/index.ts` 增加：

- `import './services/ohlc-service';`
- `import './services/interest-rate-service';`

（否则文件不会执行，服务不会注册）

### 2.3 推荐的最小代码骨架（每个 service 文件）

`ohlc-service.ts`：

1. `terminal` 初始化
2. `DURATION_TO_*` 映射（RFC3339 duration -> 交易所 interval/bar/granularity）
3. `const SUPPORTED_DURATIONS = Object.keys(DURATION_TO_*)`
4. helper：
   - `normalizeTimeMs(time: number): number`（`Number.isFinite` 校验）
   - `decodeProductId(product_id: string)`（`decodePath` + 结构校验）
5. `provideOHLCService(terminal, { product_id_prefix, duration_list, direction }, fetchPage)`

`interest-rate-service.ts`：

同上，只是无 `duration_list`。

### 2.4 page-only 按 time 定位页码（适配层设计，BITGET/HTX 等复用）

适用前提：

- 接口是 page-only：请求入参包含 `page`/`cursor`（页码），返回结果按时间单调排序（通常时间降序），并能从结果中提取时间字段（如 funding_time / fundingRateTimestamp）。
- 如果接口能返回 `total_page`（HTX 有），直接二分；否则用指数探测找到上界再二分。

目标：把 ingest contract 的 `time` 映射到“应该拉取哪一页”，并保证 VEX 推进稳定：

- `direction='backward'`：返回的数据不包含 `created_at >= req.time`
- 期望 `range.end_time < req.time`（这样 VEX 用 range 推进能稳定向过去走）

建议实现为 vendor 内部 helper（不对外导出）：

- `fetchPageRaw(page: number): Promise<RawItem[]>`
- `extractTimeMs(item: RawItem): number`
- `getPageRangeMs(items: RawItem[]): { minMs: number; maxMs: number } | undefined`
  - 对“时间降序”的常见返回：`maxMs = time(items[0])`，`minMs = time(items[items.length - 1])`
- `locatePageByTime(targetMs: number): Promise<number>`
  - 若有 `total_page`：`lo=1, hi=total_page` 二分
  - 否则：指数探测 `hi`（1,2,4,8...）直到出现 `range.minMs <= targetMs` 或页为空；再在 `(hi/2, hi)` 内二分
  - 二分判定（按时间降序 + page 越大越旧的假设）：
    - 若 `targetMs > range.maxMs`：目标比该页还新，应向更小页（更靠近 1）找
    - 若 `targetMs < range.minMs`：目标比该页还旧，应向更大页找
    - 否则目标落在该页覆盖区间内，返回该页
- 返回页码后，再拉该页并做过滤：
  - backward：只保留 `time(item) < targetMs`（严格小于，避免包含 time 点）
  - forward：只保留 `time(item) >= targetMs`

缓存建议（非必须，但建议做）：

- `Map<string /* product_id */, { lastPage?: number; totalPage?: number }>`
- 用于减少重复二分（例如下一次请求的 time 接近上一页时可从邻近页开始探测）

## 3. Vendor 详细设计（能力矩阵 + fetchPage 映射）

> 注：下面所有 `product_id_prefix` 必须与你当前 quotes/product 的编码一致（即 `encodePath(EXCHANGE, ...)` 产生的前缀）。

### 3.1 OKX

#### 3.1.1 OHLC（建议 direction = `backward`）

- 注册 2~3 个 prefix（按你希望的覆盖范围）：
  - `OKX/SWAP/`
  - `OKX/SPOT/`
  - `OKX/MARGIN/`（可选：如果你认为 MARGIN 也要有 OHLC）
- `duration_list`：复用 OKX bar 映射的 key（当前在 `apps/vendor-okx/src/public-data/ohlc.ts`）
- time 映射：
  - `ended_at_ms = req.time`
  - OKX 参数：`after = ended_at_ms`（接口行为：不含 after 时间点）
- page size：建议先沿用历史实现的 `limit=300` 或 `100`（固定值；因为 schema 目前不带 limit）

fetchPage 伪代码（关键步骤）：

- `const [, instType, instId] = decodePath(req.product_id)`
- `const bar = DURATION_TO_OKX_BAR_TYPE[req.duration]`（不存在则 throw）
- `const offset = convertDurationToOffset(req.duration)`
- `const res = await getHistoryCandles({ instId, bar, after: String(ended_at_ms), limit: '300' })`
- map 为 `IOHLC[]`：
  - `created_at = formatTime(+x[0])`
  - `closed_at = formatTime(+x[0] + offset)`
  - `open/high/low/close/volume` 按 OKX 返回映射
  - `open_interest: '0'`
  - `series_id = req.series_id`（或交给上游 normalize 覆盖）

#### 3.1.2 InterestRate（建议 direction = `backward`）

- 注册 2 个 prefix：
  - `OKX/SWAP/`（资金费率）
  - `OKX/MARGIN/`（杠杆借贷利率）
- time 映射：
  - `ended_at_ms = req.time`
  - SWAP：`after = ended_at_ms`
  - MARGIN：base/quote 各调用一次 `getLendingRateHistory({ ccy, after })`

### 3.2 BINANCE

#### 3.2.1 OHLC（建议 direction = `backward`）

- prefix：
  - `BINANCE/USDT-FUTURE/`
  - `BINANCE/SPOT/`
  - `BINANCE/MARGIN/`（走 spot klines）
- `duration_list`：复用 `apps/vendor-binance/src/public-data/ohlc.ts` 的 `DURATION_TO_BINANCE_INTERVAL` keys
- time 映射：`endTime = req.time`
- page size：`limit=1000`（Binance klines 支持 1000）
- 注意点（实现时必须统一）：当前 `public-data/ohlc.ts` 用 `instType === 'usdt-future'` 判别 baseUrl，但 quotes/product 使用 `USDT-FUTURE`，实现时应统一为同一大小写（建议以 product_id 的编码为准：`USDT-FUTURE`）。

#### 3.2.2 InterestRate（两种可选设计，需要你 review）

**方案 B1（保持现状，direction = `forward`，time 视为 startTime）**：

- prefix：
  - `BINANCE/USDT-FUTURE/`
  - `BINANCE/MARGIN/`
- time 映射：`startTime = req.time`
- window：需要固定一个“页大小”（因为 schema 无 limit）
  - USDT-FUTURE：`endTime = startTime + WINDOW_MS`（WINDOW_MS 可以按 1000 条记录估算）
  - MARGIN：同理

**方案 B2（统一为 backward，direction = `backward`，time 视为 endTime）**：

- time 映射：`endTime = req.time`，`startTime = endTime - WINDOW_MS`
- 风险：需要确认 Binance 对该接口的排序/包含关系；否则 VEX 的推进可能出现重叠过大或推进不稳定。

> 默认推荐：B1（最少不确定性，复用现有实现的“从 startTime 推进”语义）。

> [REVIEW] 不需要在各个 vendor 统一 direction，vendor 按最自然的方式实现就行
>
> [RESPONSE] 同 R4，已接受并会在 plan 中去掉“统一 direction”的任何暗示，保留各 vendor 自然方向。
> [STATUS:resolved]

### 3.3 BITGET

#### 3.3.1 OHLC（建议 direction = `backward`）

- prefix：
  - `BITGET/USDT-FUTURES/`
  - `BITGET/COIN-FUTURES/`
  - `BITGET/SPOT/`
- `duration_list`：复用 `apps/vendor-bitget/src/services/markets/ohlc.ts` 的 `mapDurationToGranularity` 支持集合
- time 映射：`endTime = req.time` -> `getHistoryCandles({ endTime: String(endTime), limit: '100' })`
- mapping：同现有实现（`formatTime(+v[0])` + `convertDurationToOffset(duration)`）

#### 3.3.2 InterestRate（page-only + current-only：本次接入，采用 page 二分定位）

- USDT-FUTURES 资金费率历史：page-only（cursor=page），无法直接按 time 定位
- SPOT 借贷利率：只有“当前值”，无历史

实现策略（对应 review 选择 C）：

- direction：`backward`
- time：`req.time` 视为 ended_at
- 用 `2.4 page-only 按 time 定位页码` 的适配层定位页码，再拉取该页并过滤 `created_at < req.time`
- SPOT 借贷利率：
  - 仅“当前值”，无历史；实现上会按“最新一页”输出（range≈now），供 VEX 至少能定期刷新当前借贷利率

> [REVIEW] 通过 vendor 侧扫描页码（可以使用二分查找）逼近目标 time（选 C）
>
> [RESPONSE] 接受：BITGET/HTX（以及其他 page-only）采用策略 C：vendor 侧通过（指数探测 +）二分查找扫描页码逼近目标 time，再返回目标页数据。接下来我会把 BITGET/HTX 的小节改成“固定采用 C”，并补上二分查找适配层的具体接口与边界条件。
> [STATUS:resolved]

### 3.4 HYPERLIQUID

#### 3.4.1 OHLC（建议 direction = `backward`，用窗口控制一页大小）

- prefix：
  - `HYPERLIQUID/PERPETUAL/`
  - `HYPERLIQUID/SPOT/`（与 PERPETUAL 共用同一个 candle snapshot 端点）
- `duration_list`：`apps/vendor-hyperliquid/src/services/markets/ohlc.ts` 的 `DURATION_TO_HYPERLIQUID_INTERVAL` keys
- time 映射：`endTime = req.time`
- window：`startTime = endTime - DEFAULT_BAR_COUNT * period_ms`
  - `period_ms` 来自 `DURATION_TO_PERIOD_IN_SEC[duration] * 1000`
  - `DEFAULT_BAR_COUNT` 建议先 500~2000（固定常量）
- 调用：`getCandleSnapshot({ req: { coin, interval, startTime, endTime } })`

#### 3.4.2 InterestRate（建议 direction = `backward`，用窗口）

- prefix：`HYPERLIQUID/PERPETUAL/`
- time 映射：`endTime = req.time`，`startTime = endTime - WINDOW_MS`
- 调用：`getHistoricalFundingRates({ coin, startTime, endTime })`

### 3.5 ASTER

#### 3.5.1 InterestRate（建议 direction = `forward`）

- prefix：`ASTER/PERP/`
- time 映射：`startTime = req.time`，`endTime = startTime + WINDOW_MS`
- 调用：复用 `apps/vendor-aster/src/services/markets/interest_rate.ts` 的 `getFApiV1FundingRate` 映射

#### 3.5.2 OHLC（已接入：spot/perp klines）

已落地：

- prefix：
  - `ASTER/PERP/`
  - `ASTER/SPOT/`
- `duration_list`：与 Binance 风格一致的 interval key（见 `apps/vendor-aster/src/services/ohlc-service.ts`）
- time 映射：`endTime = req.time`（毫秒）
- API：
  - PERP：`getFApiV1Klines({ symbol, interval, endTime, limit })`
  - SPOT：`getApiV1Klines({ symbol, interval, endTime, limit })`

### 3.6 GATE

#### 3.6.1 InterestRate（one-page：先补齐 time range/offset wrapper 后接入）

- 现有 wrapper：`getFutureFundingRate(settle, { contract, limit })`（无 time/cursor）
- 本任务会先补齐一个“可按时间翻页”的 wrapper（优先 time range，其次 offset/page），使其满足 ingest contract 的 `time` 语义：
  - 若 Gate 提供 `from/to`：direction=backward 时用 `to=req.time`，`from=to-WINDOW` 拉取一页
  - 若 Gate 只提供 offset：将 offset 视为页码，用 `2.4` 的二分定位策略
  - 若最终确认 Gate 端点确实不可翻页：会在实现前把降级策略写入本 plan（不会默默忽略 time）

#### 3.6.2 OHLC（已接入：futures/spot candlesticks）

- prefix：
  - `GATE/FUTURE/`
  - `GATE/SPOT/`
- time 映射：`to = floor(req.time / 1000)`（秒）
- API：
  - futures：`getFuturesCandlesticks('usdt', { contract, interval, to, limit })`
  - spot：`getSpotCandlesticks({ currency_pair, interval, to, limit })`
- 注意：已按文档修正 API wrapper 的返回类型（spot 为 tuple；futures 为 object）

### 3.7 HTX（Huobi）

#### 3.7.1 InterestRate（page-only：本次接入，采用 page 二分定位）

- 现有：`getSwapHistoricalFundingRate({ page_index })` page-only（时间降序）
- direction：`backward`
- 用 `2.4 page-only 按 time 定位页码` 的适配层：
  - HTX 返回 `total_page`，可直接二分定位页码
  - backward 过滤：只保留 `created_at < req.time`

#### 3.7.2 OHLC（已接入：SWAP/Spot Kline）

- prefix：
  - `HTX/SWAP/`
  - `HTX/SPOT/`
- time 映射：
  - `to = floor(req.time / 1000)`（秒）
  - `from = floor((req.time - DEFAULT_BAR_COUNT * duration_ms) / 1000)`（秒）
- API：
  - SWAP：`getSwapHistoryKline({ contract_code, period, size, from, to })`
  - SPOT：`getSpotHistoryKline({ symbol, period, size, from, to })`

## 4. 错误处理与数据清洗规范（实现时必须一致）

- `req.time` 必须为有限 `number`（毫秒级 Unix 时间戳），否则直接 throw（让 `provide*Service` 返回 `code=1`）
- `decodePath(product_id)` 的段数/instType 必须校验，不满足则 throw
- duration 必须在映射表内，否则 throw
- 所有数值字段统一转成字符串（沿用现有 vendor 实现风格）
- OHLC：
  - `closed_at` 必须填（用 `convertDurationToOffset(duration)` 或交易所返回）
  - `open_interest` 没有就填 `'0'`
- InterestRate：
  - `settlement_price` 没有就填 `''`
  - long/short 方向沿用既有约定：资金费率通常 `long_rate = -fundingRate`, `short_rate = fundingRate`

## 5. 验证方案（review 后按这个跑）

1. TypeScript 构建（每个 vendor）：`pnpm -w --filter @yuants/vendor-xxx build`（或 rush/heft 对应命令）
2. 启动 vendor（dev）：`pnpm -w --filter @yuants/vendor-xxx dev`
3. 手工验证 service schema（最小）：
   - 从终端的 service registry 取 `IngestOHLC`/`IngestInterestRate` 的 schema
   - 调用 `parseOHLCServiceMetadataFromSchema`/`parseInterestRateServiceMetadataFromSchema`，确认能解析出期望的 `product_id_prefix/duration_list/direction`

## 6. 分批实现建议（你 review 通过后我会按这个顺序写代码）

1. 先做“无争议且 time-based 的部分”：
   - OKX：OHLC + InterestRate（backward）
   - BITGET：OHLC（backward）
   - HYPERLIQUID：OHLC（backward，window）+ InterestRate（backward，window）
2. 再做 Binance（InterestRate 先按默认 B1 实现；并处理 instType 大小写一致性）
3. 最后补剩余缺口：
   - page-only / one-page 的 InterestRate（按本 plan：page-only 用二分定位；one-page 先补齐可翻页 wrapper）

## 阶段概览

1. **调研** - 2 个任务
2. **设计** - 1 个任务
3. **实现** - 2 个任务
4. **验证** - 1 个任务

---

_创建于: 2025-12-20 | 最后更新: 2025-12-20_
