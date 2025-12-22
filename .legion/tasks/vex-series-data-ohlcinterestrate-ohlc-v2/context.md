# VEX series-data 调度器（OHLC/InterestRate）+ ohlc_v2 迁移 - 上下文

## 会话进展 (2025-12-22)

### ✅ 已完成

- 已阅读 vendors-ingest-ohlc-interest-rate 文档，确认 IngestOHLC/IngestInterestRate contract：request=time+direction（direction 为 schema const），response 仅 wrote_count+range
- 已核对 @yuants/exchange 实现：IngestOHLC 写入 ohlc 并落 series_data_range；IngestInterestRate 写入 interest_rate 并落 series_data_range；并根据 review 更新 series_id 编码计划（OHLC=`${product_id}/${duration}`，InterestRate=`product_id`）
- 已复核 VEX quote scheduler 的服务发现/队列/runner 模型，可作为 series-data 调度器实现参考（terminalInfos$ -> service 列表 -> per-group 串行 runner）
- 已复核现有 SQL 迁移约束与表结构：series_data_range 主键/索引；ohlc 表字段现状（含 datasource_id/product_id/duration）
- 实现 series_id helper：`@yuants/data-ohlc` 增加 `encodeOHLCSeriesId/decodeOHLCSeriesId`，`@yuants/data-interest-rate` 增加 `encodeInterestRateSeriesId/decodeInterestRateSeriesId`
- 新增 SQL migration：`tools/sql-migration/sql/ohlc_v2.sql`（去除 datasource_id/product_id/duration，索引 (series_id, created_at) + updated_at trigger）
- 改造 `libraries/exchange/src/ohlc.ts`：OHLC_INSERT_COLUMNS 去掉 datasource_id/product_id/duration，写入 `ohlc_v2`，range.table_name 改为 `ohlc_v2`，series_id 改用 `encodeOHLCSeriesId`
- 改造 `libraries/exchange/src/interest_rate.ts`：series_id 改用 `encodeInterestRateSeriesId`
- 新增 VEX series-data 调度器：`apps/virtual-exchange/src/series-data/scheduler.ts`（服务发现、扫描 product、head/tail 调度、range merge、背压/退避；提供 `VEX/SeriesData/Peek`）并接入 `apps/virtual-exchange/src/index.ts`
- 为各 vendor 的 IngestOHLC/IngestInterestRate 服务添加保守 `serviceOptions` 限流兜底（concurrent/max_pending_requests/token bucket）
- 将 series-data 内 FIFO 队列抽成独立文件 `apps/virtual-exchange/src/series-data/fifo-queue.ts`，scheduler 复用导入以便后续复用/测试
- 将 series-data 调度 loop 从 `setInterval` 改为 RxJS `defer(...).pipe(repeat({ delay }))`，避免额外定时器并确保串行 tick
- 为 `apps/virtual-exchange/src/series-data/scheduler.ts` 补充调度算法注释（对齐 `quote/scheduler.ts` 风格），覆盖发现/扫描/head-tail/背压-退避/range merge。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

- 本环境无法跑 `rush build`（EPERM），仍建议在 CI/开发机验证

---

## 关键文件

- `libraries/exchange/src/ohlc.ts`：IngestOHLC contract + 写库（后续切到 `ohlc_v2` 并调整列/表名）
- `libraries/exchange/src/interest_rate.ts`：IngestInterestRate contract + 写库
- `apps/virtual-exchange/src/quote/scheduler.ts`：VEX 现有调度器参考（服务发现/分组/队列/runner）
- `tools/sql-migration/sql/series_data_range.sql`：range 表结构（本任务会基于它推进并做合并）
- `tools/sql-migration/sql/ohlc.sql`：现有 ohlc 表结构（本任务新增 `ohlc_v2.sql` 并切换写入）
- `apps/vendor-binance/src/services/ohlc-service.ts`：vendor 侧 IngestOHLC 示例（backward/endTime/limit=1000）
- `apps/vendor-binance/src/services/interest-rate-service.ts`：vendor 侧 IngestInterestRate 示例（forward/window=1y）

---

## 关键决策

| 决策                                                                                                                                                            | 原因                                                                                                                       | 替代方案                                                                                                          | 日期       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| 调度推进以服务返回的 range 为准，不使用 wrote_count 作为推进依据。                                                                                              | 写库端目前返回的 wrote_count 代表 fetched 数量而非实际 insert 数（ON CONFLICT 会忽略重复），且调度只需边界信息。           | 依赖 wrote_count 判断是否推进（会误判/不稳定）,要求 vendor 返回更精确的 inserted_count（需要改 contract，暂不做） | 2025-12-22 |
| series_data_range 合并采用单 (series_id, table_name) 粒度的 transaction：SELECT ... FOR UPDATE 锁定现有行，内存 merge 后 delete+insert 归并结果。               | 实现直观、幂等；不依赖复杂 SQL/window 函数；可在并发写入情况下保证最终收敛，避免区间碎片爆炸。                             | 纯 SQL CTE 聚合/窗口函数一次性 merge（更复杂，调试成本高）,只做增量合并（更高效但实现更复杂，后续可优化）         | 2025-12-22 |
| 第一版 series-data 调度器不做“指定实例/指定 service_id”调度，统一使用 `terminal.client.requestForResponse`/`requestForResponseData` 走随机负载均衡。            | 降低实现复杂度；同一能力多实例的负载均衡不是第一优先级，先把节奏控制（并发/背压/退避）做好。                               | 显式选择 (terminal_id, service_id) 做可控调度（需要更多状态/选择策略）                                            | 2025-12-22 |
| 目标 series 来源选择方案 A（扫描 `product` 表），并采用渐进扫描 + 去重队列避免启动时打爆。                                                                      | 无需新增配置表即可跑起来；通过扫描游标+批量限制+全局并发实现可控 rollout。                                                 | 新增配置表/复用 `series_collecting_task` 显式声明采集范围（更可控但需要额外运维）                                 | 2025-12-22 |
| series_id 编码按 review 改为 OHLC=`${product_id}/${duration}`、InterestRate=`product_id`，并在数据包中补齐 encode/decode helper（作为 encodePath 的显式例外）。 | datasource_id 字段废弃后，series_id 只需表达 product+duration；decode 可从末尾取 duration，避免 product_id 含 `/` 的歧义。 | 继续使用 `encodePath`（符合仓库默认准则，但不符合本次人类指令）                                                   | 2025-12-22 |

---

## 快速交接

**下次继续从这里开始：**

1. 部署前先执行 SQL migration：`tools/sql-migration/sql/ohlc_v2.sql`（以及已有的 `series_data_range.sql`）
2. 启动 VEX 时设置 `VEX_SERIES_DATA_ENABLED=1`（可选调参：`VEX_SERIES_DATA_MAX_INFLIGHT` 等），观察日志 `[VEX][SeriesData]`
3. 如需跳过 `product.no_interest_rate=true` 的品种，请设置 `VEX_SERIES_DATA_FILTER_NO_INTEREST_RATE=1`
4. 调用 `VEX/SeriesData/Peek` 查看 `capabilities/queue/inflight/series_count`，确认已发现 IngestOHLC/IngestInterestRate 并开始扫描/调度
5. 确认 vendor 侧限流是否合适（各 vendor ingest service 已加 `IServiceOptions`；如吞吐不足再放宽 concurrent/token bucket）
6. 确认写库落点：OHLC 已切到 `ohlc_v2`，并且 `series_data_range.table_name='ohlc_v2'`；InterestRate 仍写 `interest_rate`

**注意事项：**

- series_id 编码已按 review 变更：OHLC=`product_id + '/' + duration`，InterestRate=`product_id`；历史数据不搬迁不双写，会产生新旧两套 series_id 并存的现象。
- 本环境无法跑 `rush build`（EPERM），建议在正常 CI/开发机上跑 `rush build --to @yuants/virtual-exchange --to @yuants/exchange --to @yuants/data-ohlc --to @yuants/data-interest-rate` 做一次验证。

---

_最后更新: 2025-12-22 16:47 by Claude_
