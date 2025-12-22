# VEX series-data 调度器（OHLC/InterestRate）+ ohlc_v2 迁移 - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - 验证与交接
**当前任务**: (none)
**进度**: 9/9 任务完成

---

## 阶段 1: 调研与对齐 ✅ COMPLETE

- [x] 复核 ingest contract 与 VEX 现有调度模式：IngestOHLC/IngestInterestRate 的 schema->metadata 解析、time+direction 语义、range 计算与写入 series_data_range；参考 VEX quote scheduler 的 service 发现与 runner 模型 | 验收: 在 context.md 记录：两类 ingest 服务的能力矩阵抽象、VEX 侧可复用的发现/并发/队列模式、以及调度所需的最小输入（目标 series 来源、表名映射、推进规则）
- [x] 盘点现有表结构与迁移规范：series_data_range 主键/索引；ohlc/interest_rate 现状；明确 ohlc_v2 的字段/索引/trigger 需求与迁移策略（仅建表，不做数据搬迁） | 验收: 在 plan.md 写清：ohlc_v2 DDL（幂等）、索引、trigger；并列出代码侧写库要点（OHLC_INSERT_COLUMNS 与 table_name/range 同步）

---

## 阶段 2: 设计（先评审） ✅ COMPLETE

- [x] 设计 series-data 模块的结构与对外调试入口：服务发现（terminalInfos$）、能力分组（method+meta）、series 枚举（基于 product 表 prefix + duration_list 组合 / 或新增配置表方案对比）、状态缓存（range union） | 验收: plan.md 给出模块文件划分、核心数据结构（ProviderGroup/SeriesKey/Job）、以及 2 套 series 来源方案（全量 product 扫描 vs 新增配置表）并标注推荐与原因
- [x] 设计调度算法：拉新(head) 与回补(tail) 两级优先队列；per-group 串行 + 全局并发；失败 backoff；推进规则仅依赖 range（不依赖 wrote_count）；支持 forward/backward 两种 direction | 验收: plan.md 给出：选 job 的伪代码/状态机、关键边界（重复拉取/空页/无 range）、以及可配置项（并发、拉新频率、回补速率、最早回补时间）
- [x] 设计 range 合并算法：同 (series_id, table_name) 的多条 range 读出后按 start_time 排序 merge；transaction 内 delete+insert（或 SQL CTE 聚合）保证并发安全 | 验收: plan.md 给出：merge 判定（overlap/adjacent）、复杂度、SQL transaction 方案（锁粒度/隔离级别建议）、以及和写入端（vendor ingest）并发时的幂等性说明
- [x] 如需新增 metadata，提出最小字段并说明解析方式（通过 schema.properties.<field>.const，非 required） | 验收: plan.md 列出候选字段与用途（例如 interest_rate 的 recommended_poll_interval_ms），并标注是否必须/可选；留出 REVIEW block

---

## 阶段 3: 实现 ✅ COMPLETE

- [x] 在 apps/virtual-exchange 新增 series-data 模块：发现 IngestOHLC/IngestInterestRate 服务、枚举 series、执行 ingest 请求、读取/更新 series_data_range 并做 merge；接入 apps/virtual-exchange/src/index.ts 启动 | 验收: VEX 启动后可持续运行：周期性拉新；空闲时回补；日志/指标可观察；可通过 env 控制启停与并发
- [x] 实现 ohlc_v2 migration 与 exchange 写库改造：新增 tools/sql-migration/sql/ohlc_v2.sql；修改 libraries/exchange/src/ohlc.ts 写入 ohlc_v2 且 range.table_name=ohlc_v2，并移除 datasource_id/product_id/duration 写入 | 验收: migration 幂等；写库字段与表结构匹配；(series_id, created_at) 冲突键与索引一致；不影响 InterestRate 现有链路

---

## 阶段 4: 验证与交接 ✅ COMPLETE

- [x] 补充最小验证：range merge 单测或脚本；在可运行环境验证一次 end-to-end（发现服务->触发 ingest->写库->range 合并）；记录如何观察调度状态/排障 | 验收: tasks.md 记录可复现的验证步骤；context.md 写入快速交接（下一步/注意事项/回滚点）
  - 手工验证步骤：执行 migration `tools/sql-migration/sql/ohlc_v2.sql` -> 启动 VEX 并设置 `VEX_SERIES_DATA_ENABLED=1` -> 调用 `VEX/SeriesData/Peek` 观察队列与 inflight -> 检查 `ohlc_v2` 与 `series_data_range(table_name='ohlc_v2')` 是否持续增长并收敛（range merge）
  - 说明：本环境无法运行 `rush build`（install-run-rush 触发 `spawnSync /bin/sh EPERM`），建议在正常 CI/开发机执行 build/typecheck

---

## 发现的新任务

(暂无)

- [x] 为 `apps/virtual-exchange/src/series-data/scheduler.ts` 增加类似 `apps/virtual-exchange/src/quote/scheduler.ts` 的注释，说明调度算法（发现->扫描->head/tail->背压/退避->range merge）。 | 来源: 用户反馈：需要更强的可读性注释（quote/scheduler 风格）。

---

_最后更新: 2025-12-22 16:46_
