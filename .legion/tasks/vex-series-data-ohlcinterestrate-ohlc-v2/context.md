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
- 已将“缺口回补（gap）方案 B：基于真实数据表校验 + gapQueue”写入 plan.md，等待 review
- 实现 gap check + gapQueue：基于 `ohlc_v2/interest_rate` 相邻 `created_at` 间隔检测缺口，并在 tail-side 优先回补；支持退避/冷却与 `Peek` 可观测
- 回复并关闭 plan.md 新增 reviews（R6/R8/R9/R12/R14），并将设计改为简化版本：全量入队、vendor 兜底限流、gap 回补基于 series_data_range（不引入 gapQueue/真实表检查）
- 重构 `apps/virtual-exchange/src/series-data/scheduler.ts`：移除 gapQueue/真实表 gap check，gap 回补仅基于 merge 后 `series_data_range` 的多段 ranges 选择 tail time（优先回补“距离 now 最近”的 gap）
- 删除旧实现文件 `apps/virtual-exchange/src/series-data/gap-check.ts`
- 修复 tick 执行：每 tick 仅扫描一次并启动至 `MAX_INFLIGHT` 的并发；新增 eligible dequeue 避免 backoff 时空转
- 对齐 `VEX_SERIES_DATA_FILTER_NO_INTEREST_RATE`：实现增加可选 env（默认关闭），`apps/virtual-exchange/src/series-data/DESIGN.md` 同步说明
- 更新 `apps/virtual-exchange/src/series-data/DESIGN.md`：移除 gapQueue/scan cursor 等旧设计，补齐新方案与调参说明
- 清理 `apps/virtual-exchange/src/index.ts` 重复 `import './series-data'`；运行 `prettier@2.8.8`；在本环境用 `npx -p typescript tsc` 做基础 typecheck
- tail 空页不再永久停止：移除 `tailExhausted`，改为按 backoff 退避后继续重试（避免 gap 回补被一次空页永久打断）
- 修复 `mergeRangesAndGetUnion` 的 DELETE 语句：改为按 locked 行的完整主键（series_id/table_name/start_time/end_time）删除，避免任何跨 key 误删的可能性；并通过 typecheck 验证
- 增加 per-group 串行执行：同 `groupKey=encodePath(method, product_id_prefix, direction)` 同时最多 1 个 in-flight，以减少 429（保持全局并发上限仍由 `VEX_SERIES_DATA_MAX_INFLIGHT` 控制）。
- 修复 `mergeRangesAndGetUnion` 偶发“合并后该 key 被清空”的风险：让 `inserted` CTE 显式依赖 `deleted`（`WHERE COALESCE((SELECT TRUE FROM deleted LIMIT 1), TRUE)`），避免在某些执行计划下出现 insert 早于 delete 导致 `ON CONFLICT DO NOTHING` 跳过插入、随后 delete 清空行的情况。
- 将 exchange 的写库改为单语句原子写入：`libraries/exchange/src/ohlc.ts`、`libraries/exchange/src/interest_rate.ts` 用 writable CTE 同时写入数据表（`ohlc_v2`/`interest_rate`）与 `series_data_range`，保证两者在同一事务语义下提交。
- 回退 per-group 串行：移除 `groupKey/runningGroupKeys/running_group_count`，恢复仅 per-series 去重与不并发；同步更新 `apps/virtual-exchange/src/series-data/DESIGN.md`。
- 为联调/验证加入最小定向开关：`VEX_SERIES_DATA_ONLY_PRODUCT_ID_PREFIX`（为空不生效），用于只扫描/调度指定前缀的 product_id；`VEX/SeriesData/Peek` 会回显该前缀。
- 增强 `VEX/SeriesData/Peek` 可观测性：新增 pending/inflight/backoff 计数、最早 backoff 恢复时间，以及 head/tail 队列前 20 条 sample（含 product_id/duration/backoff/nextEligibleAt）。
- 修复 backward 方向 tail 不回补：`computeTailTime` 之前总取 mostRecent.startMs 导致只在最新窗口附近重复拉取；现在改为“有 gap 才用 mostRecent.startMs”，否则用 `union_start_ms` 向过去推进。
- 修复 tail 长期不触发：`scheduleIfNeeded` 不再用 `headQueue.size()` gate tail 入队，改为允许先入队，实际是否执行 tail 仍在 `tick()` 里根据 `TAIL_ONLY_WHEN_HEAD_BELOW` gate。并同步更新 `apps/virtual-exchange/src/series-data/DESIGN.md`。
- 根据 plan 补充设计讨论：解释为何不做 per-capability head/tail 队列（复杂度/公平性/收益），并在 plan.md 增加 `series_data_range` merge 的 2 条手工 SQL 测试场景（before/after + 其他 series 不受影响）。
- 根据要求更新设计：如需引入 token bucket 限速，必须复用 `@yuants/utils` 的 `tokenBucket`（按 capKey 建 bucketId），并在 plan/DESIGN 里明确作为可选项（需要时再开启）。
- 按最新 review 更新 plan：严格 overlap merge、gap/touch 语义、手工 SQL 测试场景（含 touch 不 merge case）
- 更新 `apps/virtual-exchange/src/series-data/scheduler.ts`：merge CTE 改为严格 overlap；tail 只对真实 gap（`<`）回补，touch 不再触发 tail gap 回补
- 修复 range merge 的 delete+insert CTE 执行顺序风险：改用 `CROSS JOIN (SELECT 1 FROM deleted LIMIT 1)` 强制 inserted 依赖 deleted，避免 touch 段被误删
- 把 `series_data_range` merge 从“全量 delete+insert”改为“差量 compaction（to_delete/to_insert）”，避免 touch 段被误删、也避免依赖 CTE 执行顺序 hack
- 补充 merge 手工测试数据：新增 bulk（overlap/touch/gap）生成 SQL、SQL2 参数化复用、以及 bulk 预期/幂等性验证指引
- 修复 plan.md 的 SQL2 语法错误：移除重复 `WITH`，并让 SQL2 完整参数化（insert/after_s1 都从 `params` 读取 series_id/table_name）
- 把 `apps/virtual-exchange/src/series-data/scheduler.ts` 的 range merge 回填为与重构后实现一致：严格 overlap merge + 差量 compaction（to_delete/to_insert）
- 同步修复 scheduler 的 tail gap 判定：只对真实 gap（`prev.end < next.start`）回补，touch 不再触发 tail
- 修复 tail 队列不带动：在 `scheduler.ts` 的错误/空 range 场景下也会重新 `schedule*`（带 backoff），避免队列被消耗完后进入永久空闲
- 新增定时日志：每 10s 打印 scheduler 的 per-cap queue 状态，便于现场观察
- 在 `scheduler.ts` 的请求时间计算中引入 overlap：每次请求都会与已有覆盖区间重叠，保证 strict overlap merge 能收敛（touch 不再导致碎片爆炸）

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

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

1. 启动 VEX 后观察日志：`[VEX][SeriesData]Queues` 每 `VEX_SERIES_DATA_LOG_QUEUE_INTERVAL_MS`（默认 10s）打印一次，确认 head=0 时 tail 会继续消费（或在 backoff 到期后继续消费）
2. 如日志显示 `tail` 始终 >0 但 `nextEligibleAt` 一直在未来，说明持续被 backoff（需要进一步看 vendor 侧错误/429 或 range 为空原因）
3. 如日志显示 `tail=0` 且 `pending_tail` 也很低，说明调度未入队（需要看 union 边界/needHead 判定以及 vendor 返回的 range）

**注意事项：**

- scheduler 在异常与空 range 场景下会自动重新入队（带 backoff），避免队列耗尽后永久空闲。
- `VEX_SERIES_DATA_LOG_QUEUE_INTERVAL_MS` 可调节队列日志间隔（默认 10s）。

---

_最后更新: 2025-12-25 22:15 by Claude_
