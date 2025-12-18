# task-vex-queryquote-migrate-sql - 上下文

## 会话进展 (2025-12-17)

### ✅ 已完成

- 盘点并确认全仓真实 `from quote` 调用点（排除 `docs/reports/**`），整理迁移清单（trade-copier / virtual-exchange / vendor-huobi + 1 个脚本）。
- 复核 VEX 现有能力：`apps/virtual-exchange/src/quote/service.ts` 已有 SWR 队列与 `VEX/QueryQuotes`、`VEX/QuoteUpdateQueueStatus`，可作为本任务改造的基础。
- 在 `apps/virtual-exchange/src/quote/service.ts` 新增 `VEX/QueryQuote`（best-effort 单品查询，miss+stale 触发后台更新）。
- 迁移 `apps/trade-copier/**`、`apps/virtual-exchange/src/position.ts`、`apps/vendor-huobi/**`：移除直接 SQL 读取 `quote` 表，统一改为调用 `VEX/QueryQuote`。
- 将 `queryQuoteByVex` 抽到 `@yuants/data-quote`（`libraries/data-quote/src/query-quote.ts`），并删除 `apps/trade-copier/src/query-quote.ts`，各调用方统一从库引用。
- 修复 `apps/vendor-huobi/src/services/accounts/super-margin.ts` 里 `quoteCache.query(currencyData.currency)` 的参数错误（改为传 `product_id`）。
- 最小验证：prettier；构建通过 `libraries/data-quote`、`apps/trade-copier`（含 tests）、`apps/virtual-exchange`（含 tests + api-extractor）、`apps/vendor-huobi`。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

- 暂无阻塞；已确认 `VEX/QueryQuote` 采用 `miss + stale` 触发后台更新，需重点关注队列积压与上游压力。

---

## 关键文件

- `apps/virtual-exchange/src/quote/service.ts`：`VEX/QueryQuotes` + `VEX/QueryQuote` + 后台更新队列（SWR）
- `libraries/data-quote/src/query-quote.ts`：统一的 `queryQuoteByVex` 调用封装
- `apps/trade-copier/src/BBO_MAKER.ts`：通过 `queryQuoteByVex` 取 `bid_price/ask_price`，数据不全则直接 return
- `apps/trade-copier/src/BBO_MAKER_BY_DIRECTION.ts`：同上
- `apps/trade-copier/src/experimental/context.ts`：通过 `queryQuoteByVex` 取行情，适配为 `IQuote`
- `apps/virtual-exchange/src/position.ts`：position 补全逻辑改为 best-effort `queryQuoteByVex`
- `apps/vendor-huobi/src/services/market-data/quote.ts`：`quoteCache` 改为 `queryQuoteByVex`

---

## 关键决策

| 决策                                                                        | 原因                                                   | 替代方案                          | 日期       |
| --------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------- | ---------- |
| `VEX/QueryQuote` 的更新触发条件 = `miss + stale`                            | 与 `updated_at` 的鲜度下界语义一致，且你明确要求       | miss-only（更稳）                 | 2025-12-17 |
| trade-copier 不在单次调用内重试                                             | runStrategy 外层会持续 repeat；避免 busy-wait/双重重试 | 在单次函数内循环 sleep 重试       | 2025-12-17 |
| `VEX/QueryQuote.req.product_id` 传真实 product_id                           | 迁移简单，不引入额外映射逻辑                           | 传 productKey 两段式并由 VEX 解码 | 2025-12-17 |
| `apps/vendor-huobi/**` 纳入迁移；`.c1-cellar/rolling-limit-order.ts` 不迁移 | 你明确指示                                             | 将脚本也迁移 / huobi 不迁移       | 2025-12-17 |
| `queryQuoteByVex` 抽到 `@yuants/data-quote`                                 | 统一复用，避免 apps 各自实现与漂移                     | 继续放在 app 内（局部工具）       | 2025-12-18 |

---

## 快速交接

**下次继续从这里开始：**

1. 联调环境观察 `VEX/QuoteUpdateQueueStatus`：确认在 trade-copier `updated_at=Date.now()` 场景下不会长期积压（必要时再做节流/合并策略）。
2. 若 vendor-huobi 在未启动 VEX 时需要降级：考虑把 `quoteCache` 的异常处理改为“直接返回 undefined + 日志节流”（当前已 catch 并返回 undefined）。
3. 后续若有其它模块需要读取报价：优先直接复用 `@yuants/data-quote` 的 `queryQuoteByVex`（避免再写一份 VEX 调用封装）。

**注意事项：**

- trade-copier 每次 `updated_at=Date.now()` 会持续触发 `stale`，因此 `VEX/QueryQuote` 会频繁 enqueue；当前依赖队列串行 + 外层自然重试来控制压力。

---

_最后更新: 2025-12-18 00:50 by Codex_
