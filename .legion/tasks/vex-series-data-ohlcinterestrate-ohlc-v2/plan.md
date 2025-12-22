# VEX series-data 调度器（OHLC/InterestRate）+ ohlc_v2 迁移

## 目标

在 virtual-exchange 新增 series-data 调度器，自动调度各 vendor 的 IngestOHLC/IngestInterestRate 进行拉新与回补，并改造 @yuants/exchange 的 OHLC 写库到新表 ohlc_v2（含 migration 与索引）。

## 要点

- 对齐 vendors-ingest-ohlc-interest-rate 与 @yuants/exchange ingest contract（time+direction、schema->metadata 解析、range 语义）
- 在 VEX 内发现所有 IngestOHLC/IngestInterestRate 服务并建立能力分组/实例池
- 调度策略：优先拉新（接近 now），闲暇回补（根据 series_data_range 向过去推进），包含全局/分组并发限制与 backoff
- series_data_range 同 (series_id, table_name) 重叠区间在 transaction 中可合并，避免范围碎片爆炸
- @yuants/exchange: OHLC_INSERT_COLUMNS 移除 datasource_id/product_id/duration；写入新表 ohlc_v2；并写 migration（series_id+created_at 索引）
- 若调度所需信息不足，提出最小新增 metadata（schema 非必填 const 字段）供 review

## 范围

- apps/virtual-exchange/src/index.ts
- apps/virtual-exchange/src/(new) series-data/\*
- libraries/exchange/src/ohlc.ts
- tools/sql-migration/sql/ohlc_v2.sql
- tools/sql-migration/sql/series_data_range.sql（可能仅新增索引/不改表结构）

## 阶段概览

1. **调研与对齐** - 2 个任务
2. **设计（先评审）** - 4 个任务
3. **实现** - 2 个任务
4. **验证与交接** - 1 个任务

---

## 调研结论（摘要）

### 1) Ingest 服务 contract（已存在）

- `IngestOHLC`：request = `{ product_id, duration, direction, time }`；`direction` 为 schema const；service 侧写入 `ohlc` + `series_data_range`
- `IngestInterestRate`：request = `{ product_id, direction, time }`；`direction` 为 schema const；service 侧写入 `interest_rate` + `series_data_range`
- `series_id` 约定（按最新 review 修订）：
  - OHLC：`encodeOHLCSeriesId(product_id, duration)`（等价 `${product_id}/${duration}`，decode 从末尾取 duration）
  - InterestRate：`encodeInterestRateSeriesId(product_id)`（等价 `product_id`）
- VEX 可通过 `terminalInfos$` 发现服务，并通过 schema 解析出 `product_id_prefix` / `duration_list` / `direction`（目前就是从 schema 的 `pattern/enum/const` 派生）

> [REVIEW] 这部分可以参考 virtual-exchange/src/quote/scheduler.ts 的服务发现逻辑
>
> [RESPONSE] 接受。series-data 的服务发现会直接复用 `apps/virtual-exchange/src/quote/scheduler.ts` 的模式：订阅 `terminal.terminalInfos$`，从 `serviceInfo` 里筛选 `method==='IngestOHLC'|'IngestInterestRate'`，并用 `parseOHLCServiceMetadataFromSchema`/`parseInterestRateServiceMetadataFromSchema` 解析能力。对应内容我会合并到“调研结论/模块结构”段落里。
> [STATUS:resolved]

### 2) VEX 侧可复用模式

- `apps/virtual-exchange/src/quote/scheduler.ts` 已实现：服务发现 -> 分组 -> per-service runner + FIFO 队列 +（隐式）全局并发控制
- `TerminalClient` 会按 schema 匹配候选服务；第一版调度器使用 `terminal.client.requestForResponse`/`requestForResponseData` 走随机负载均衡，不做“指定实例/指定 service_id”调度

> [REVIEW] 目前还不支持显式调度到指定实例，就还是用 `terminal.client.requestForResponse` 即可，同一个服务的负载均衡不是目前的重点
>
> [RESPONSE] 接受。第一版不做“显式调度到指定实例/指定 service_id”，统一用 `terminal.client.requestForResponse`/`requestForResponseData` 走现有候选服务的随机负载均衡；调度器只负责控制请求节奏（全局并发+去重+背压）。我会在 plan.md 同步删除/弱化“显式选择 (terminal_id, service_id)”的表述，并在 context.md 更新相应决策。
> [STATUS:resolved]

### 3) DDL 现状

- `series_data_range`：主键 `(series_id, table_name, start_time, end_time)`，允许“持续 append 多段 range”；不做合并会导致碎片膨胀
- `ohlc`：包含 `datasource_id/product_id/duration`，但这些信息已被 `series_id` 编码覆盖，存在冗余写入与存储

> [REVIEW:blocking] ohlc 的 series_id 目前是使用 encodePath(product_id, duration)，我们修改一下，直接使用 [product_id, duration].join('/)，datasource id 字段已经被废弃，然后在 @yuants/data-ohlc 中添加 encodeOHLCSeriesId 和 decodeOHLCSeriesId 方法。InterestRate 同理。
>
> [RESPONSE] 接受（并记录为覆盖仓库默认 encodePath 的例外）。具体实现计划：
>
> - OHLC：`series_id = product_id + '/' + duration`（等价于 `[product_id, duration].join('/')`），并在 `@yuants/data-ohlc` 新增 `encodeOHLCSeriesId`/`decodeOHLCSeriesId`（decode 从末尾取最后一个 segment 为 duration，其余拼回 product_id，避免 product_id 自身含 `/` 的歧义）。
> - InterestRate：`series_id = product_id`，并在 `@yuants/data-interest-rate` 增加 `encodeInterestRateSeriesId`/`decodeInterestRateSeriesId`（基本是 identity + 末端 decode 兼容）。
> - `@yuants/exchange` 与 VEX 调度侧统一改用这些 helper，避免散落的 join/split。
>   我会在 plan.md 增加“兼容/切换影响”说明（旧 series_id 数据是否保留/是否需要兼容读）。
>   [STATUS:resolved]

---

## 方案草案（供 review）

### 1) series-data 模块职责与文件组织（建议）

- 第一版对齐 `apps/virtual-exchange/src/quote/scheduler.ts` 的组织方式：先集中在一个调度文件里，避免过早拆分。
  - `apps/virtual-exchange/src/series-data/scheduler.ts`：服务发现 + series 枚举 + head/tail 调度 + range merge（必要时再拆）
  - `apps/virtual-exchange/src/series-data/index.ts`：启动入口（由 `apps/virtual-exchange/src/index.ts` import）

> [REVIEW] 我认为应该参考 virtual-exchange/src/quote/scheduler.ts 的结构来组织代码，保持一致性和可维护性。第一版不需要太多文件，之后有需要再拆分。
>
> [RESPONSE] 接受。第一版代码结构尽量贴近 `apps/virtual-exchange/src/quote/scheduler.ts`：用更少文件（例如 `apps/virtual-exchange/src/series-data/scheduler.ts` + `index.ts` 入口），把 registry/queue/runner 先放一起；等稳定后再按职责拆分。plan.md 我会同步调整“文件组织建议”。
> [STATUS:resolved]

### 2) 目标 series 来源（两种方案）

1. **方案 A：基于 `product` 表全量扫描（已确认采用）**
   - 对每个 provider group：用 `product_id_prefix` 从 `product` 表查 `product_id LIKE '{prefix}%'`
   - OHLC 再与 `duration_list` 做笛卡尔积得到 `(product_id, duration)` -> `series_id`
   - 优点：无需新增配置表；“一上线就能跑起来”
   - 风险：规模可能很大；需要明确过滤/限速策略（避免启动瞬间打爆 vendor / DB）
2. **方案 B：新增配置表（或复用旧 `series_collecting_task` 的子集）**
   - 引入 `series_data_task(series_id, table_name, enabled, priority, max_backfill_age, ...)`
   - 优点：可控、可渐进 rollout
   - 风险：需要额外 DDL + 配置运维流程；本任务会变大

> [REVIEW:blocking] 选择方案 A。需要谨慎设计限流方案，防止启动时打爆 DB 或 Vendor 接口，这个你设计好之后写在这个文件里让我 review，其实重点在于了解上游 Vendor 的承载能力和 DB 的性能瓶颈。如果无法了解，那么就在 vendor 的 serviceOptions 中添加限流参数（你去了解一下 IServiceOptions 的设计）
>
> [RESPONSE] 收到：选方案 A。
> 我会把限流/背压设计补全写进 plan.md，重点保证“启动不打爆 + 不无限积压”：
>
> - VEX 侧：全局并发上限 + per-(table_name, product_id_prefix, direction, duration?) 的串行 runner；对 job 去重（每个 series 的 head/tail 各最多 1 个 pending）；用 nextEligibleAt/backoff 控制重试。
> - 扫描 product 表：按 prefix 分批拉取（cursor/limit），渐进 enqueue，而不是一次性把所有 series 入队。
> - Vendor 侧兜底：会评估在各 vendor 的 `provideOHLCService/provideInterestRateService` 里补上 `serviceOptions`（`IServiceOptions.concurrent/ingress_token_capacity/egress_token_capacity/max_pending_requests`）做硬限流；VEX 收到 `IResponse.code=429/503` 走退避。
>   同时我会在文档里写清默认参数与可调 env。
>   [STATUS:resolved]

#### 2.1) 扫描策略（避免启动抖动）

- 对每个 `(table_name, product_id_prefix, direction, duration?)` 建立一个“扫描游标”：`cursor_product_id`（字符串）+ `batch_size`
- 循环查询（避免 OFFSET）：
  - `SELECT product_id FROM product WHERE product_id LIKE '${prefix}%' AND product_id > ${cursor} ORDER BY product_id ASC LIMIT ${batch_size}`
  - 每取一批，只把“缺口最大/最需要拉新”的 series 进入 head 队列，其余进入“待评估集合”（避免一次性入队全部）
- InterestRate 可选过滤（如果字段存在且你希望启用）：`AND COALESCE(no_interest_rate, false) = false`

### 3) 调度算法（head 优先 + tail 回补）

- 每个 series 维护“已覆盖范围”的 union（由 `series_data_range` merge 后得到）
- **head 拉新**（优先级高）：
  - 目标：保证 `union.end_time` 接近 `now`（允许滞后一个小窗口）
  - 触发：若 `now - union.end_time > threshold` 则 enqueue head job
  - 请求参数（仅依赖 range，不依赖 wrote_count）：
    - `direction=backward`：`time = now`（或 `max(now, union.end_time + ε)`，减少重复）
    - `direction=forward`：`time = union.end_time`（从已知末端继续向未来/当前推进）
- **tail 回补**（低优先级，vendor 闲暇时跑）：
  - 目标：把 `union.start_time` 逐步推向更早
  - 请求参数：
    - `direction=backward`：`time = union.start_time`
    - `direction=forward`：`time = union.start_time - window_ms`（`window_ms` 取最近一次成功 page 的 `range.end_time - range.start_time`，无则回退到固定值）
- 并发：
  - per-group 串行（避免同一能力对同一 vendor “抢同一资源”）
  - 全局并发上限（避免 VEX 自己把 DB/vend or 打爆）
  - 失败 backoff（失败不推进边界，不写 range 合并；仅记录并退避）

> [REVIEW] 这个调度算法看起来不错。最后的并发控制全局并发上限要保证待调度的任务不会越积越多
>
> [RESPONSE] 接受。全局并发上限会配合“队列去重 + 渐进扫描 + 速率限制”来保证不会越积越多：
>
> - head 优先但限量（每轮只补齐到一个目标 lag，超额不继续加速）
> - tail 只在 head backlog 低于阈值时才发起（真正闲暇才回补）
> - 每个 series 的 pending 有上限（避免无限堆积）
>   我会在 plan.md 补上明确的背压规则与参数。
>   [STATUS:resolved]

#### 3.1) 限流与背压（关键）

核心目标：任何时候都保证 pending 数量有上限、扫描是渐进的、失败会退避，避免“任务越积越多”。

- **去重**：对每个 series 维护 `pendingHead`/`pendingTail` 两个布尔位（或一个枚举），同类型 job 最多 1 个 pending
- **全局并发**：`max_inflight`（默认建议从 4/8 起），inflight 达到上限时不继续出队
- **队列策略**：
  - head 队列始终优先；tail 只在 `headQueueSize < threshold` 才出队
  - 每轮扫描最多补齐 `headQueueTargetSize`（避免扫描速度远大于消费速度）
- **错误处理**：
  - 对 `IResponse.code` 为 `429/503`（或超时）统一 backoff（第一版用线性 backoff + 上限即可）
  - backoff 期间该 series 不再入队（通过 `nextEligibleAt` 控制）
- **Vendor 侧硬限流兜底**（如无法预估承载）：在各 vendor 注册 `IngestOHLC/IngestInterestRate` 时补充 `serviceOptions`：
  - `concurrent`：限制处理并发（例如 1~2）
  - `max_pending_requests`：限制排队（例如 10~50）
  - `ingress_token_capacity/ingress_token_refill_interval`：限制入队速率（例如 2 tokens / 1000ms）
  - `egress_token_capacity/egress_token_refill_interval`：限制实际处理速率（例如 1 token / 1000ms）

### 4) series_data_range 合并（transaction）

合并目标：对同一 `(series_id, table_name)` 收敛为尽可能少的 range 记录，防止长时间运行后表爆炸。

算法（内存 merge）：

1. `SELECT ... FOR UPDATE` 读出该 key 的全部 range（锁粒度在单 key）
2. 按 `start_time ASC` 排序，线性 merge：
   - 若 `next.start_time <= current.end_time` 则合并为 `[current.start_time, max(current.end_time, next.end_time)]`
3. `DELETE` 原有行，`INSERT` 合并后的行（同一 transaction 内）

判定（暂定）：只要 overlap 或 touch（`start_time <= end_time`）就合并；避免引入“允许 gap”的主观假设。

> [REVIEW] 为了这个合并操作的性能，你可以加索引或者加一个 uuid 的 id 字段
>
> [RESPONSE] 倾向加索引而不是加 uuid id：目前 `series_data_range` 的 PK `(series_id, table_name, start_time, end_time)` 已经能支持按 `(series_id, table_name)` 的范围查询与 `ORDER BY start_time`；如实际查询路径以 `table_name` 为前缀，也已有 `idx_series_data_range_table_name_series_id_start_time`。
> 我会在 plan.md 明确 merge 查询使用的 where/order 以命中索引；如后续压测确认瓶颈再追加一个更贴合 merge 的索引（仍保持幂等 migration）。
> [STATUS:resolved]

补充：merge 查询建议形态（命中 PK 索引）：

- `SELECT start_time, end_time FROM series_data_range WHERE series_id = $1 AND table_name = $2 ORDER BY start_time ASC FOR UPDATE`

### 5) ohlc_v2（migration + 写库切换）

- 目标：新表 `ohlc_v2` 不含 `datasource_id/product_id/duration` 三列，仅保留事实字段；索引以 `(series_id, created_at)` 为主
- DDL（幂等）：
  - `CREATE TABLE IF NOT EXISTS ohlc_v2 (...) PRIMARY KEY (series_id, created_at)`
  - `CREATE INDEX IF NOT EXISTS idx_ohlc_v2_series_id_created_at ON ohlc_v2 (series_id, created_at DESC)`
  - `updated_at` + trigger：与 `ohlc` 对齐（复用 `update_updated_at_column()`）
- `@yuants/exchange` 改造：
  - `libraries/exchange/src/ohlc.ts`：`OHLC_INSERT_COLUMNS` 移除三列；insert 目标表改为 `ohlc_v2`；对应 `series_data_range.table_name` 也改为 `ohlc_v2`
- 非目标：本任务不做 `ohlc -> ohlc_v2` 历史数据搬迁/双写（如需另开任务）

---

## 已确认的 review 结论（落实到实现）

- series 来源：方案 A（扫描 `product` 表）
- InterestRate：不新增额外 metadata，使用 range 自适应 window/频率
- range merge：只要 overlap/touch（`next.start_time <= current.end_time`）就合并
- ohlc_v2：只建表并切换写入，不搬迁历史、不双写
- series_id 编码：按 review 改为 `${product_id}/${duration}`（OHLC）与 `product_id`（InterestRate），并在数据包中提供 encode/decode helper（作为 encodePath 的显式例外）

_创建于: 2025-12-22 | 最后更新: 2025-12-22_
