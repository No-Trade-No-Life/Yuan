# Hyperliquid API tokenBucket：按官方限额主动限流

## 目标

在 apps/vendor-hyperliquid 的 REST/WebSocket 请求入口前接入 tokenBucket 主动限流，并按 Hyperliquid 官方 rate limits & user limits 规则选择/扣减对应 bucket，避免触发 429/封禁。

## 要点

- 先调研并复用既有模式：参考 binance-private-api-host-tokenbucket 与 huobi-publicprivate-api-tokenbucket 的 bucket 定义方式、选择矩阵、以及在 request 前 acquire 的插入点
- 限流策略以“保守”为默认：无法识别的 endpoint 走更严格 bucket；并为 429/headers 留出扩展位（可选）
- 设计必须覆盖：bucket 列表（id/窗口/容量/维度 key）、endpoint→bucket 映射、错误/观测策略、以及实现落点（哪些文件/函数）
- 先写 `.legion` 详细设计并等待 review，通过后再改代码
- 保持实现简单直白；避免重复造轮子，优先复用仓库现成 tokenBucket/util

## 范围

- `apps/vendor-hyperliquid/src/**`
- `apps/vendor-binance/src/**`（仅对照阅读，不改）
- `apps/vendor-huobi/src/**`（仅对照阅读，不改）
- .legion/tasks/<new-task>/plan.md
- .legion/tasks/<new-task>/context.md
- .legion/tasks/<new-task>/tasks.md

## 阶段概览

1. **调研** - 1 个任务
2. **设计（先写文档，等待 review）** - 1 个任务
3. **实现** - 1 个任务
4. **验证与交接** - 1 个任务

---

## 设计细节（待 review）

### 0) 规则来源

- 官方文档：`https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits`
- 本次设计只覆盖 Hyperliquid “REST / WebSocket 访问限额”侧的**请求前主动限流**；链上/撮合行为不在这里处理。

### 1) 目标与非目标

目标：

- 对 `https://api.hyperliquid.xyz/*` 的 REST 请求做“请求前主动限流”，使单进程在稳态下不触发 429。
- 对 `exchange` / `info` / `explorer` 这三类 REST 请求实现**官方 weight 计算**，并统一落到同一个“每 IP 聚合”桶。
- 设计要尽量复用仓库既有模式：`tokenBucket` + `scopeError` + 清晰的 bucketId 命名。

非目标（先不做，或只做 best-effort）：

- **分布式/多副本全局限流**：当前 `tokenBucket` 为进程内实现；多实例会按实例数放大吞吐（与其他 vendor 现状一致）。
- **address-based 动态额度的精确实现**：需要依赖“累计成交 USDC / 初始 buffer”等用户状态，现阶段先把接口与扩展点设计好，具体实现等你确认范围后再落地。

### 2) REST：每 IP 聚合桶

官方规则：REST requests share an aggregated weight limit of **1200 per minute per IP**。

设计：

- bucketId：`HYPERLIQUID_REST_IP_WEIGHT_1200_PER_MIN`
- 参数：`capacity=1200`，`refillInterval=60_000`，`refillAmount=1200`
- 所有发往 `api.hyperliquid.xyz` 的 REST 请求（`/info`、`/exchange`、`/explorer`、以及未来可能的其他 path）都要在发起前从该桶扣减 weight。

### 3) REST weight 计算（请求前可计算部分）

#### 3.1 `exchange`（`POST /exchange`）

官方规则：所有 documented `exchange` API requests weight = `1 + floor(batch_length / 40)`。

- `batch_length` 的定义：action 内数组长度（例如 order 的 `orders.length`、cancel 的 `cancels.length`）。
- 若 action 不包含数组（例如 modify 单笔），按 `batch_length=1` 处理。

> 备注：该 weight 仅用于 **IP 聚合桶**；address-based 另算（见 4）。

#### 3.2 `info`（`POST /info`）

官方规则（摘录）：

- weight=2：`l2Book, allMids, clearinghouseState, orderStatus, spotClearinghouseState, exchangeStatus`
- weight=60：`userRole`
- 其他 documented `info` requests：weight=20

设计落地（请求体 `type` 字段决定 weight）：

- 若 `type` 在 weight=2 列表 → weight=2
- 若 `type === 'userRole'` → weight=60
- 其他 → weight=20

#### 3.3 `explorer`（未来扩展）

官方规则：所有 `explorer` API requests weight=40（`blockList` 还有“每 block 额外 1”与“老区块更重”的说明）。

当前 vendor-hyperliquid 未使用 explorer；设计上预留：

- 若 `path` 以 `explorer` 开头（或明确映射到 explorer）→ weight=40
- `blockList` 的额外加权：先按保守策略（见 3.4）实现，避免低估导致 429

> [REVIEW] 你如果要预留必须遵循开闭原则，以后不应该很修改已有代码，而是加新 case。
>
> [RESPONSE] 接受：我会按开闭原则组织“限流规则/权重计算”。实现上不会把所有判断写成一坨 if-else，而是用可扩展的 rule registry（数组/Map）来驱动：新增 endpoint/type 只需要“新增一条 rule / 新增一个 case 配置”，核心流程（计算 →acquireSync→fetch）不需要改。
> [STATUS:resolved]

#### 3.4 基于“返回条数”的额外加权（保守策略）

官方规则：

- 以下 `info` endpoints：每 **20 items returned** 增加额外 weight：`recentTrades, historicalOrders, userFills, userFillsByTime, fundingHistory, userFunding, nonUserFundingUpdates, twapHistory, userTwapSliceFills, userTwapSliceFillsByTime, delegatorHistory, delegatorRewards, validatorStats`
- `candleSnapshot`：每 **60 items returned** 增加额外 weight

难点：额外 weight 与“响应条数”相关，严格来说需要在拿到响应后才能准确计算。

本次设计采用两段式（优先保守，避免低估）：

1. **请求前（预估）**：对能在请求时估算的 endpoint，提前估算额外 weight 并参与本次 acquire。
   - `candleSnapshot`：官方说明“Only the most recent 5000 candles are available”，因此 `estimatedItems = min(5000, ceil((endTime - startTime) / intervalMs))`
   - 额外 weight：`extra = ceil(estimatedItems / 60)`
2. **响应后（记账）**：对需要按“响应条数”计费但请求时难以估算的 endpoint（如 `userFills`/`fundingHistory`），响应后计算 `actualExtra` 并记入 `debt`，由后续请求逐步偿还（不在响应后阻塞/不在响应后抛错）。
   - 额外 weight：`actualExtra = ceil(actualItems / 20)`（`candleSnapshot` 用 `/60`）

> 待确认点：你是否希望“响应后纠偏”作为 v1 必做（更准确但会让调用链更慢），还是 v2 再加。

> [REVIEW] 两段式可以，也要符合开闭原则；
>
> [RESPONSE] 接受：两段式会按开闭原则落地。
>
> - 第一段（请求前）：根据 (path + body.type + action) 计算 baseWeight/estimatedExtraWeight（可扩展的 estimator 列表）。
> - 第二段（响应后）：只做“补充信息/记账”，不在这里改核心流程；新增需要按返回条数计费的 endpoint 时，只新增一个 ResponseWeigher（match + countItems + divisor），不改已有逻辑。
>   [STATUS:resolved]

### 4) address-based limits（动作限额，待确认范围）

官方规则（摘录）：

- address-based limits per user；sub-accounts treated as separate users
- 初始 buffer：10000 requests
- 动态额度与累计成交 USDC 相关：允许 1 request / 1 USDC traded（自 inception 累计）
- 当触发 address-based rate limit：该 address 允许 1 request / 10s
- batched request：对 IP 限流视为 1 次请求；对 address-based 视为 `n` 次请求（n 为 orders/cancels 数量）
- cancels 有更宽松上限：`min(limit + 100000, limit * 2)`

本仓库现状下可落地的两档方案（供你选）：

1. **v1（建议默认）**：只实现 REST 的 IP 聚合限流 + exchange weight；address-based 只做“遇到明确的 rate-limit 响应时，按 10s/backoff 做主动熔断一段时间”（best-effort）。
2. **v2（更完整）**：实现进程内的 address action budget：
   - `available = 10000 + tradedUSDC`（tradedUSDC 通过定期查询用户状态/成交记录更新）
   - 对 `order/cancel/modify`：按 action 的 `batch_length` 扣减 `available`
   - 当 `available` 不足：强制进入 `1 req / 10s` 模式（可用 `tokenBucket(addressBucketId, { capacity: 1, refillInterval: 10_000, refillAmount: 1 })` 做节流）

> v2 需要你确认“tradedUSDC 的数据源/刷新频率/成本”（可能会额外消耗 info weight）。

> [REVIEW] 这个你给我一些详细的伪代码让我 review 之后再说
>
> [RESPONSE] 补一份可 review 的伪代码（遵循开闭原则；不改业务代码，只给设计）：
>
> ```ts
> // apps/vendor-hyperliquid/src/api/rate-limit.ts
> import { scopeError, tokenBucket } from '@yuants/utils';
>
> const REST_IP_BUCKET_ID = 'HYPERLIQUID_REST_IP_WEIGHT_1200_PER_MIN';
> // 模块初始化阶段 create
> tokenBucket(REST_IP_BUCKET_ID, { capacity: 1200, refillInterval: 60_000, refillAmount: 1200 });
>
> type RestKind = 'info' | 'exchange' | 'explorer' | 'other';
>
> type RestRequestCtx = {
>   method: 'GET' | 'POST';
>   path: string; // 'info' | 'exchange' | ...
>   body?: unknown; // POST body
>   // 解析后的字段（可选）
>   infoType?: string; // body.type
>   exchangeActionType?: string; // body.action.type
>   exchangeBatchLength?: number; // orders.length / cancels.length / 1
> };
>
> type ExtraWeigher = {
>   match: (ctx: RestRequestCtx) => boolean;
>   // 请求前能估算则返回 >=0；否则返回 0
>   estimateItems?: (ctx: RestRequestCtx) => number;
>   // 响应后能计算则返回 >=0；否则返回 0
>   countItemsFromResponse?: (resp: unknown) => number;
>   divisor: number; // 20 or 60
> };
>
> const INFO_BASE_WEIGHT: Record<string, number> = {
>   l2Book: 2,
>   allMids: 2,
>   clearinghouseState: 2,
>   orderStatus: 2,
>   spotClearinghouseState: 2,
>   exchangeStatus: 2,
>   userRole: 60,
> };
>
> const extraWeighers: ExtraWeigher[] = [
>   {
>     match: (ctx) => ctx.infoType === 'candleSnapshot',
>     divisor: 60,
>     estimateItems: (ctx) => {
>       // 官方：Only the most recent 5000 candles are available
>       const req = (ctx.body as any)?.req;
>       const interval = req?.interval as string | undefined;
>       const startTime = req?.startTime as number | undefined;
>       const endTime = req?.endTime as number | undefined;
>       const intervalMs = INTERVAL_TO_MS[interval ?? ''] ?? 0;
>       if (!intervalMs || !startTime || !endTime || endTime <= startTime) return 0;
>       return Math.min(5000, Math.ceil((endTime - startTime) / intervalMs));
>     },
>     countItemsFromResponse: (resp) => (Array.isArray(resp) ? resp.length : 0),
>   },
>   {
>     match: (ctx) => ctx.infoType === 'userFills' || ctx.infoType === 'fundingHistory',
>     divisor: 20,
>     // 这类请求“请求前难估算”，先返回 0，响应后计入 debt
>     countItemsFromResponse: (resp) => {
>       // userFills 返回可能是 { fills: [] } 或 []；这里做最小兼容
>       const fills = (resp as any)?.fills;
>       if (Array.isArray(fills)) return fills.length;
>       return Array.isArray(resp) ? resp.length : 0;
>     },
>   },
>   // 以后新增 case：只需要往这里追加一个 ExtraWeigher，不改核心流程
> ];
>
> const INTERVAL_TO_MS: Record<string, number> = {
>   '1m': 60_000,
>   '3m': 180_000,
>   '5m': 300_000,
>   '15m': 900_000,
>   '30m': 1_800_000,
>   '1h': 3_600_000,
>   '2h': 7_200_000,
>   '4h': 14_400_000,
>   '8h': 28_800_000,
>   '12h': 43_200_000,
>   '1d': 86_400_000,
>   '3d': 259_200_000,
>   '1w': 604_800_000,
>   '1M': 2_592_000_000,
> };
>
> let restIpDebt = 0;
>
> export function getRestRequestCtx(method: 'GET' | 'POST', path: string, body?: unknown): RestRequestCtx {
>   if (method === 'POST' && path === 'info') {
>     return { method, path, body, infoType: (body as any)?.type };
>   }
>   if (method === 'POST' && path === 'exchange') {
>     const action = (body as any)?.action;
>     const t = action?.type;
>     const batchLength = Array.isArray(action?.orders)
>       ? action.orders.length
>       : Array.isArray(action?.cancels)
>       ? action.cancels.length
>       : 1;
>     return { method, path, body, exchangeActionType: t, exchangeBatchLength: batchLength };
>   }
>   return { method, path, body };
> }
>
> export function getRestBaseWeight(ctx: RestRequestCtx): number {
>   if (ctx.path === 'exchange') {
>     const n = Math.max(1, ctx.exchangeBatchLength ?? 1);
>     return 1 + Math.floor(n / 40);
>   }
>   if (ctx.path === 'info') {
>     return INFO_BASE_WEIGHT[ctx.infoType ?? ''] ?? 20;
>   }
>   if (ctx.path.startsWith('explorer')) {
>     return 40;
>   }
>   return 20; // 保守兜底
> }
>
> export function getRestEstimatedExtraWeight(ctx: RestRequestCtx): number {
>   for (const w of extraWeighers) {
>     if (!w.match(ctx)) continue;
>     const items = w.estimateItems?.(ctx) ?? 0;
>     if (items <= 0) return 0;
>     return Math.ceil(items / w.divisor);
>   }
>   return 0;
> }
>
> export function acquireRestIpWeightSync(meta: Record<string, unknown>, weight: number) {
>   scopeError('HYPERLIQUID_API_RATE_LIMIT', { ...meta, bucketId: REST_IP_BUCKET_ID, weight }, () =>
>     tokenBucket(REST_IP_BUCKET_ID).acquireSync(weight),
>   );
> }
>
> export function beforeRestRequest(meta: Record<string, unknown>, ctx: RestRequestCtx) {
>   const base = getRestBaseWeight(ctx);
>   const estimatedExtra = getRestEstimatedExtraWeight(ctx);
>   const debtToPay = Math.min(restIpDebt, 200); // 每次最多偿还一部分，避免一次性把 weight 撑爆
>   restIpDebt -= debtToPay;
>   acquireRestIpWeightSync(meta, base + estimatedExtra + debtToPay);
>   return { base, estimatedExtra };
> }
>
> export function afterRestResponse(ctx: RestRequestCtx, response: unknown, estimatedExtra: number) {
>   for (const w of extraWeighers) {
>     if (!w.match(ctx)) continue;
>     const items = w.countItemsFromResponse?.(response) ?? 0;
>     if (items <= 0) return;
>     const actualExtra = Math.ceil(items / w.divisor);
>     const delta = actualExtra - estimatedExtra;
>     // 只记录 debt（欠账）；不在响应后 acquireSync/throw
>     if (delta > 0) restIpDebt += delta;
>     return;
>   }
> }
> ```
>
> 说明：
>
> - 该伪代码为当时的草案；**以实际实现为准**：当前实现已改为 `beforeRestRequest` 请求前 `acquireSync`，`afterRestResponse` 响应后 `await acquire(deltaWeight)` 阻塞等待（不使用 acquireSync/debt）。
> - 429 主动退避：按后续 review（R8）已移除；当前实现为“打印日志 + 抛错”，不在 client 内做退避（等待官方文档明确再加）。
> - `candleSnapshot` 的“startTime=0”不会导致无限 weight：官方上限 5000 candles，因此额外 weight 上限约 `ceil(5000/60)=84`。
> - 新增按返回条数计费的 endpoint：只需要往 `extraWeighers` 追加一条规则；核心流程保持开闭原则不改。
>   [STATUS:resolved]

### 5) WebSocket limits（未来扩展）

官方规则（摘录）：

- 最大 100 websocket connections
- 最大 1000 websocket subscriptions
- user-specific subscriptions：最多 10 unique users
- 每分钟最多 2000 messages（跨所有连接）
- 最多 100 simultaneous inflight post messages（跨所有连接）

当前 vendor-hyperliquid 代码未使用 WebSocket；若后续接入，建议：

- `tokenBucket('HYPERLIQUID_WS_MESSAGES_PER_MIN', { capacity: 2000, refillInterval: 60_000, refillAmount: 2000 })`
- `semaphore('HYPERLIQUID_WS_INFLIGHT_POST')` 作为 inflight=100 的并发闸门
- subscriptions/unique-users/connection 数量作为启动时的硬校验（超限直接拒绝启动）

> [REVIEW] websocket 部分先不做。
>
> [RESPONSE] 收到：WebSocket 限额这轮先不做实现；我会在设计里保留“未来扩展建议”但明确标注 out-of-scope，避免误导。
> [STATUS:resolved]

### 6) 代码落点（实现阶段按此改）

> 本节只是设计说明；按你的要求，在你 review 通过之前不改代码。

- 新增：`apps/vendor-hyperliquid/src/api/rate-limit.ts`
  - `getRestRequestWeight({ path, params }) => { weight, extraWeightEstimate, meta }`
  - `acquireRestIpWeightSync({ weight, meta }) => void`（内部用 `scopeError + tokenBucket.acquireSync`，并直接抛错）
- 修改：`apps/vendor-hyperliquid/src/api/client.ts`
  - 在 `fetch` 前调用 `acquireRestIpWeightSync`
  - 在解析响应后按实际条数做“响应后 acquire（阻塞等待，不抛错）”
  - 若收到 429：仅打印日志并抛错（不做 client 内主动退避；等待官方文档明确再加）
- （若你选择做 address-based）修改：`apps/vendor-hyperliquid/src/api/private-api.ts`
  - 在 `placeOrder/cancelOrder/modifyOrder` 发请求前，按 action batch_length 执行 address-based 的扣减/节流

### 7) 待你确认的关键点（REVIEW）

> [REVIEW:blocking] 请你确认本次实现范围与关键取舍：\\n> 1) address-based：按上面 v1（best-effort backoff）还是 v2（实现 action budget）？\\n> 2) tokenBucket 获取方式：REST/IP 桶使用 `await acquire(weight)`（等待）还是 `acquireSync(weight)`（抛错交给上层 retry）？\\n> 3) `candleSnapshot` 当前调用使用 `startTime=0`，可能导致返回条数与额外 weight 极大：你是否允许我在实现阶段顺便把查询窗口改为“有界”（例如按 duration 只取 `N` 根）来避免系统性 429？\\n>\\n> 你的回复可以直接写“1=v1, 2=await, 3=允许/不允许”，我就按此落地。
>
> [RESPONSE] 设计已落盘，当前实现前只缺 3 个取舍点的确认：
>
> 1. address-based 选 v1 还是 v2
> 2. REST/IP 桶用 `await acquire` 还是 `acquireSync`
> 3. 是否允许把 `candleSnapshot` 的查询窗口改为有界以避免额外 weight 爆炸
>
> 你直接按“1=..., 2=..., 3=...”回复即可；收到后我进入实现阶段。
> [STATUS:need-info]
>
> [RESPONSE] 已按你最新回复收敛这 3 个取舍点（仅更新设计，不改代码）：
>
> 1. address-based：按 v1 处理（本轮不做动态 action budget，只保留扩展点；如你要 v2 再单独 review）
> 2. tokenBucket：REST/IP 聚合桶统一 `acquireSync(weight)`，用 `scopeError` 打印必要 meta 后直接抛错，不捕获
> 3. candleSnapshot：不改调用窗口；并利用官方“最多 5000 根 candles”上限做额外 weight 的有界估算（额外 weight 上限约 `ceil(5000/60)=84`），两段式按开闭原则实现
>    [STATUS:resolved]

> [REVIEW] 1=看上面 2=Sync 然后直接 scopeError 打印必要信息抛错，不要捕获 3=两段式就好了，但是要符合开闭原则。
>
> [RESPONSE] 收到你的决策输入，我会这样落实到设计（不改代码）：
>
> - `2=Sync`：REST/IP 聚合桶统一用 `acquireSync(weight)`，并用 `scopeError` 打印必要 meta 后直接抛错，不捕获。
> - `3=两段式`：采用“请求前计算 + 响应后记账”的两段式；并按开闭原则实现。
> - `websocket 先不做`：本轮 out-of-scope。
>
> `1=看上面` 我先按 v1（不做 address-based 动态 budget，只保留扩展点）理解；如果你想直接做 v2，请再回我一句我再补设计。
> [STATUS:resolved]

> [REVIEW] afterRestResponse 这个不要使用 acquireSync，不希望在响应后报错，而使用 acquire 来阻塞等待，同时还要通过对 429 退避（对 429 退避是最重要的，具体怎么做你可能需要看一下 binance client.ts 的做法）
>
> [RESPONSE] 接受并已落地到实现：
>
> - `afterRestResponse` 不再使用 `acquireSync`/debt；改为响应解析后按返回条数计算 `deltaWeight`，用 `await tokenBucket(...).acquire(deltaWeight)` 阻塞等待（不会因令牌不足而报错）。
> - 增加 429 退避：`apps/vendor-hyperliquid/src/api/client.ts` 参考 Binance 的 `mapPathToRetryAfterUntil`，基于 `Retry-After`（以及 429）记录 `retryAfterUntil`，在下次请求前主动抛 `ACTIVE_RATE_LIMIT` 让上层 retry/backoff。
> - 设计说明同步更新在 `.legion/tasks/hyperliquid-api-tokenbucket/plan.md`。
>   [STATUS:resolved]

> [REVIEW] 我看了一下 hyperliquid 的文档没有给出 429 相关的说明，遇到报错还是先打印日志，不要退避了，等以后有说明了再说。所以你把退避的部分去掉吧
>
> [RESPONSE] 收到并接受：Hyperliquid 文档未明确 429/Retry-After 语义前，client 内不做主动退避。
>
> 已落地改动：
>
> - 移除 `Retry-After` 解析与本地 `retryAfterUntil` 逻辑；不再抛 `ACTIVE_RATE_LIMIT`。
> - 遇到 429：仅打印响应日志并抛错（`HYPERLIQUID_HTTP_429`），交给上层（rx retry/backoff/运维）决定处理策略。
>
> 对应文件：`apps/vendor-hyperliquid/src/api/client.ts` + 设计说明同步更新在 `plan.md`。
> [STATUS:resolved]

_创建于: 2025-12-26 | 最后更新: 2025-12-26_
