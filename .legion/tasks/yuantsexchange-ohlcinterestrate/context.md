# @yuants/exchange 增加 OHLC/InterestRate 历史数据写入服务 - 上下文

## 会话进展 (2025-12-19)

### ✅ 已完成

- 已调研：`quote.ts` schema->metadata 模式、`exchange.md` 历史数据翻页语义、`data-series`/vendor OKX 的历史写库范式、以及 `ohlc`/`interest_rate` 表结构
- 已逐条处理并闭环 `plan.md` 的全部 Review（含 blocking），更新设计为 `time + direction` 分页模型、`series_data_range` 范围记录表、以及新的 series_id 编码约定
- 已闭环新增 Review（direction/time 必传）：更新 `plan.md` 的接口与 schema 设计，`time` 由可选改为必传
- 已实现：`provideOHLCService`/`provideInterestRateService`（写主表 + 写 `series_data_range`），并完成 `series_data_range` 的 SQL migration
- 已将历史分页公共类型抽到 `libraries/exchange/src/types.ts`，避免 re-export 冲突
- 已闭环全部 Review（含新增 direction/time 必传）
- 已新增 `parseMetadataFromSchema` 单元测试：`libraries/exchange/src/parseMetadataFromSchema.test.ts`（覆盖 quote/ohlc/interest_rate 的 parse 函数正常/异常路径）
- 已按要求把 `parseMetadataFromSchema` 测试拆成 3 个文件：`libraries/exchange/src/quote.test.ts`、`libraries/exchange/src/ohlc.test.ts`、`libraries/exchange/src/interest_rate.test.ts`

### 🟡 进行中

- 等待在具备工具链的环境运行 `@yuants/exchange` 的 jest/typecheck 验证

### ⚠️ 阻塞/待定

- 当前环境仍缺少 `pnpm` 且 Rush 安装受限，无法本地执行测试

---

## 关键文件

- `libraries/exchange/src/quote.ts`：现有 “schema -> metadata 解析 + provideService 注册” 参考实现（GetQuotes）。
- `docs/zh-Hans/code-guidelines/exchange.md`：历史数据获取章节（翻页方向、cursor 类型、Inclusive/Exclusive、页码降级等语义来源）。
- `libraries/data-series/src/index.ts`：`createSeriesProvider`/`CollectSeries`（分页迭代后用 `requestSQL(buildInsertManyIntoTableSQL)` 写库；conflictKeys 常用 `series_id+created_at`）。
- `apps/vendor-okx/src/utils/provideSeriesFromTimeBackwardService.ts`：`Query*` 返回数据 + `Update*` 写库范式（当前写库表名硬编码为 `ohlc`，不利于复用到 interest_rate）。
- `libraries/sql/src/index.ts`：`createSQLWriter`/`writeToSQL`/`requestSQL`/`buildInsertManyIntoTableSQL`（用于决定写库方式）。
- `tools/sql-migration/sql/ohlc.sql`、`tools/sql-migration/sql/interest_rate.sql`：目标表结构（主键均为 `series_id+created_at`）。
- `libraries/exchange/src/ohlc.ts`：已存在空文件（后续在实现阶段填充）。

---

## 关键决策

| 决策                                                                                                                                                                    | 原因                                                                                                                                               | 替代方案                                                                                                      | 日期       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| 历史数据分页模型收敛为 `time + direction`（direction 在 schema 中固定为 const），响应仅返回 `wrote_count + range`（不返回 next_cursor，也不建模 inclusive/exclusive）。 | 减少 vendor 侧差异建模与 VEX 推进复杂度；以写库冲突键去重允许少量重叠；VEX 仅依赖 range 推进下一页。                                               | 维持 cursor 类型分类（time/id/page/none）并建模 inclusive/exclusive,响应中返回 next_cursor 由 vendor 决定推进 | 2025-12-19 |
| `series_id` 编码不再额外拼接 `datasource_id`：OHLC 为 `encodePath(product_id, duration)`，InterestRate 为 `encodePath(product_id)`。                                    | `product_id` 的第一段已包含 datasource/exchange name，避免冗余并保持 series_id 更短；同时避免与表主键 `(series_id, created_at)` 的唯一性冲突风险。 | 沿用旧注释：`encodePath(datasource_id, product_id, duration)`/`encodePath(datasource_id, product_id)`         | 2025-12-19 |
| 新增范围记录表 `series_data_range(series_id, table_name, start_time, end_time)`（复合主键），写入使用 `ON CONFLICT DO NOTHING`。                                        | 满足“记录本次写入覆盖范围”的需求，同时保持表结构最小化；复合主键 + DO NOTHING 支持幂等重复写入。                                                   | 新增带 id/terminal_id/cursor 等字段的 ingest_log 表,复用 `series_collecting_task`（语义不匹配）               | 2025-12-19 |

---

## 快速交接

**下次继续从这里开始：**

1. 在具备工具链的环境中运行：`pnpm -w --filter @yuants/exchange build` 或 Rush 对应命令，确认 typecheck 通过
2. 如需要，我可以补一段 `exchange.md` 的“历史数据写库接口”说明（method 名称与请求字段）
3. 确认 `series_id` 新编码（`encodePath(product_id, duration)` / `encodePath(product_id)`）是否需要同步更新下游读取逻辑（如有依赖旧编码的地方）

**注意事项：**

- 本轮已开始改业务代码：`libraries/exchange/src/ohlc.ts`、`libraries/exchange/src/interest_rate.ts`、`libraries/exchange/src/index.ts`、`libraries/exchange/src/types.ts`，以及 migration `tools/sql-migration/sql/series_data_range.sql`。

---

_最后更新: 2025-12-19 22:54 by Claude_
