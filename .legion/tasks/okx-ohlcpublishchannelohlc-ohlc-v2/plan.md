# OKX OHLC：publishChannel('ohlc') 梳理 + 写入 ohlc_v2 双写

## 目标

查找所有 publishChannel 发布 'ohlc' 的位置，并在 writeToSQL 时将 OHLC 数据同时写入 ohlc_v2 表（按表结构做映射）。

## 要点

- 先全仓搜索并列出所有 publishChannel('ohlc') 的发布点、payload 结构与来源（vendor/服务/调度器）
- 定位 writeToSQL 调用链与旧表结构（ohlc/ohlc_interest_rate 等），确认哪些路径需要双写
- 读取 ohlc_v2 表结构（迁移 SQL/类型定义），设计字段映射与主键/去重策略
- 先写 .legion 详细设计并等待 review；通过后再落代码改动与最小验证

## 范围

- apps/vendor-okx/src/public-data/ohlc.ts
- \**/*writeToSQL\*
- \**/*publishChannel\*
- tools/sql-migration/\*\*
- supabase/migrations/\*\*
- .legion/tasks/<new-task>/{plan,context,tasks}.md

## 阶段概览

1. **调研** - 2 个任务
2. **设计（先写文档，等待 review）** - 1 个任务
3. **实现** - 1 个任务
4. **验证与交接** - 1 个任务

## 现状梳理

### 1) publishChannel('ohlc') 发布点（全仓搜索结果）

- 仅发现 1 处：`apps/vendor-okx/src/public-data/ohlc.ts` 内的 `terminal.channel.publishChannel('ohlc', { pattern: '^OKX/' }, ...)`
- 该回调以 `series_id` 作为 channel key，订阅 OKX WebSocket 的 K 线并返回 `Observable<IOHLC>`
- 在 `pipe` 内调用 `writeToSQL({ tableName: 'ohlc', ... })` 写入旧表 `ohlc`

> 备注：其它 vendor 的 OHLC 目前使用 `createSeriesProvider`（服务端写库，不经过 `publishChannel`），不在本任务修改范围内。

### 2) 当前 SQL 写入行为（writeToSQL）

- `writeToSQL` 实现位于 `libraries/sql/src/index.ts`：使用 `bufferWriter` 以固定间隔批量 INSERT/UPSERT
- 写入失败不会向上游抛错：会保留 buffer 并在后续 interval 周期重试（见 `libraries/sql/src/bufferWriter.ts`）
- 因此“新增 ohlc_v2 双写”不应影响现有 channel 发布（最多导致 v2 写入侧 buffer 积压/重复重试）

## 详细设计（先文档，review 通过后再动代码）

### 1) ohlc_v2 表结构（来源）

来自 `tools/sql-migration/sql/ohlc_v2.sql`：

- 主键：`(series_id, created_at)`
- 列：
  - `series_id` (TEXT, NOT NULL)
  - `created_at` (TIMESTAMPTZ, NOT NULL)
  - `closed_at` (TIMESTAMPTZ, NOT NULL)
  - `open/high/low/close` (TEXT, NOT NULL；SQL 中写作 `CLOSE`，Postgres 实际为 `close`)
  - `volume/open_interest` (TEXT, nullable)
  - `updated_at` (TIMESTAMPTZ, DEFAULT CURRENT_TIMESTAMP)
- 与旧表 `ohlc` 的差异：移除了 `datasource_id/product_id/duration` 三列（这些信息应可由 `series_id` 反推）

### 2) 写入 ohlc_v2 的 series_id 编码策略（关键）

读取侧（`libraries/data-ohlc/src/loadOHLC.ts`）在查询 `ohlc_v2` 时使用：

- `series_id = encodeOHLCSeriesId(product_id, duration)`（即 `${product_id}/${duration}`）
- 其中 `product_id` 约定为 `encodePath(datasource_id, instType, instId)` 这种“展开后的多段路径”

而 OKX 的 `publishChannel('ohlc')` 当前收到的 `series_id` 采用“把 product_id 作为单段”的旧编码：

- 形如：`OKX/<product_id_legacy>/<duration>`，其中 `<product_id_legacy>` 本身通常是 `encodePath(instType, instId)`，会被作为一个 segment 写入（因此在 `series_id` 中会出现 `%2F`）

为了让双写的 `ohlc_v2` 数据能被现有读取侧直接命中，本任务建议在写入 v2 时 **归一化** `series_id`：

1. 从 channel key 解析旧字段：
   - `[datasource_id, product_id_legacy, duration] = decodePath(series_id_legacy)`
   - `[instType, instId] = decodePath(product_id_legacy)`
2. 构造 v2 使用的 product_id 与 series_id：
   - `product_id_v2 = encodePath(datasource_id, instType, instId)`
   - `series_id_v2 = `${product_id_v2}/${duration}``

示例（便于 review 时快速对齐）：

- legacy：`OKX/SWAP%2FBTC-USDT-SWAP/PT1M`
- v2：`OKX/SWAP/BTC-USDT-SWAP/PT1M`

### 3) 字段映射（IOHLC → ohlc_v2 row）

写入 ohlc_v2 时仅保留表中存在的列（其余列丢弃）：

| ohlc_v2 列            | 来源字段                    | 备注                                                    |
| --------------------- | --------------------------- | ------------------------------------------------------- |
| `series_id`           | `series_id_v2`              | 使用上节的归一化结果                                    |
| `created_at`          | `IOHLC.created_at`          | `formatTime(ms)` 产出的时间字符串可直接写入 TIMESTAMPTZ |
| `closed_at`           | `IOHLC.closed_at`           | 同上                                                    |
| `open/high/low/close` | `IOHLC.open/high/low/close` | 均为 string                                             |
| `volume`              | `IOHLC.volume`              | OKX 现有实现为 string                                   |
| `open_interest`       | `IOHLC.open_interest`       | OKX 现有实现写死为 `'0'`                                |

### 4) 双写落点与实现形态（不改行为、单订阅）

目标：保持 publishChannel 返回的 Observable 类型与数据不变（仍为 `IOHLC`），同时在同一订阅链路内完成双写，避免额外 `subscribe()` 导致生命周期不可控。

推荐实现形态（伪代码，review 通过后再落盘）：

1. 先把 WS payload map 成 `IOHLC`（保持现状）
2. 追加一步 map：生成 `{ ...ohlc_v2_row, __origin: IOHLC }`
3. `writeToSQL({ tableName: 'ohlc_v2', columns: [...], conflictKeys: ['series_id','created_at'] })`
   - 仅插入 v2 需要的列，避免把 `__origin` 等辅助字段写进 SQL
4. `map(x => x.__origin)` 还原回 `IOHLC`
5. 继续现有 `writeToSQL({ tableName: 'ohlc', conflictKeys: ['series_id','created_at'] })`（可保留现状或顺手把 conflictKeys 调整为主键顺序）

### 5) 冲突键/去重策略

- `ohlc_v2`：使用 `conflictKeys: ['series_id', 'created_at']`，与主键一致；冲突时按 `writeToSQL` 默认行为更新所有列
- `ohlc`：主键同为 `(series_id, created_at)`；当前 OKX 代码使用 `['created_at', 'series_id']`，建议实现时统一为 `['series_id', 'created_at']` 以匹配其它写入侧与迁移定义

### 6) 回滚/开关（建议在 review 时确认）

本任务最保守的回滚方式是直接回退代码改动即可；如果希望线上可控，可考虑增加一个环境变量开关（例如 `WRITE_OHLC_V2_TO_SQL`），默认开启/关闭需要产品侧决定。

### 7) 验证方案（最小可复现）

建议在实现后补一个最小脚本/单测（优先单测）验证：

- 映射函数：legacy series_id → v2 series_id 的转换符合预期（至少覆盖 1 个 spot + 1 个 swap）
- 双写列集合：确保写入 v2 时不包含 `datasource_id/product_id/duration` 等旧列

---

_创建于: 2026-01-05 | 最后更新: 2026-01-05_
