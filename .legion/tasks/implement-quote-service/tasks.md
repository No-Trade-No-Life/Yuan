# implement-quote-service - 任务清单

## 快速恢复（给你 review 用）

**当前阶段**: (unknown)
**当前任务**: (none)
**进度**: 8/8 任务完成

核心 review 点：

1. `product_id_prefix` 与 `encodePath(...)` 一致
2. `metadata.fields` 只声明稳定可提供字段
3. `updated_at` 是毫秒时间戳且每条必带
4. 按 `req.product_ids` 过滤输出
5. 每个上游 API 调用对应一个 `provideQuoteService`（不 join）

---

## 阶段 1: 需求摸底 ✅ COMPLETE

- [x] 明确 `GetQuotes` 契约与 schema 约束 | 验收: 已写清请求/响应、fields const、updated_at(ms)、字段值为 string
- [x] 选定 Gate 作为模板并抽取通用骨架 | 验收: 已确认“按 prefix 拆分 + 拉取 public API + product_ids 过滤”

---

## 阶段 2: 方案设计 ✅ COMPLETE

- [x] 明确 product_id 与 prefix 规则 | 验收: 统一使用 `encodePath(DATASOURCE, TYPE, ID)`，prefix 末尾含 `/`
- [x] 完成分 vendor 的字段/数据源设计 | 验收: `plan.md` 的「分 vendor 设计」可逐项对照实现
- [x] 记录关键决策与风险 | 验收: `context.md` 中包含“不 join”决策与 gotchas

---

## 阶段 3: 开发落地 ✅ COMPLETE

- [x] OKX/BINANCE/ASTER/HYPERLIQUID/BITGET/HTX 全部落地 `GetQuotes` | 验收: 每个 vendor 都有 `services/quotes.ts` + 入口导入
- [x] 遵循“不 join”拆分为多个 service | 验收: 每个上游 API 调用对应一个 `provideQuoteService`
- [x] 最小类型检查通过并记录 | 验收: `context.md` 已记录 tsc 命令与结果

---

## 详细清单（不参与进度统计）

### 已修改/新增的关键文件（按 vendor）

- Bitget：`apps/vendor-bitget/src/services/quotes.ts`，`apps/vendor-bitget/src/index.ts`
- Hyperliquid：`apps/vendor-hyperliquid/src/services/quotes.ts`，`apps/vendor-hyperliquid/src/index.ts`
- OKX：`apps/vendor-okx/src/services/quotes.ts`，`apps/vendor-okx/src/index.ts`
- Binance：`apps/vendor-binance/src/services/quotes.ts`，`apps/vendor-binance/src/index.ts`
- Aster：`apps/vendor-aster/src/services/quotes.ts`，`apps/vendor-aster/src/index.ts`
- HTX(Huobi)：`apps/vendor-huobi/src/services/quotes.ts`，`apps/vendor-huobi/src/index.ts`

### 已解决的 TODO

- [x] Hyperliquid meta/ctx 映射：按 `meta.universe[i].name ↔ assetCtxs[i]` 处理，并拆分为独立 service（不 join）
- [x] OKX open_interest：单独 `provideQuoteService`（不 join）
- [x] Binance SPOT last_price：单独 `provideQuoteService`（不 join）

---

_最后更新: 2025-12-14 23:55_
