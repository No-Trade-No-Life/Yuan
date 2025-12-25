# VEX series-data 调度器（OHLC/InterestRate）+ ohlc_v2 迁移

## 目标

在 virtual-exchange 新增 series-data 调度器，自动调度各 vendor 的 IngestOHLC/IngestInterestRate 进行拉新与回补，并改造 @yuants/exchange 的 OHLC 写库到新表 ohlc_v2（含 migration 与索引）。

## 要点

- 对齐 vendors-ingest-ohlc-interest-rate 与 @yuants/exchange ingest contract（time+direction、schema->metadata 解析、range 语义）
- 在 VEX 内发现所有 IngestOHLC/IngestInterestRate 服务并建立能力分组/实例池
- 调度策略：head 优先（接近 now），tail 在 head 空闲时回补（基于 series_data_range 段与边界推进），失败 backoff（限流主要由 vendor 兜底）
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

> [REVIEW:blocking] 选择方案 A。需要谨慎设计限流方案，防止启动时打爆 DB 或 Vendor 接口，这个你设计好之后写在这个文件里让我 review，其实重点在于了解上游 Vendor 的承载能力和 DB 的性能瓶颈。如果无法了解，那么就在 vendor 的 serviceOptions 中添加限流参数（你去了解一下 IServiceOptions 的设计）（DEPRECATED）
>
> [RESPONSE] 收到：选方案 A。
> 我会把限流/背压设计补全写进 plan.md，重点保证“启动不打爆 + 不无限积压”：
>
> - VEX 侧：全局并发上限 + per-(table_name, product_id_prefix, direction, duration?) 的串行 runner；对 job 去重（每个 series 的 head/tail 各最多 1 个 pending）；用 nextEligibleAt/backoff 控制重试。
> - 扫描 product 表：按 prefix 分批拉取（cursor/limit），渐进 enqueue，而不是一次性把所有 series 入队。
> - Vendor 侧兜底：会评估在各 vendor 的 `provideOHLCService/provideInterestRateService` 里补上 `serviceOptions`（`IServiceOptions.concurrent/ingress_token_capacity/egress_token_capacity/max_pending_requests`）做硬限流；VEX 收到 `IResponse.code=429/503` 走退避。
>   同时我会在文档里写清默认参数与可调 env。
>   [STATUS:resolved]

> [REVIEW] 我觉得这个有些复杂，需要配置的东西有点多，vendor 侧可以兜底的情况下，暂时不需要在 VEX 侧做太复杂的限流设计。再加上 head 和 tail 的优先级不同，可以一次性全部入队，然后在 vendor 限制的情况下，VEX 逻辑就可以很简单了，不做这个复杂的限流设计。
>
> [RESPONSE] 接受。按你的建议收敛：VEX 侧不做复杂限流/渐进扫描设计，启动时可一次性枚举并入队所有目标 series；节奏控制主要依赖 vendor 侧 `serviceOptions` 兜底 + VEX 侧对错误做 backoff。plan.md 我会把 2.1/3.1 的“复杂限流/扫描游标”改成简化版本，保留 head 优先 + tail 在 head 空闲时执行的基本策略。
> [STATUS:resolved]

#### 2.1) 扫描策略（避免启动抖动）

- 简化：假设 `product_id` 规模不大，启动时对每个 capability 直接全量扫描一次 `product` 表并枚举出所有目标 series，一次性入队（head 优先）。
  - `SELECT product_id FROM product WHERE product_id LIKE '${prefix}%' ORDER BY product_id ASC;`
  - OHLC：`product_id × duration_list`；InterestRate：`product_id`
- InterestRate 固定过滤：`AND COALESCE(no_interest_rate, false) = false`
- 若后续规模增大导致启动抖动，再引入游标/批量/渐进 enqueue（不在本设计范围）

### 3) 调度算法（head 优先 + tail 回补）

- 每个 series 维护 `ranges[]`（由 `series_data_range` merge 后得到）与 `union` 外包框（`min(start), max(end)`）；**union 不代表连续覆盖**
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
- **每次请求都带 overlap**：由于 range merge 采用“严格 overlap（`prev.end_time > next.start_time`）才合并”，调度器会把 `time` 锚点主动往已有覆盖区间内部偏移一段 `overlapMs`（backward 往未来偏移、forward 往过去偏移），确保每次写入的 range 与已有 range 有重叠，从而 range 能稳定收敛（允许重复写入，依赖唯一键/`ON CONFLICT` 吸收）。
- 并发：
  - per-group 串行（避免同一能力对同一 vendor “抢同一资源”）
  - 全局并发上限（避免 VEX 自己把 DB/vend or 打爆）
  - 失败 backoff（失败不推进边界，不写 range 合并；仅记录并退避）

> [REVIEW] 这个调度算法看起来不错。最后的并发控制全局并发上限要保证待调度的任务不会越积越多 (DEPRECATED)
>
> [RESPONSE] 接受。全局并发上限会配合“队列去重 + 渐进扫描 + 速率限制”来保证不会越积越多：
>
> - head 优先但限量（每轮只补齐到一个目标 lag，超额不继续加速）
> - tail 只在 head backlog 低于阈值时才发起（真正闲暇才回补）
> - 每个 series 的 pending 有上限（避免无限堆积）
>   我会在 plan.md 补上明确的背压规则与参数。
>   [STATUS:resolved]

> [REVIEW] 我现在认为不用做复杂的限流设计了，vendor 侧兜底就好。VEX 侧只需要做 head 优先，然后 tail 在 head 队列比较空闲的时候再去处理就好了。这样设计起来会简单很多。
>
> [RESPONSE] 接受。VEX 侧只保留最小策略：head 优先；tail 仅在 head 队列较空闲时才执行；失败（含 429/503/超时）统一 backoff。其余限流交给 vendor 侧 `serviceOptions`。我会在 plan.md 删除/弱化“全局并发/扫描背压/复杂可配置项”的描述。
> [STATUS:resolved]

> [REVIEW] 有一点需要强调，对于 head 和 tail 各自来说，我们希望每个 series 能够被公平调度，保证不会有某个 series 被长期饿死。
>
> [RESPONSE] 接受。实现上用“每个 series 每种 job 最多 1 个 pending”的去重规则来保证 head/tail 各自的公平性：
>
> - 入队：`pendingHead/pendingTail` 为 true 时不重复 enqueue，因此同一 series 不会在队列里堆出一长串任务。
> - 出队：job 执行开始即清掉 pending；如果执行后仍需要继续（head 仍落后 / tail 仍需回补），会把该 series 的下一次 job 重新 enqueue 到队尾。
> - 结果：headQueue/tailQueue 在稳态下近似 round-robin（先来的先执行，执行完再排队），不会出现某个 series 长期霸占队首导致其他 series 饿死。
>
> 补充：能力扫描也做轮转（`scanIndex` 旋转），避免某个 `product_id_prefix` 长期占用扫描与入队机会。
> [STATUS:resolved]

#### 3.1) 限流与背压（关键）

简化：仍然不做“精细 token bucket/复杂预算系统”，但根据 review 结论引入 **per-capability 分桶调度**（每个 capability 各自 head/tail 队列 + cap 级串行），让节奏控制更稳定、可观测、且不会被单个 capability 拖垮整体。

- **分桶（capability）**：每个 capability 各自维护 `headQueue`/`tailQueue`，cap 内串行执行（`inflight=1`）
- **优先级**：cap 内 head 永远优先；tail 仅在 head backlog 低时执行（避免影响新鲜度）
- **跨 cap 公平**：cap 轮询（round-robin）选择下一个可执行 cap，避免某个 cap 长期霸占
- **去重**：每个 series 的 head/tail 在各自 cap 队列中各最多 1 个 pending（避免无限堆积重复任务）
- **错误处理**：429/503/超时等错误触发 **cap 级 backoff**（只暂停该 cap），其余 cap 不受影响
- **Vendor 兜底**：vendor 侧 `serviceOptions` 依然保留，作为最终兜底（并发/排队/速率）

##### 3.1.4) TokenBucket（如需进一步限速，优先复用 `@yuants/utils`）

如果实际运行中“cap 内串行 + cap 级 backoff”仍不足以抑制 429（例如 vendor 有严格 QPS 限制），VEX 侧可在 cap 粒度增加 **最小限速**，并明确约束：**不得自造 token bucket，实现必须复用 `@yuants/utils` 的 `tokenBucket`**：

- 模块：`@yuants/utils`：`tokenBucket(bucketId, { capacity, refillInterval, refillAmount })`
- 作用：在执行每个 cap job 前先 `await capTokenBucket.acquire(1)`，形成 cap 级 QPS 上限
- bucketId 推荐：`encodePath('series-data', capKey)`（保证同 cap 共享）

注意：这属于“需要时再开启”的可选项，不纳入默认路径，避免把第一版调度逻辑变复杂。

##### 3.1.1) capability key 与队列结构（per-capability 分桶）

capability key（按 review 最终确认）：

- `capKey = encodePath(method, product_id_prefix, direction)`（不包含 OHLC 的 duration_list，避免能力变更导致 capKey 迁移/队列重建）

cap state（概念结构）：

- `capState.headQueue`：FIFO，元素为 `{ seriesKey, kind:'head' }`
- `capState.tailQueue`：FIFO，元素为 `{ seriesKey, kind:'tail' }`
- `capState.pendingHead/pendingTail`：用于 cap 内按 series 去重
- `capState.inflight`：cap 内串行（固定 1）
- `capState.nextEligibleAt/backoff_ms`：cap 级退避（429/503/超时只暂停该 cap）

##### 3.1.2) 调度伪代码（cap 轮询 + cap 内 head 优先）

核心：cap 轮询选桶，桶内串行执行，桶内 head 优先、tail 次之。

- enqueue（扫描/状态更新后触发）：
  - `needHead(series)` → enqueue 到 `cap.headQueue`
  - else if `needTail(series)` → enqueue 到 `cap.tailQueue`
- dequeue（tick）：
  - 轮询找到第一个满足 `cap.inflight==0 && cap.nextEligibleAt<=now` 的 cap
  - 若 cap 有 head job：执行 head
  - 否则若允许 tail（`globalHeadBacklog < TAIL_ONLY_WHEN_HEAD_BELOW` 且/或 `cap.headQueue.size()` 很小）：执行 tail
  - 若 cap 失败（429/503/超时）：只更新该 cap 的 backoff，并跳过一段时间；其他 cap 继续运行

##### 3.1.3) Peek 可观测（per-capability）

`VEX/SeriesData/Peek` 需要能回答：哪个 cap 在忙/在退避/队列积压多少。因此新增（至少）：

- 全局：`global_inflight`、`cap_count`、`global_head_backlog`、`global_tail_backlog`
- cap 列表（可截断 top N）：`capKey`、`head_queue_size`、`tail_queue_size`、`inflight`、`backoff_ms`、`nextEligibleAt`

> [REVIEW] 我认为应该为每个 capability 维护一套 headQueue 和 tailQueue，这样可以更好地控制每个 capability 的调度节奏，防止某个 capability 因为请求过多而影响到其他 capability 的调度。而且目前看来我们的实现给 vendor 侧兜底的能力有限，还是需要在 VEX 侧做一些限流设计，以保证系统的稳定性。你甚至可以参考 series-data-collector 的设计，它是一个稳定能 work 的实现，可以借鉴一些思路。
>
> [RESPONSE] 接受。采用全量 per-capability 的 headQueue/tailQueue，并参考 `series-data-collector` 的“分桶调度”思路；cap key 采用 `encodePath(method, product_id_prefix, direction)`，cap 内串行 `inflight=1`，失败退避只影响该 cap；cap 轮询保证跨 cap 公平。
> [STATUS:resolved]

> [REVIEW] 全量，我认为代码量不会增加很多，你可能需要一个 mapCapToQueue 来维护每个 cap 的 head 和 tail queue
>
> [RESPONSE] 接受并确认实现细节：`mapCapToQueue`/`Map<capKey, capState>` 维护每个 cap 的 head/tail queue；cap key 采用 `encodePath(method, product_id_prefix, direction)`；cap 内串行 `inflight=1`。
> [STATUS:resolved]

> [REVIEW] 我重新思考了一下，在 product_id 整体规模不是很大的情况下，不需要做这么复杂的限流设计。VEX 侧只需要做 head 优先，然后 tail 在 head 队列比较空闲的时候再去处理就好了。这样设计起来会简单很多。只要针对 vendor 返回的的错误做退避就好了。
>
> [RESPONSE] 接受。基于“product_id 规模不大”的假设，VEX 侧不做渐进扫描/复杂背压：一次性枚举入队即可；运行期只做 head 优先 + tail 在 head 空闲时执行；对 vendor 错误做退避即可。plan.md 会按此重写 2.1/3.1。
> [STATUS:resolved]

#### 3.2) 缺口回补（gap）— 基于 `series_data_range`（信任 vendor range 语义）

核心前提：信任 vendor 写入的 `series_data_range` 语义正确 —— **单条 range 内没有 gap**。但同 `(series_id, table_name)` 会写入多条 range，因此需要显式区分：

- merge：只在严格 overlap（`prev.end_time > next.start_time`）时合并（用于碎片收敛）
- gap：只在严格缺口（`prev.end_time < next.start_time`）时认为存在（用于调度回补）
- touch：`prev.end_time = next.start_time` 不 merge，但也不算 gap（仍视为连续覆盖）

gap 判定（在 merge 后的 ranges 上）：

- 对同 `(series_id, table_name)`，将 ranges 按 `start_time ASC` 排序；
- 若存在 `prev.end_time < next.start_time`，则两段之间存在 gap（严格缺口）；
- 若 `prev.end_time >= next.start_time`（touch 或 overlap），则不存在 gap（注意：touch 不会被 merge，但也不需要回补）。

回补策略（把 gap 当作 tail 来处理，不需要单独队列）：

- 目标：每次优先回补“距离 now 最近”的 gap（即右侧 range 的 `end_time` 最大的那一个 gap）。
- `direction=backward`：
  - 找到 `end_time` 最大的那段 range（最靠近 now），取其 `start_time` 作为 tail 的 `time`，向过去拉取以填补左侧 gap；
  - 当该 gap 不再满足 `prev.end_time < next.start_time`（即变成 touch/overlap），即认为该 gap 已补齐（不要求 merge 成一段）。
- `direction=forward`：
  - 取“最靠近 now 的 gap”的左侧 range 的 `end_time` 作为 `time`，向未来拉取以填补右侧 gap；
  - “补齐”判据同上（不要求 merge 成一段）。

### 4) series_data_range 合并（transaction）

合并目标：对同一 `(series_id, table_name)` 收敛为尽可能少的 range 记录，防止长时间运行后表爆炸。

算法（内存 merge）：

1. `SELECT ... FOR UPDATE` 读出该 key 的全部 range（锁粒度在单 key）
2. 按 `start_time ASC` 排序，线性 merge：
   - 若 `next.start_time < current.end_time`（严格 overlap）则合并为 `[current.start_time, max(current.end_time, next.end_time)]`
3. `DELETE` 原有行，`INSERT` 合并后的行（同一 transaction 内）

判定（按 review 口径）：只在严格 overlap（`prev.end_time > next.start_time`）时合并；touch（`=`）不合并。

> [REVIEW] 为了这个合并操作的性能，你可以加索引或者加一个 uuid 的 id 字段
>
> [RESPONSE] 倾向加索引而不是加 uuid id：目前 `series_data_range` 的 PK `(series_id, table_name, start_time, end_time)` 已经能支持按 `(series_id, table_name)` 的范围查询与 `ORDER BY start_time`；如实际查询路径以 `table_name` 为前缀，也已有 `idx_series_data_range_table_name_series_id_start_time`。
> 我会在 plan.md 明确 merge 查询使用的 where/order 以命中索引；如后续压测确认瓶颈再追加一个更贴合 merge 的索引（仍保持幂等 migration）。
> [STATUS:resolved]

> [REVIEW] 很好，这就是一个 SQL 能解决的事情，然后我强调一下合并的逻辑：我们只要发现了两个 range 之间比如 [s1, e1], [s2, e2] 的情况下 e1 > s2 就认为可以合并，认为一个 range 中是没有 gap 的
>
> [RESPONSE] 接受。range merge 的判定明确为严格 overlap：当相邻两段满足 `prev.end_time > next.start_time` 才合并；`prev.end_time = next.start_time`（touch）不合并。并约定“单条 range 内无 gap”，gap 只在 `prev.end_time < next.start_time` 时成立。
> [STATUS:resolved]

补充：merge 查询建议形态（命中 PK 索引）：

- `SELECT start_time, end_time FROM series_data_range WHERE series_id = $1 AND table_name = $2 ORDER BY start_time ASC FOR UPDATE`

#### 4.1) 手工 SQL 测试场景（用于验证 merge 行为）

你可以用下面两条 SQL 在数据库里手工验证：

- merge 是否把重叠区间收敛为更少段（touch 不会被 merge）
- merge 是否会影响其他 `series_id`（不应该）
- “删除旧的写入新的”是预期行为（compaction），最终覆盖范围不丢

**SQL 1：准备数据（建议先清理同名 test key，避免污染）**

```sql
DELETE FROM series_data_range
	WHERE
		series_id IN ('__merge_test_s1__', '__merge_test_s2__', '__merge_test_bulk__')
		AND table_name = 'ohlc_v2';

INSERT INTO series_data_range (series_id, table_name, start_time, end_time) VALUES
  -- s1: overlap -> merge 成 [00:00, 02:00]
  ('__merge_test_s1__', 'ohlc_v2', '2025-01-01T00:00:00Z', '2025-01-01T01:30:00Z'),
  ('__merge_test_s1__', 'ohlc_v2', '2025-01-01T01:00:00Z', '2025-01-01T02:00:00Z'),
  -- s1: overlap -> merge 成 [03:00, 05:00]
  ('__merge_test_s1__', 'ohlc_v2', '2025-01-01T03:00:00Z', '2025-01-01T04:30:00Z'),
  ('__merge_test_s1__', 'ohlc_v2', '2025-01-01T04:00:00Z', '2025-01-01T05:00:00Z'),
  -- s1: touch -> 不 merge（仍是两段）
  ('__merge_test_s1__', 'ohlc_v2', '2025-01-01T06:00:00Z', '2025-01-01T07:00:00Z'),
  ('__merge_test_s1__', 'ohlc_v2', '2025-01-01T07:00:00Z', '2025-01-01T08:00:00Z'),
  -- s2: 不应被影响
  ('__merge_test_s2__', 'ohlc_v2', '2025-01-01T10:00:00Z', '2025-01-01T11:00:00Z');
```

**SQL 1b：生成更多测试数据（bulk，用于覆盖 overlap/touch/gap 三种形态）**

```sql
INSERT INTO series_data_range (series_id, table_name, start_time, end_time)
SELECT series_id, table_name, start_time, end_time
FROM (
  -- overlap: 50 段，每段 20min，start 每 10min 递增 -> 最终应 merge 成 1 段
  SELECT
    '__merge_test_bulk__' AS series_id,
    'ohlc_v2' AS table_name,
    ('2025-01-02T00:00:00Z'::timestamptz + make_interval(mins => i * 10)) AS start_time,
    ('2025-01-02T00:00:00Z'::timestamptz + make_interval(mins => i * 10 + 20)) AS end_time
  FROM generate_series(0, 49) AS s(i)

  UNION ALL

  -- touch: 24 段，每段 1h，首尾相接 -> touch 不 merge（应仍是 24 段）
  SELECT
    '__merge_test_bulk__' AS series_id,
    'ohlc_v2' AS table_name,
    ('2025-01-03T00:00:00Z'::timestamptz + make_interval(hours => i)) AS start_time,
    ('2025-01-03T00:00:00Z'::timestamptz + make_interval(hours => i + 1)) AS end_time
  FROM generate_series(0, 23) AS s(i)

  UNION ALL

  -- gap: 12 段，每段 1h，start 每 2h 递增 -> 存在严格缺口（应仍是 12 段）
  SELECT
    '__merge_test_bulk__' AS series_id,
    'ohlc_v2' AS table_name,
    ('2025-01-04T00:00:00Z'::timestamptz + make_interval(hours => i * 2)) AS start_time,
    ('2025-01-04T00:00:00Z'::timestamptz + make_interval(hours => i * 2 + 1)) AS end_time
  FROM generate_series(0, 11) AS s(i)
) AS x
ORDER BY random()
ON CONFLICT DO NOTHING;
```

**SQL 2：执行 merge（等价于当前实现的 CTE），并同时输出 before/after + 其他 series**

```sql
WITH params AS (
  SELECT '__merge_test_bulk__'::text AS series_id, 'ohlc_v2'::text AS table_name
),
locked AS (
  SELECT series_id, table_name, start_time, end_time
  FROM series_data_range
  WHERE (series_id, table_name) IN (SELECT series_id, table_name FROM params)
  ORDER BY start_time ASC, end_time ASC
  FOR UPDATE
),
ordered AS (
  SELECT
    start_time,
    end_time,
    max(end_time) OVER (
      ORDER BY start_time ASC, end_time ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_end
  FROM locked
),
marks AS (
  SELECT
    start_time,
    end_time,
    running_end,
    CASE
      WHEN start_time >= COALESCE(
        lag(running_end) OVER (ORDER BY start_time ASC, end_time ASC),
        '-infinity'::timestamptz
      ) THEN 1
      ELSE 0
    END AS is_new_group
  FROM ordered
),
groups AS (
  SELECT
    start_time,
    end_time,
    sum(is_new_group) OVER (
      ORDER BY start_time ASC, end_time ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS grp
  FROM marks
),
merged AS (
  SELECT min(start_time) AS start_time, max(end_time) AS end_time
  FROM groups
  GROUP BY grp
),
to_delete AS (
  SELECT l.series_id, l.table_name, l.start_time, l.end_time
  FROM locked l
  WHERE NOT EXISTS (
    SELECT 1
    FROM merged m
    WHERE m.start_time = l.start_time AND m.end_time = l.end_time
  )
),
deleted AS (
  DELETE FROM series_data_range t
  USING to_delete d
  WHERE
    t.series_id = d.series_id
    AND t.table_name = d.table_name
    AND t.start_time = d.start_time
    AND t.end_time = d.end_time
  RETURNING 1
),
to_insert AS (
  SELECT m.start_time, m.end_time
  FROM merged m
  WHERE NOT EXISTS (
    SELECT 1
    FROM locked l
    WHERE l.start_time = m.start_time AND l.end_time = m.end_time
  )
),
inserted AS (
  INSERT INTO series_data_range (series_id, table_name, start_time, end_time)
  SELECT p.series_id, p.table_name, i.start_time, i.end_time
  FROM to_insert i
  CROSS JOIN params p
  ON CONFLICT DO NOTHING
  RETURNING 1
),
after_s1 AS (
  SELECT start_time, end_time
  FROM series_data_range
  WHERE (series_id, table_name) IN (SELECT series_id, table_name FROM params)
  ORDER BY start_time ASC, end_time ASC
),
after_s2 AS (
  SELECT start_time, end_time
  FROM series_data_range
  WHERE series_id = '__merge_test_s2__' AND table_name = 'ohlc_v2'
  ORDER BY start_time ASC, end_time ASC
)
SELECT 'before_s1' AS tag, start_time, end_time FROM locked
UNION ALL
SELECT 'after_s1' AS tag, start_time, end_time FROM after_s1
UNION ALL
SELECT 'after_s2' AS tag, start_time, end_time FROM after_s2
ORDER BY tag, start_time ASC;
```

预期：

- `before_s1` 为 6 行碎片
- `after_s1` 为 4 行：`[00:00,02:00]`、`[03:00,05:00]`、`[06:00,07:00]`、`[07:00,08:00]`（touch 不 merge）
- `after_s2` 仍为 1 行（未被影响）

补充验证（bulk）：

- 把 SQL2 的 `params.series_id` 改为 `__merge_test_bulk__`，执行一次 merge 后：
  - overlap 那组应收敛为 1 段：`[2025-01-02T00:00:00Z, 2025-01-02T08:30:00Z]`
  - touch 那组仍是 24 段
  - gap 那组仍是 12 段
  - 总计应为 `1 + 24 + 12 = 37` 段
- 再执行一次同样的 SQL2（同 params），结果应不再变化（幂等）。

> [REVIEW] 当有 [s1, e1], [s2, e2] 两个 range 的时候，只有 e1 > s2 才认为可以合并，仅仅是 e1 = s2 的话不认为可以合并
>
> [RESPONSE] 接受，并按你的口径修正：range 的合并条件改为严格 overlap —— 只有 `prev.end_time > next.start_time` 才 merge；`prev.end_time = next.start_time` 不 merge。
>
> 同时为了避免“touch 不 merge”导致调度器把相邻段误判为 gap，我会在设计里明确区分：
>
> - merge：只在 overlap（`>`）时发生
> - gap：只在严格缺口（`prev.end_time < next.start_time`）时认为存在
> - touch（`=`）：不 merge，但也不算 gap（仍视为连续覆盖）
>
> 我会据此更新 plan.md 的 gap 判定与 SQL 测试场景，并在 `apps/virtual-exchange/src/series-data/scheduler.ts` 里把 merge CTE 的分组条件同步改成严格版。
> [STATUS:resolved]

> [REVIEW] 我执行完毕之后 -- s1: touch -> 不 merge（仍是两段）
> ('**merge_test_s1**', 'ohlc_v2', '2025-01-01T06:00:00Z', '2025-01-01T07:00:00Z'),
> ('**merge_test_s1**', 'ohlc_v2', '2025-01-01T07:00:00Z', '2025-01-01T08:00:00Z'),
> 消失了，被删除了，这是不对的，你修复一下。
>
> [RESPONSE] 已修复：根因是全量 `DELETE locked` + `INSERT merged` 的 compaction 流程会“把原本不需要变的段也删掉再插回”，在实践里仍可能出现段被误删。最终方案改为“差量 compaction”（见后续 R17 的结论）：只 delete `locked - merged`，只 insert `merged - locked`，touch 段会既不删也不插，因此不会消失。SQL2 与 `apps/virtual-exchange/src/series-data/scheduler.ts` 已按该方案更新。
> [STATUS:resolved]

> [REVIEW] 还是被删没了，你要不别逞强了，我们就给 series_data_range 加一个 uuid 主键好了，反正这个表也不会特别大。
>
> [RESPONSE] 你说得对：之前那种“整组 rows 全 delete 再 insert（即使某些段不需要变）”在实践里确实容易踩坑，touch 段虽然理论上应该被 re-insert，但仍可能出现被删没（你复现的就是这个情况）。
>
> 我这次不再依赖 CTE 执行顺序 hack，也不需要加 uuid 主键：把 merge 改成“差量 compaction”。
>
> 具体修复：
>
> - 先算出 `merged`
> - `to_delete = locked - merged`：只删除那些不在 merged 结果里的旧段
> - `to_insert = merged - locked`：只插入那些 merged 结果里新增的段
>
> 这样 touch 段因为本来就在 merged 里且也在 locked 里，会既不删也不插，自然不会消失。
>
> 已同步更新：
>
> - plan 里的 SQL2（你再跑一次同样场景，touch 两段会保留）
> - `apps/virtual-exchange/src/series-data/scheduler.ts` 的 `mergeRangesAndGetUnion` 实现
>   [STATUS:resolved]

> [REVIEW] 好的，现在没问题了，多生成一些测试数据，确保没有问题
>
> [RESPONSE] 已按你的要求补充“更多测试数据 + 更强覆盖面”的手工 SQL：
>
> - 新增 `SQL 1b`：批量生成 overlap/touch/gap 三类数据到 `__merge_test_bulk__`（用于覆盖大量段、乱序插入、三种形态的预期行为）。
> - `SQL 2` 改为带 `params`，你只需要改 `params.series_id` 就能复用同一条 merge SQL 去测 `__merge_test_s1__` / `__merge_test_bulk__`。
> - 补充 bulk 的预期结果：merge 后应为 37 段（overlap 收敛为 1 段，touch 24 段不 merge，gap 12 段不 merge），并建议重复执行同一 SQL2 做幂等性验证。
>   [STATUS:resolved]

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
- VEX 调度：不做复杂限流；head 优先；tail 在 head 空闲时执行；对 vendor 错误做 backoff；限流主要由 vendor `serviceOptions` 兜底
- gap 回补：信任 vendor 写入的 `series_data_range` range 语义（单段无 gap），gap 只在 `prev.end_time < next.start_time` 时成立；touch（`=`）不算 gap；回补后只要 gap 消失即可，不要求 merge 成一段
- range merge：只在 overlap（`prev.end_time > next.start_time`）时合并；touch（`=`）不合并
- ohlc_v2：只建表并切换写入，不搬迁历史、不双写
- series_id 编码：按 review 改为 `${product_id}/${duration}`（OHLC）与 `product_id`（InterestRate），并在数据包中提供 encode/decode helper（作为 encodePath 的显式例外）

_创建于: 2025-12-22 | 最后更新: 2025-12-25_
