# @yuants/exchange 增加 OHLC/InterestRate 历史数据写入服务 - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - 验证与文档
**当前任务**: 添加最小验证：确认新模块导出/类型无明显冲突，并在具备工具链时运行 `@yuants/exchange` build/typecheck；必要时补充 `exchange.md`。
**进度**: 7/8 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 阅读并总结现有模式：`libraries/exchange/src/quote.ts`（schema->metadata）、`docs/zh-Hans/code-guidelines/exchange.md`（历史数据翻页语义）、以及 vendor 侧历史数据写库实现（如 `apps/vendor-okx/src/utils/provideSeriesFromTimeBackwardService.ts`、`libraries/data-series/src/index.ts`）。 | 验收: 在 `context.md` 记录：可复用的 schema 校验模式、分页语义要点、以及现有写库方式优缺点（requestSQL vs createSQLWriter/writeToSQL）。

---

## 阶段 2: 设计 ✅ COMPLETE

- [x] 设计 `IOHLCServiceMetadata`：`product_id_prefix`、`duration_list`（RFC3339 duration 字符串数组）、`direction`（`backward|forward`），并确定 `IngestOHLC` 的请求/响应（只保留 `time + direction`；响应仅 `wrote_count + range`）。 | 验收: `plan.md` 中给出可直接照抄的 TS 类型 + JSON Schema。
- [x] 定义并实现 `parseOHLCServiceMetadataFromSchema`：从 terminal service info 的 JSON Schema 中解析 metadata（对 schema 做结构校验，错误码与 `quote.ts` 一致风格；可确定性解析 `product_id_prefix/duration_list/direction`）。 | 验收: `plan.md` 写清解析规则与校验点（必填字段、duration_list 来源、direction const 来源）。
- [x] 确认并落定范围记录表：`series_data_range(series_id, table_name, start_time, end_time)`（复合主键 + `ON CONFLICT DO NOTHING`），并确定 migration 文件名 `tools/sql-migration/sql/series_data_range.sql`。 | 验收: `plan.md` 写清表结构/主键/写入策略与落点。

---

## 阶段 3: 实现 ✅ COMPLETE

- [x] 实现 `libraries/exchange/src/ohlc.ts`：提供 `provideOHLCService`，按 `direction + time` 拉取一页并用 `requestSQL(buildInsertManyIntoTableSQL)` 写入 `ohlc`，不回传数据本体；同时写入 `series_data_range`。 | 验收: 请求 schema 约束 product_id/duration/direction/time（均必传）；响应只包含 `wrote_count + range`；失败返回失败（`res.code != 0`）。
- [x] 实现 `libraries/exchange/src/interest_rate.ts`：与 OHLC 同结构（metadata + parse + provideInterestRateService），写入 `interest_rate` 表及 `series_data_range`。 | 验收: 无 `duration_list`；写库冲突键正确（series_id+created_at）。
- [x] 更新 `libraries/exchange/src/index.ts` 导出新增模块，并保持对外 API 一致、无 vendor 假设。 | 验收: `@yuants/exchange` 对外可直接 import 新增导出；类型与函数命名清晰。

---

## 阶段 4: 验证与文档 ⏳ NOT STARTED

- [ ] 添加最小自测/示例（若仓库有既定方式则按既定）：验证 schema 解析（parseMetadataFromSchema）在典型 schema 上可工作，并验证写库 SQL 的 conflict keys 与字段匹配 `tools/sql-migration/sql/ohlc.sql`/`interest_rate.sql`。必要时补充 `exchange.md` 的接口/metadata 说明。 | 验收: 本地 typecheck/build 通过；文档或注释说明清楚如何声明能力与如何被 VEX 解析。 ← CURRENT

---

## 发现的新任务

(暂无)

---

_最后更新: 2025-12-19 22:47_
