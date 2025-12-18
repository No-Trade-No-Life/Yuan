# task-vex-queryquote-migrate-sql

## 目标

将仓库内直接 SQL 查询 `quote` 表的读取路径替换为 `VEX/QueryQuote`（trade-copier 每次传 `updated_at=Date.now()` 且在无数据时重试至有数据）。

## 参考前置任务（已完成）

- `task-vex-quote-routing`：VEX 报价上游发现 + 路由（prefix + fields 倒排 + 交集）
- `task-vex-quote-upstream-refactor`：将上游补全拆分为 registry/router/executor，VEX 侧集中治理 in-flight/并发/LB
- `task-vex-queryquotes-swr`：`apps/virtual-exchange/src/quote/service.ts` 已实现 SWR 队列（同步返回缓存、后台补全）

本任务的核心：让“读 quote”的入口收敛到 VEX（而不是每个业务各写一段 SQL）。

## 要点

- 盘点所有 `from quote` 的真实调用点（排除 docs/reports）并标注所需字段/容错策略
- 定义并落盘 `VEX/QueryQuote` 的请求/响应/错误语义（与现有 `VEX/QueryQuotes` 的 strict 语义区分）
- 按调用方迁移：trade-copier 强实时（`updated_at=Date.now()` + 数据不全直接 return，由外层下一轮重试），其余调用方以 best-effort 为主
- 补充最小观测/验证步骤：确保不会因 miss 导致无穷异常或打爆上游队列，并能用现有 `VEX/QuoteUpdateQueueStatus` 排障

## 现状（供 review）

VEX 侧当前已经存在：

- `VEX/QueryQuotes`：返回最新缓存；对 **miss** 抛 `VEX_QUOTE_FRESHNESS_NOT_SATISFIED`；对 **stale** 不抛错但会入队触发后台更新
- `VEX/QuoteUpdateQueueStatus`：可观测后台补全队列状态

因此本任务的 `VEX/QueryQuote` 更像是“单品 best-effort 入口”，用于替换各处的“select \* from quote ...”读取路径。

## `from quote` 调用点清单（排除 `docs/reports/**`）

| 调用点                                                | 当前 SQL                                                     | 主要用到字段                                                                            | 缺数据容错期望                                            |
| ----------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `apps/trade-copier/src/BBO_MAKER.ts`                  | `select * from quote where product_id=? and datasource_id=?` | `bid_price`/`ask_price`（建议再带 `last_price` 兜底）                                   | 数据不全则直接 return，由外层下一轮自然重试               |
| `apps/trade-copier/src/BBO_MAKER_BY_DIRECTION.ts`     | 同上                                                         | 同上                                                                                    | 同上                                                      |
| `apps/trade-copier/src/experimental/context.ts`       | 同上                                                         | 同上                                                                                    | 同上                                                      |
| `apps/virtual-exchange/src/position.ts`               | `select * from quote where product_id=?`                     | `ask_price`/`bid_price`/`last_price` + `interest_rate_*` + `interest_rate_*_settled_at` | **允许缺**（缺 quote 时只是不补齐派生字段，不应整体失败） |
| `apps/vendor-huobi/src/services/market-data/quote.ts` | `select * from quote where product_id=?`（`quoteCache`）     | 被 `accounts/spot.ts`、`accounts/super-margin.ts` 用到 `ask_price`                      | ⚠️ 需要确认是否迁移（可能引入 vendor→VEX 依赖/循环）      |

另外：`.c1-cellar/rolling-limit-order.ts` 也有 `from quote`（脚本用途，是否纳入迁移取决于你）。

> [REVIEW] 不要迁移`.c1-cellar/rolling-limit-order.ts`这个脚本，huobi 那个要迁移。
>
> [RESPONSE] 确认：`.c1-cellar/rolling-limit-order.ts` 不纳入本任务迁移；`apps/vendor-huobi/**` 的 quote 读取路径纳入本任务迁移范围。后续我会在 `plan.md`/`tasks.md` 的 scope 与迁移矩阵中同步这一点。
> [STATUS:resolved]

## 设计草案：`VEX/QueryQuote`（待你确认）

### 1) 服务签名

- 服务名：`VEX/QueryQuote`
- req：
  - `product_id: string`
  - `fields: IQuoteKey[]`
  - `updated_at: number`
- res：
  - `data: Partial<Record<IQuoteKey, [value: string, updated_at: number]>>`

### 2) 语义

- 同步总是返回当前缓存里“能拿到的最新 tuple”（允许 stale；允许缺字段 -> 缺字段就不出现在 `data` 里）
- 只要存在 `miss`（或你同意的话也包括 `stale`），就入队触发后台更新（复用 `task-vex-queryquotes-swr` 的队列实现）
- `VEX/QueryQuote` 本身不抛 `VEX_QUOTE_FRESHNESS_NOT_SATISFIED`（trade-copier 的“直到有数据”通过外层下一轮重试实现）

> [REVIEW:blocking] `VEX/QueryQuote` 触发后台更新的条件你希望是：仅 `miss`，还是 `miss + stale`？  
> 背景：trade-copier 明确要求每次 `updated_at=Date.now()`，如果把 `stale` 也算入更新条件，会让 VEX 几乎每次都触发上游更新（可能显著增加上游压力/队列积压）。
>
> [RESPONSE] 采纳：`VEX/QueryQuote` 的后台更新触发条件选择 `miss + stale`（与 `updated_at` 的“鲜度下界”语义一致）。trade-copier 侧会按你后续说明不做单次函数内 busy-wait 重试，而是数据不全直接 return，交给外层 repeat/下一轮自然重试，以降低队列与上游压力。
> [STATUS:resolved]

> [REVIEW] 后台更新肯定是 miss + stale 触发
>
> [RESPONSE] 收到，已按 `miss + stale` 作为 `VEX/QueryQuote` 的后台更新触发条件落盘（见上一条 blocking review 的响应）。
> [STATUS:resolved]

### 3) trade-copier 侧重试策略（按你要求：直到有数据）

最终采用（按你确认的 runStrategy 语义）：

- “空数据”的定义：至少 `bid_price` 与 `ask_price` 都存在，否则视为无数据
- 单次调用内不循环重试：数据不全则直接 `return`，交给外层 `repeat`/下一轮自然重试

> [REVIEW:blocking] trade-copier 的“直到有数据”是否允许加：最小 sleep（防热循环）与“日志节流”（防刷屏）？  
> 如果不允许，我会按“无 sleep + 每次 error 都 log”实现，但风险较高。
>
> [RESPONSE] 采纳你的澄清：trade-copier 的 runStrategy 场景不在单次函数内重试；当 `VEX/QueryQuote` 返回字段不全/缺关键价时，直接 `return`，由外层 `repeat`/下一轮调用自然重试。这样也就不需要在这里额外加 sleep/backoff（避免双重重试）。
> [STATUS:resolved]

> [REVIEW] 对于 runStrategy 的场景，直接 return 就会被下一次调用重试，所以说如果数据不全，直接 return，不需要在这里重试。
>
> [RESPONSE] 收到。已将 trade-copier 的策略调整为：不在单次调用内循环重试，数据不全直接 return，依赖外层调度下一轮重试。
> [STATUS:resolved]

### 4) `product_id` 约定（非常关键）

当前 trade-copier 的 key 是 `productKey = encodePath(datasource_id, product_id)`，其中 `product_id` 可能本身包含 `/`（例如 `HTX/SPOT/btcusdt`），会被 encodePath 自动转义后再放到 channel key 里。

VEX 侧（GetQuotes provider）普遍用形如 `BINANCE/USDT-FUTURE/BTCUSDT`、`HTX/SPOT/btcusdt` 的 `product_id`。

> [REVIEW:blocking] `VEX/QueryQuote.req.product_id` 你希望传：  
> A) 直接传“真正的 product_id”（可能包含 `/`），例如 `HTX/SPOT/btcusdt` / `BINANCE/USDT-FUTURE/BTCUSDT`（推荐）  
> B) 传 `productKey = encodePath(datasource_id, product_id)`（两段式）由 VEX 再解码/映射  
> 这会影响 trade-copier/position.ts 的迁移方式与是否需要额外映射逻辑。
>
> [RESPONSE] 采纳：`VEX/QueryQuote.req.product_id` 传“真实 product_id”（例如 `HTX/SPOT/btcusdt`）。trade-copier 侧从 `productKey` 做 `decodePath`，取第二段 `product_id` 后调用 VEX。
> [STATUS:resolved]

> [REVIEW] 直接选 A）传真正的 product_id。
>
> [RESPONSE] 收到，已按选项 A（传真实 product_id）落盘，并已在 blocking review 的响应中说明调用侧如何从 `productKey` 提取 product_id。
> [STATUS:resolved]

## 迁移策略（待你确认后再动代码）

1. VEX：新增 `VEX/QueryQuote`（单品 best-effort），复用现有 `quoteState` + 入队机制
2. trade-copier：把 3 处 `requestSQL(from quote)` 改为调用 `VEX/QueryQuote`，并按要求 `updated_at=Date.now()`；若数据不全则直接 return，等待下一轮重试
3. `apps/virtual-exchange/src/position.ts`：从 SQL `quoteCache` 改为走 `VEX/QueryQuote`（缺 quote 不应失败）
4. vendor-huobi：是否迁移取决于你（见下方 review）

> [REVIEW] `apps/vendor-huobi/**` 这块你希望：  
> A) 本任务也迁移（读 quote 统一走 VEX）  
> B) 暂不迁移（避免 vendor→VEX 依赖/循环；后续另开任务用“本地行情流/内存缓存”替代 SQL）
>
> [RESPONSE] 采纳：`apps/vendor-huobi/**` 也纳入本任务迁移，quote 读取统一改为走 `VEX/QueryQuote`。会在 Implementation 前把“vendor→VEX 依赖/潜在环路”作为风险项写入 `context.md` 并在验证步骤中重点关注。
> [STATUS:resolved]

> [REVIEW] 选 A），本任务也迁移。
>
> [RESPONSE] 收到，已按选项 A（vendor-huobi 本任务也迁移）落盘并标记为已决策。
> [STATUS:resolved]

## 范围

- apps/virtual-exchange/src/quote/service.ts
- apps/trade-copier/src/BBO_MAKER.ts
- apps/trade-copier/src/BBO_MAKER_BY_DIRECTION.ts
- apps/trade-copier/src/experimental/context.ts
- apps/virtual-exchange/src/position.ts
- apps/vendor-huobi/src/services/market-data/quote.ts
- apps/vendor-huobi/src/services/accounts/spot.ts
- apps/vendor-huobi/src/services/accounts/super-margin.ts
- libraries/data-quote/src/query-quote.ts
- libraries/data-quote/src/index.ts

## 阶段概览

1. **Discovery** - 1 个任务
2. **Design** - 1 个任务
3. **Implementation** - 2 个任务
4. **Validation** - 1 个任务

---

_创建于: 2025-12-17 | 最后更新: 2025-12-18_
