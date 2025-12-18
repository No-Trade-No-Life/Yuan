# task-vex-queryquote-migrate-sql - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - Validation
**当前任务**: (none)

已初步定位（待你确认是否都要迁移）：

1. `apps/trade-copier/src/BBO_MAKER.ts`：`select * from quote where product_id=? and datasource_id=?`，只用 `bid_price/ask_price`（以及可能 fallback 到 `last_price`）。
2. `apps/trade-copier/src/BBO_MAKER_BY_DIRECTION.ts`：同上。
3. `apps/trade-copier/src/experimental/context.ts`：同上。
4. `apps/virtual-exchange/src/position.ts`：`select * from quote where product_id=?`，用于补齐 position 的 `current_price/notional/interest_*`。
5. `apps/vendor-huobi/src/services/market-data/quote.ts`：暴露 `quoteCache` 走 SQL `select * from quote where product_id=?`（被 `accounts/spot.ts` 与 `accounts/super-margin.ts` 使用）。

另外：`.c1-cellar/rolling-limit-order.ts` 也有 `from quote`（脚本用途）。
**进度**: 4/4 任务完成

---

## 阶段 1: Discovery ✅ COMPLETE

- [x] 全仓盘点 `quote` 表读取：用 `rg '(?i)from\s+quote\b'`（排除 `docs/reports/**`）确认真实调用点、每个调用点当前 SQL 形态、取到的 `IQuote` 字段使用方式、对“无 quote”时的容错逻辑。

已初步定位（待你确认是否都要迁移）：

1. `apps/trade-copier/src/BBO_MAKER.ts`：`select * from quote where product_id=? and datasource_id=?`，只用 `bid_price/ask_price`（以及可能 fallback 到 `last_price`）。
2. `apps/trade-copier/src/BBO_MAKER_BY_DIRECTION.ts`：同上。
3. `apps/trade-copier/src/experimental/context.ts`：同上。
4. `apps/virtual-exchange/src/position.ts`：`select * from quote where product_id=?`，用于补齐 position 的 `current_price/notional/interest_*`。
5. `apps/vendor-huobi/src/services/market-data/quote.ts`：暴露 `quoteCache` 走 SQL `select * from quote where product_id=?`（被 `accounts/spot.ts` 与 `accounts/super-margin.ts` 使用）。

另外：`.c1-cellar/rolling-limit-order.ts` 也有 `from quote`（脚本用途）。 | 验收: `context.md` 记录：所有调用点清单、每处需要的字段集合、以及迁移到 `VEX/QueryQuote` 后的预期行为（缺数据时是返回空/抛错/重试）。

---

## 阶段 2: Design ✅ COMPLETE

- [x] 设计并确认 `VEX/QueryQuote`（best-effort 单品查询入口）语义与迁移矩阵（以 `plan.md` 为准） | 验收: 你回复并拍板 `plan.md` 里的 review 点（更新条件、trade-copier 重试约束、product_id 传参约定、vendor-huobi 是否纳入迁移）

---

## 阶段 3: Implementation ✅ COMPLETE

- [x] 在 `apps/virtual-exchange/src/quote/service.ts` 增加 `VEX/QueryQuote` 服务实现（复用现有 `quoteState` + 入队机制），并保持 `VEX/QueryQuotes` 行为不变 | 验收: 新服务可用，且不改变现有 `VEX/QueryQuotes` 行为
- [x] 替换业务侧 `from quote` 为 `VEX/QueryQuote`（trade-copier `updated_at=Date.now()`，数据不全直接 return；position.ts best-effort；vendor-huobi 纳入迁移） | 验收: `rg '(?i)from\\s+quote\\b'`（apps/libraries）无命中

---

## 阶段 4: Validation ✅ COMPLETE

- [x] 最小验证：运行 prettier；分别构建 `libraries/data-quote`、`apps/trade-copier`、`apps/virtual-exchange`、`apps/vendor-huobi`；确认 tests 通过 | 验收: 构建通过且无新增 TS 错误

---

## 发现的新任务

(暂无)

---

_最后更新: 2025-12-18 00:50_
