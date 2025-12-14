# implement-quote-service

## 目标

为所有厂商实现报价服务适配，遵循 `provideQuoteService`（`GetQuotes`）接口

## 背景与动机（为什么要做）

- 目前多数 vendor 已经具备「行情采集 → SQL 写入 / quote Channel」链路（例如各 vendor 的 `services/markets/quote.ts`），但 `@yuants/exchange` 还定义了一套统一 RPC：`GetQuotes`（通过 `provideQuoteService` 暴露）。
- 本任务要补齐的是：让每个 vendor 都能对外提供 `GetQuotes`，上游可以用统一协议批量拉取报价字段（而不是直接依赖 SQL 或 vendor 私有接口）。
- `apps/vendor-gate/src/services/quotes.ts` 是本仓库的现成参考实现：按 `product_id_prefix` 拆分多个 service，内部调用 public API 并映射为 `{ product_id, updated_at, ...fields }[]`。

## 要点

- 遵循 `@yuants/exchange` 的 `provideQuoteService` 契约与 schema 约束（尤其是 `product_id_prefix` 与 `fields const`）
- 参考 vendor-gate 的 `quotes.ts`（不是 markets/quote.ts）作为模板
- 代码保持简洁、符合仓库风格：不引入多余抽象，不写大而全的缓存层
- 覆盖厂商：OKX、Binance、Aster、Hyperliquid、Bitget、HTX(Huobi)
- 本轮新增代码前：先把方案与风险写进 LegionMind 文档，便于你 review

## 非目标（Non-goals）

- 不重构各 vendor 现有行情采集管线（SQL/Channel 继续保留），本任务只补齐 `GetQuotes` 适配。
- 不引入新的 WS 合流框架；优先复用现有 public API（REST/WS helper），本轮以 REST 拉取为主。
- 不改数据库 schema。

## 范围（Scope）

- `libraries/exchange/src/quote.ts`：`provideQuoteService` 契约实现（供对照）
- `libraries/exchange/src/types.ts`：`IQuoteServiceRequestByVEX` / `IQuoteUpdateAction` / `IQuoteField`
- `apps/vendor-gate/src/services/quotes.ts`：参考实现（对照模板）
- 目标 vendor（新增 `quotes.ts` 并在入口导入）：
  - `apps/vendor-okx`
  - `apps/vendor-binance`
  - `apps/vendor-aster`
  - `apps/vendor-hyperliquid`
  - `apps/vendor-bitget`
  - `apps/vendor-huobi`

---

## 阶段规划（供 Review 的路线图）

> 说明：每个阶段都有“完成定义”，避免只写一句话导致无法 review。

### 阶段 1：需求摸底（Discovery）

**目标**：

- 明确 `provideQuoteService` 的 schema 约束与返回结构；
- 识别可复用的 vendor 模板与落地位置。

**完成定义（Success Criteria）**：

- 写清楚 `GetQuotes` 的请求/响应契约、`updated_at` 单位、字段类型与限制；
- 确认 product_id 的对外约定（前缀、`encodePath` 规则）；
- 记录关键参考文件到 `context.md` 的“关键文件”列表。

### 阶段 2：方案设计（Design）

**目标**：

- 为每个 vendor 明确：`product_id_prefix`、支持字段集合、数据来源与缺失字段策略。

**完成定义（Success Criteria）**：

- `context.md` 中有按 vendor 的方案清单（用于对照最终实现）；
- 明确风险与待确认点（例如：某 API 返回结构/映射关系）。

### 阶段 3：开发落地（Implementation）

**目标**：

- 为每个 vendor 新增 `GetQuotes` 服务入口（通常为 `src/services/quotes.ts`），并在 `src/index.ts` 中导入；
- 每个 vendor 至少提供 1 个 `provideQuoteService` 实例（按 prefix 拆分），并按 `req.product_ids` 做过滤以减少返回量；
- 列出并执行最小可行的类型检查命令（tsc），将结果记录到 `context.md`。

**完成定义（Success Criteria）**：

- 覆盖 vendors：OKX / Binance / Aster / Hyperliquid / Bitget / HTX(Huobi)
- 所有新增文件路径与命名符合各 vendor 的目录风格；
- `product_id_prefix` 与 `encodePath(...)` 生成的 `product_id` 前缀严格一致；
- `metadata.fields` 只包含该 vendor 能稳定提供的字段（不瞎填），并且每条返回都带 `updated_at`（ms）。

**建议验证命令（按修改 vendor 选择执行）**：

- `npx tsc --noEmit --project apps/vendor-okx/tsconfig.json`
- `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`
- `npx tsc --noEmit --project apps/vendor-aster/tsconfig.json`
- `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`
- `npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json`
- `npx tsc --noEmit --project apps/vendor-huobi/tsconfig.json`

---

## 契约对照（review 时重点看这一节）

### provideQuoteService（GetQuotes）契约摘要

- Service：`GetQuotes`
- 请求（VEX → Vendor）：`IQuoteServiceRequestByVEX`
  - `product_ids: string[]`：必须匹配 `metadata.product_id_prefix`（schema 用正则前缀约束）
  - `fields: IQuoteField[]`：schema 中是 `const = metadata.fields.sort()`，调用方基本只能请求我们声明过的字段集合
- 对于“单次只能按 symbol/product 查询”的上游 API：对应的 `provideQuoteService` 必须设置 `max_products_per_request = 1`，避免上游误用导致放大请求。
- 响应（Vendor → VEX）：`IQuoteUpdateAction`
  - 结构：`{ [product_id]: { [field]: [value: string, updated_at: number] } }`
  - `updated_at`：毫秒时间戳（`Date.now()` 或 API 返回时间转换）
- 字段类型：返回的各字段值统一用 string（与 `IQuote` 表结构一致），不要返回 number/boolean。

### Product ID 约定

- 对外 product_id 统一使用“全局路径”：`encodePath(<DATASOURCE>, <INST_TYPE>, <INST_ID>)`
  - 例：`GATE/FUTURE/BTC_USDT`、`BINANCE/SPOT/BTCUSDT`
- `metadata.product_id_prefix` 必须是该路径的字符串前缀（末尾包含 `/`），例如：`BINANCE/SPOT/`
- 备注：个别 vendor（例如 OKX）内部 `quote` 表可能使用 `product_id = SWAP/...` + `datasource_id = OKX` 的拆分存储，但 `GetQuotes` 对外仍以“全局 product_id”提供，内部做映射即可。

---

## 分 vendor 设计（实现前先对齐，避免“写完才发现 prefix 不一致”）

> 实现骨架（所有 vendor 一致）：
>
> - 入口：`src/index.ts` import `./services/quotes`
> - 文件：`src/services/quotes.ts`
> - 按 prefix 拆分多个 `provideQuoteService(...)`
> - `requestFunc(req)`：
>   - 调用 public API 拉取全量数据（tickers / bbo / funding / OI）
>   - 映射到 `{ product_id, updated_at, ...fields }[]`
>   - 按 `req.product_ids` 过滤（减少返回）

### OKX（计划）

- 新增：`apps/vendor-okx/src/services/quotes.ts`
- prefixes：
  - `OKX/SWAP/`：`getMarketTickers({ instType: 'SWAP' })`
  - `OKX/SPOT/`：`getMarketTickers({ instType: 'SPOT' })`
- 字段（先做最小可用）：`last_price` / `bid_price` / `ask_price` / `bid_volume` / `ask_volume`
- `updated_at`：优先 `Number(ticker.ts)`，否则 `Date.now()`
- 风险/备注：遵循“每个上游 API 调用对应一个 `provideQuoteService`”，因此 OI 用单独的 `provideQuoteService`（数据源 `getOpenInterest`），不做 join 合并。

### BINANCE（计划）

- 新增：`apps/vendor-binance/src/services/quotes.ts`
- prefixes：
  - `BINANCE/USDT-FUTURE/`
    - funding/mark/nextFundingTime：`getFuturePremiumIndex({})`
    - bid/ask/qty：`getFutureBookTicker({})`
    - open interest：如要支持需 `getFutureOpenInterest({ symbol })`（按 symbol 单独拉，成本高；本轮倾向先不暴露）
  - `BINANCE/SPOT/`
    - bid/ask/qty：`getSpotBookTicker({})`
    - last_price：`getSpotTickerPrice({})`（如不想引入额外接口，可先不提供 last_price）
- `updated_at`：futures 用 API 的 `time`，spot 用 `Date.now()`

### ASTER（计划）

- 新增：`apps/vendor-aster/src/services/quotes.ts`
- prefix：
  - `ASTER/PERP/`：复用现有 public-api：
    - last：`getFApiV1TickerPrice({})`
    - funding：`getFApiV1PremiumIndex({})`
    - open interest：`getFApiV1OpenInterest({ symbol })`（建议复用现有实现中的 cache/轮询策略，或先做只支持 last+funding）
- `updated_at`：`Date.now()`（Aster 多数接口不稳定返回服务器时间）

### HYPERLIQUID（已实现，待确认映射）

- 已新增：`apps/vendor-hyperliquid/src/services/quotes.ts`
- prefix：`HYPERLIQUID/PERPETUAL/`
- 数据源：`getAllMids()` + `getMetaAndAssetCtxs()`
- 风险：需要确认 `meta.universe[i].name` 与 `assetCtxs[i]` 的映射方式；不确认前不要继续复制该逻辑到其他地方。

### BITGET（已实现）

- 已新增：`apps/vendor-bitget/src/services/quotes.ts`
- prefixes：
  - `BITGET/USDT-FUTURES/`：`getTickers({ category: 'USDT-FUTURES' })`
  - `BITGET/COIN-FUTURES/`：`getTickers({ category: 'COIN-FUTURES' })`
- 字段：`last_price` / `bid_price` / `ask_price` / `bid_volume` / `ask_volume` / `open_interest` / `interest_rate_long` / `interest_rate_short`

### HTX（Huobi）（计划）

- 新增：`apps/vendor-huobi/src/services/quotes.ts`
- prefixes：
  - `HTX/SWAP/`：`getSwapMarketBbo` + `getSwapMarketTrade` + `getSwapBatchFundingRate` + `getSwapOpenInterest`
  - `HTX/SPOT/`：`getSpotMarketTickers`
- 备注：现货无 open_interest，若 schema 需要则返回 `'0'`；资金费率字段仅 swap 有意义。

---

_创建于: 2025-12-14 | 最后更新: 2025-12-14_
