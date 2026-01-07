# 移除旧 ohlc 表引用并切换到 ohlc_v2

## 目标

全仓清理对旧 `ohlc` 表的读写/任务引用，统一改为 `ohlc_v2` 并对齐 series_id 编码与查询路径。

## 要点

- 盘点所有对 `ohlc` 表的写入/读取/任务引用并记录到 context 作为变更清单
- 写入侧统一改为 `ohlc_v2`：createSeriesProvider、publishChannel 双写、QuerySeriesFromTimeBackward 写库路径等
- 读取侧统一改为 `ohlc_v2`：kernel 单元与 Web UI SQL 查询/CollectSeries 参数
- series_id 统一改为 `encodeOHLCSeriesId`/`decodeOHLCSeriesId`，避免旧编码导致查询失配
- 确认是否保留 `tools/sql-migration/sql/ohlc.sql` 与文档中的旧表说明，必要时加 review 条目

## 范围

- libraries/kernel/src/units/RealtimePeriodLoadingUnit.ts
- apps/vendor-binance/src/public-data/ohlc.ts
- apps/vendor-bitget/src/services/markets/ohlc.ts
- apps/vendor-okx/src/public-data/ohlc.ts
- apps/vendor-okx/src/utils/provideSeriesFromTimeBackwardService.ts
- apps/vendor-okx/src/utils/provideOHLCFromTimeBackwardService.ts
- apps/vendor-tq/src/index.ts
- apps/vendor-hyperliquid/src/services/markets/ohlc.ts
- ui/web/src/modules/Audit/Audit.tsx
- ui/web/src/modules/Audit/NetValueAudit.tsx
- ui/web/src/modules/Market/Market.tsx
- tools/sql-migration/sql/ohlc.sql（是否保留需确认）
- docs/zh-Hans/_ 与 docs/en/_（若包含旧表引用需确认是否更新）

## 阶段概览

1. **调研** - 2 个任务
2. **设计（待 review）** - 2 个任务
3. **实现** - 1 个任务
4. **验证与交接** - 1 个任务

---

## 设计方案（待 review）

### 1) series_id 解析统一策略

- 统一使用 `decodeOHLCSeriesId(series_id)` 获取 `{ product_id, duration }`
- `datasource_id` 从 `decodePath(product_id)` 取首段
- 受影响：所有旧逻辑中 `decodePath(series_id)` 的位置（kernel unit、vendor OHLC、UI audit/market）

### 2) 写入侧替换策略

- `createSeriesProvider`（binance/bitget/okx/hyperliquid/tq）：
  - `tableName: 'ohlc'` → `'ohlc_v2'`
  - queryFn 返回数据需要**剔除** `datasource_id/product_id/duration` 三列（或将泛型改为 `Omit<IOHLC, ...>`），避免写入不存在的列
  - 保持 `series_id` 不变（由调度侧传入），但要求上游调用方已切换为 `encodeOHLCSeriesId`
- OKX `publishChannel('ohlc')`：
  - 继续写 `ohlc_v2`（已做归一化 `series_id_v2`），**移除旧表 `ohlc` 的 writeToSQL**
  - 保留 channel 名 `ohlc`（不属于表名）
- `provideSeriesFromTimeBackwardService`：
  - 将写入表改为 `ohlc_v2`
  - 写入前裁剪字段，仅保留新表列
- `provideOHLCFromTimeBackwardService`：
  - `series_id` 解码改为 `decodeOHLCSeriesId`
  - `queryFn` 输出行对象只保留 v2 列

> [REVIEW]
>
> 1. createSeriesProvider 的所有代码都可以删除了，包括 interest_rate。
> 2. provideSeriesFromTimeBackwardService 直接删掉
> 3. provideOHLCFromTimeBackwardService 直接删掉
>
> [RESPONSE] 接受。按你的要求：删除所有基于 createSeriesProvider 的旧链路（含 interest_rate 的 createSeriesProvider），并移除 provideSeriesFromTimeBackwardService/provideOHLCFromTimeBackwardService 相关代码与引用。此项会扩大本任务范围，我会在 plan.md/scope 中更新并标注影响面，但暂不改代码。
> [STATUS:resolved]

### 3) 读取侧替换策略

- `libraries/kernel/src/units/RealtimePeriodLoadingUnit.ts`：
  - `table_name: 'ohlc'` → `'ohlc_v2'`
  - SQL `select * from ohlc` → `ohlc_v2`
  - 查询返回不含 `datasource_id/product_id/duration`，需用 `decodeOHLCSeriesId` 补齐后再喂给 `periodDataUnit`
- `ui/web/src/modules/Audit/Audit.tsx` / `NetValueAudit.tsx`：
  - SQL 查询 `ohlc` → `ohlc_v2`
  - `decodePath(seriesId)` → `decodeOHLCSeriesId`，必要时再用 `decodePath(product_id)` 补齐 datasource_id
  - 若仍需完整 `IOHLC`，需补齐缺失列
- `ui/web/src/modules/Market/Market.tsx`：
  - `CollectSeries` 的 `table_name` 改为 `ohlc_v2`
  - `series_id` 改为 `encodeOHLCSeriesId(product_id, duration)`（保留 datasource_id 在 product_id 内部路径）

### 4) 需 review 的确认项

> [REVIEW] 是否保留 `tools/sql-migration/sql/ohlc.sql`（旧表结构）？
>
> [RESPONSE] 接受：不保留旧表结构，计划删除 `tools/sql-migration/sql/ohlc.sql` 并同步更新文档说明（仍待你 review 后再动代码）。
> [STATUS:resolved] > [REVIEW] 是否需要保留“读取旧表兜底”或“短期双读”策略，还是直接只读 `ohlc_v2`？
>
> [RESPONSE] 接受：不保留旧表兜底读取/短期双读，直接切换只读 `ohlc_v2`。我会在 plan.md 中明确“无旧表兜底”。
> [STATUS:resolved] > [REVIEW] OKX publishChannel 是否允许直接取消旧表写入（只保留 `ohlc_v2`）？
>
> [RESPONSE] 接受：OKX publishChannel 仅写 `ohlc_v2`，移除旧表 `ohlc` 的 writeToSQL。
> [STATUS:resolved] > [REVIEW] 是否需要同步更新文档/报告中关于 `ohlc` 表的说明（例如 `docs/zh-Hans/*` / `docs/en/*`）？
>
> [RESPONSE] 接受：需要同步更新相关文档/报告中关于 `ohlc` 的说明（按 `docs/zh-Hans/*` 与 `docs/en/*` 范围处理）。
> [STATUS:resolved]

> [REVIEW]
>
> 1. 删除 ohlc 表结构
> 2. 不保留对旧表的读取逻辑，直接切换到 ohlc_v2
> 3. OKX 只写 ohlc_v2
> 4. 更新相关文档
>
> [RESPONSE] 接受并合并为最终决策：删除旧表结构；不做旧表兜底读取，直接切到 `ohlc_v2`；OKX 仅写 `ohlc_v2`；同步更新相关文档。后续我会把 plan/scope 统一到这组决策，但暂不改代码。
> [STATUS:resolved]

_创建于: 2026-01-07 | 最后更新: 2026-01-07_
