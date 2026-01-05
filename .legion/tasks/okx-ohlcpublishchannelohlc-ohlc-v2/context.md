# OKX OHLC：publishChannel('ohlc') 梳理 + 写入 ohlc_v2 双写 - 上下文

## 会话进展 (2026-01-05)

### ✅ 已完成

- 全仓确认 publishChannel('ohlc') 仅出现 1 处：apps/vendor-okx/src/public-data/ohlc.ts
- 阅读 apps/vendor-okx 的 OHLC 实时链路：useOHLC → map(IOHLC) → writeToSQL({tableName:'ohlc'})
- 阅读 @yuants/sql 的 writeToSQL/createSQLWriter/bufferWriter：写入失败不抛出到上游、会保留 buffer 并周期重试
- （记录）legion_update_tasks 曾误将 tasks.md 全部任务标为完成，已手工更正为“仅调研完成，设计进行中”。
- 已在 apps/vendor-okx/src/public-data/ohlc.ts 的 publishChannel('ohlc') 链路实现双写：先写入 ohlc_v2（归一化 series_id），再写入旧表 ohlc（不改变对外返回 IOHLC）。
- 已运行 prettier 格式化相关文件。
- 已运行 `node common/scripts/install-run-rush.js build -t @yuants/vendor-okx`，构建通过。

### 🟡 进行中

- 补“线上可复现”的最小验证：跑 OKX OHLC 订阅并确认同一条 K 线同时写入 ohlc 与 ohlc_v2（series_id 形态不同但可命中读取侧）。

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `apps/vendor-okx/src/public-data/ohlc.ts`：OKX OHLC 实时订阅 + `publishChannel('ohlc')` 发布点（本任务主要改动位置）。
- `libraries/sql/src/index.ts`：`writeToSQL/createSQLWriter/buildInsertManyIntoTableSQL` 实现（确认双写可用 columns 限定列集合）。
- `libraries/sql/src/bufferWriter.ts`：buffer writer 重试/错误行为（评估双写失败的影响）。
- `tools/sql-migration/sql/ohlc_v2.sql`：`ohlc_v2` 表结构（字段/主键/索引）。
- `tools/sql-migration/sql/ohlc.sql`：旧表 `ohlc` 表结构（对比差异）。
- `libraries/data-ohlc/src/loadOHLC.ts`：读取侧对 `ohlc_v2` 的 `series_id` 编码约定（决定了写入 v2 时需要归一化 legacy series_id）。
- `libraries/data-ohlc/src/series_id.ts`：`encodeOHLCSeriesId/decodeOHLCSeriesId`（series_id 编码规则）。
- `libraries/exchange/src/ohlc.ts`：写入 `ohlc_v2` 的参考实现（columns 列表 + conflictKeys）。

---

## 关键决策

| 决策                                                                                                                                                                | 原因                                                                                                                                                                                                                                                                              | 替代方案                                                                                                                                                     | 日期       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 写入 ohlc_v2 时对 OKX legacy series_id 做归一化（series_id_v2 = `${encodePath(datasource_id, instType, instId)}/${duration}`），而不是原样写入 legacy series_id。   | 读取侧（libraries/data-ohlc/src/loadOHLC.ts）查询 ohlc_v2 使用 encodeOHLCSeriesId(product_id, duration)，其中 product_id 约定为 encodePath(datasource_id, instType, instId) 的“展开多段”形式；若原样写 legacy（包含 %2F 的单段 product_id），读取侧将无法命中，双写价值大幅下降。 | 原样写入 legacy series_id（实现更简单，但会产生与读取侧不一致的 key，需要额外兼容/迁移）,同时写入两份 series_id（legacy + v2，数据翻倍且去重/查询更复杂）    | 2026-01-05 |
| 在 publishChannel('ohlc') 的同一订阅链路内完成双写：通过“携带 \_\_origin + columns 限定”实现 `writeToSQL(ohlc_v2)` 与 `writeToSQL(ohlc)` 串联，避免额外 subscribe。 | publishChannel 回调应返回可被 Terminal 管控生命周期的 Observable；若为双写额外 subscribe，会导致即使无人订阅 channel 也持续占用 WS 连接/写库。串联两个 writeToSQL 不改变对外流类型，且复用现有 bufferWriter 行为。                                                                | 分叉流并对两个分支各自 subscribe（实现直观但生命周期不可控，易泄露连接）,在 tap 内直接 requestSQL 写入 v2（绕开 writeToSQL，失去统一 bufferWriter/状态监控） | 2026-01-05 |

---

## 快速交接

**下次继续从这里开始：**

1. 做一次可复现验证：跑 OKX OHLC 订阅并观察同一批数据同时写入 `ohlc` 与 `ohlc_v2`。
2. 若需要线上可控回滚：决定是否要在 `apps/vendor-okx/src/public-data/ohlc.ts` 增加 `WRITE_OHLC_V2_TO_SQL` 之类的开关（当前实现为默认双写）。

**注意事项：**

- `ohlc_v2` 目前读取侧基于 `encodeOHLCSeriesId(product_id, duration)` 查询；若 v2 写入仍使用 legacy series_id（包含 `%2F` 的单段 product_id），读取侧大概率无法命中。
- 当前实现写入 `ohlc_v2` 会把 legacy `series_id` 归一化为展开路径（例如 `OKX/SWAP/BTC-USDT-SWAP/PT1M`），而旧表 `ohlc` 仍保留 legacy 形态（例如 `OKX/SWAP%2FBTC-USDT-SWAP/PT1M`）。
- 本任务只做“数据行双写”，不负责维护 `series_data_range`（是否需要另起任务补齐范围表，由业务决定）。

---

_最后更新: 2026-01-05 15:03 by Claude_
