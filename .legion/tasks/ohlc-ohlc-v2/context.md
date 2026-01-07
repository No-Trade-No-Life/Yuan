# 移除旧 ohlc 表引用并切换到 ohlc_v2 - 上下文

## 会话进展 (2026-01-07)

### ✅ 已完成

- 完成旧表 `ohlc` 引用初步盘点（写入/读取/任务参数），见「旧表 ohlc 引用清单」
- 完成 `ohlc_v2` 表结构与 `series_id` 编码规则确认，见「ohlc_v2 表结构与 series_id 编码要点」
- 已在 plan.md 给出逐文件替换策略与待 review 问题
- 已删除所有基于 createSeriesProvider 的旧 OHLC/interest_rate 脚本与入口（binance/bitget/okx/aster/gate/hyperliquid/tq 等）并清理对应 import。
- 已把写入与读取侧统一切换到 `ohlc_v2`：kernel RealtimePeriodLoadingUnit、UI Audit/NetValue/Market 查询与 CollectSeries 参数对齐新表与 series_id。
- 已移除旧表结构 `tools/sql-migration/sql/ohlc.sql` 并更新相关文档（vendor-historical-market-data）。

### 🟡 进行中

- 待做最小验证与交接说明（未运行测试）。

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `libraries/kernel/src/units/RealtimePeriodLoadingUnit.ts`
- `libraries/data-ohlc/src/series_id.ts`
- `libraries/exchange/src/ohlc.ts`
- `tools/sql-migration/sql/ohlc_v2.sql`
- `apps/vendor-okx/src/public-data/ohlc.ts`
- `apps/vendor-tq/src/index.ts`
- `ui/web/src/modules/Audit/Audit.tsx`
- `ui/web/src/modules/Audit/NetValueAudit.tsx`
- `ui/web/src/modules/Market/Market.tsx`
- `docs/zh-Hans/vendor-guide/vendor-historical-market-data.md`
- `docs/en/vendor-guide/vendor-historical-market-data.md`

---

## 旧表 ohlc 引用清单（调研结果）

### 写入/写库

- `apps/vendor-binance/src/public-data/ohlc.ts`：`createSeriesProvider` 写入 `tableName: 'ohlc'`
- `apps/vendor-bitget/src/services/markets/ohlc.ts`：`createSeriesProvider` 写入 `tableName: 'ohlc'`
- `apps/vendor-okx/src/public-data/ohlc.ts`：`createSeriesProvider` 写入 `tableName: 'ohlc'`；`publishChannel('ohlc')` 仍写 `ohlc`（目前双写）
- `apps/vendor-hyperliquid/src/services/markets/ohlc.ts`：`createSeriesProvider` 写入 `tableName: 'ohlc'`
- `apps/vendor-tq/src/index.ts`：`createSeriesProvider` 写入 `tableName: 'ohlc'`
- `apps/vendor-okx/src/utils/provideSeriesFromTimeBackwardService.ts`：`buildInsertManyIntoTableSQL(..., 'ohlc')`

### 读取/查询

- `libraries/kernel/src/units/RealtimePeriodLoadingUnit.ts`：`table_name: 'ohlc'` + `select * from ohlc`
- `ui/web/src/modules/Audit/Audit.tsx`：`select * from ohlc`
- `ui/web/src/modules/Audit/NetValueAudit.tsx`：`select * from ohlc`（loadTimeSeriesData + requestSQL）

### 任务参数/CollectSeries

- `ui/web/src/modules/Market/Market.tsx`：`CollectSeries` 请求 `table_name: 'ohlc'`

### 其他（非执行引用，可忽略）

- `docs/reports/git-changes-*.json`/`docs/reports/git-changes-report-*.md`：历史报告中含 `ohlc` 变更描述

---

## 调研结论（ohlc_v2/series_id/写入列）

### ohlc_v2 表结构

- DDL 来源：`tools/sql-migration/sql/ohlc_v2.sql`
- 主键：`(series_id, created_at)`；索引 `idx_ohlc_v2_series_id_created_at`
- 列：`series_id/created_at/closed_at/open/high/low/close/volume/open_interest/updated_at`
- 不再包含 `datasource_id/product_id/duration` 三列

### series_id 编码规则

- `encodeOHLCSeriesId(product_id, duration)` = `${product_id}/${duration}`
- `decodeOHLCSeriesId(series_id)` 使用 `decodePath` 拆分后把前 N-1 段用 `encodePath` 还原为 `product_id`
- 约定：`product_id = encodePath(datasource_id, instType, instId)`（多段路径）

### createSeriesProvider 写入列裁剪

- `createSeriesProvider` 内部使用 `buildInsertManyIntoTableSQL(data, ctx.tableName)`，默认取数据第一行的 key 作为列名
- 当写入 `ohlc_v2` 时，数据行必须只包含 v2 列（否则会插入不存在的列）
- 建议写入行类型：`Omit<IOHLC, 'datasource_id' | 'product_id' | 'duration'>` 或自定义 v2 行对象
- `datasource_id/product_id/duration` 仍可在 queryFn 内计算/使用，但不要写入行对象

## 关键决策

| 决策 | 原因 | 替代方案 | 日期 |
| ---- | ---- | -------- | ---- |

---

## 快速交接

**下次继续从这里开始：**

1. 如需验证：运行相关模块的最小 tsc/build（例如 kernel/ui 及变更过的 vendor 包）。
2. 确认运行时 `CollectSeries`/UI 查询在 `ohlc_v2` 下可正常返回数据。
3. 若无进一步需求，可进入收尾并归档任务。

**注意事项：**

- 未执行本地测试；本次改动包含多处删除文件与入口清理。
- OKX 的 publishChannel 仅写 `ohlc_v2`，已移除旧表双写。

---

_最后更新: 2026-01-07 17:35 by Claude_
