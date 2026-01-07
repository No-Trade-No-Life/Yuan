# Hyperliquid API tokenBucket：按官方限额主动限流 - 上下文

## 会话进展 (2025-12-26)

### ✅ 已完成

- 已阅读 binance-private-api-host-tokenbucket：host→bucketId 采用 `new URL(endpoint).host` 直接路由；在每个具体 API 方法调用点计算 weight，并用 `scopeError(..., meta, () => tokenBucket(bucketId).acquireSync(weight))` 做请求前主动限流（不抽 wrapper、不做未知 host 兜底）
- 已阅读 huobi-publicprivate-api-tokenbucket：public 采用“global bucket + business bucket 双扣减”以同时满足共享上限与业务线拆分；private 按 `credential.access_key` 动态创建 per-UID bucket，并同样做 global+business 双扣减；整体策略是“由调用点选择 helper，不在 request 内做运行时识别分类”
- 已抓取并解析 Hyperliquid 官方文档 `Rate limits and user limits`（来源：https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits ）：REST 为“每 IP 1200 weight/分钟”的聚合限额；exchange 请求 weight=1+floor(batch_length/40)；info/explorer 有固定权重与部分按返回条数加权；WebSocket 有连接数/订阅数/消息速率/inflight post 等静态上限；另有 address-based（per user）动态限制（初始 10000 buffer、按累计成交 USDC 增长、被限流后 1 req/10s，cancels 有更宽松上限）
- 已在 `.legion/tasks/hyperliquid-api-tokenbucket/plan.md` 补充“设计细节（待 review）”：包含官方限额摘录、REST/IP bucket 参数、exchange/info weight 规则、返回条数额外加权策略、address-based 与 WebSocket 的扩展方案，以及 3 个待确认的 blocking 取舍点
- 已响应并闭环全部 inline review（含开闭原则要求、两段式要求、伪代码要求、以及 3 个取舍点确认）；当前设计已可进入实现阶段（但按你的指令暂不改代码）
- 已实现 REST/IP 主动限流：新增 `apps/vendor-hyperliquid/src/api/rate-limit.ts`（base weight 计算、candleSnapshot 有界额外权重估算、响应后 debt 记账），并在 `apps/vendor-hyperliquid/src/api/client.ts` 的 fetch 前接入 `beforeRestRequest(...).acquireSync`
- 已补最小单测 `apps/vendor-hyperliquid/src/api/rate-limit.test.ts`（覆盖 info/exchange base weight 与 candleSnapshot 额外 weight 上限估算）并通过
- 已运行校验（apps/vendor-hyperliquid）：`./node_modules/.bin/tsc --noEmit --project tsconfig.json` 通过；`./node_modules/.bin/heft test --clean` 通过
- 已按你新增 review（R7）调整实现：响应后不再用 acquireSync/debt，而是 `await tokenBucket.acquire(deltaWeight)` 阻塞等待；并在 `apps/vendor-hyperliquid/src/api/client.ts` 参考 Binance 增加 429/Retry-After 主动退避（请求前抛 `ACTIVE_RATE_LIMIT`）
- 已重新跑过 `apps/vendor-hyperliquid` 的 `tsc` 与 `heft test`（含新单测）均通过
- 已按新增 review（R8）移除 client 内 429/Retry-After 主动退避：删除本地 retryAfterUntil 逻辑与 `ACTIVE_RATE_LIMIT` 抛错；429 仅记录日志并抛 `HYPERLIQUID_HTTP_429` 交给上层处理
- 已重新跑过 `apps/vendor-hyperliquid` 的 `tsc` 与 `heft test` 均通过
- 为 `apps/vendor-hyperliquid/src/api/public-api.ts` / `apps/vendor-hyperliquid/src/api/private-api.ts` 抽取 request body/action builders（纯函数/无网络），便于离线测试
- 新增单测覆盖 public-api 与 private-api 的请求体构造与签名输出形状；修复 `userFills` startTime/endTime=0 时不被带上的边界情况
- 已运行 `apps/vendor-hyperliquid` 的 `./node_modules/.bin/tsc --noEmit --project tsconfig.json` 与 `./node_modules/.bin/heft test --clean` 验证通过
- 扩展 `apps/vendor-hyperliquid/src/api/rate-limit.test.ts` 覆盖 request context 分类、base/extra weight 计算、beforeRestRequest 扣减、afterRestResponse 追加扣减与无追加场景
- 已运行 `apps/vendor-hyperliquid` 的 `./node_modules/.bin/heft test --clean` 验证通过（新增用例通过）

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `apps/vendor-hyperliquid/src/api/client.ts`：所有 REST 请求入口（`request()` -> `callApi()` -> `fetch`），是接入“请求前主动限流”的主落点
- `apps/vendor-hyperliquid/src/api/public-api.ts`：所有 `POST /info` 的调用点（type=allMids/metaAndAssetCtxs/candleSnapshot/...），决定 info 的 weight 分类与额外加权需求
- `apps/vendor-hyperliquid/src/api/private-api.ts`：`POST /exchange` 的调用点（order/cancel/modify）与 `userFills`；若实现 address-based，将在这里拿到 address/batch_length
- `apps/vendor-hyperliquid/src/services/markets/quote.ts`：高频轮询（`allMids` 每秒、`metaAndAssetCtxs` 默认 5s），是最容易触发 IP weight 的热区
- `apps/vendor-hyperliquid/src/services/markets/ohlc.ts`：`candleSnapshot` 可能返回大量 items（额外加权按 60 items），需要重点关注
- `apps/vendor-binance/src/api/client.ts`：参考模式（模块初始化 create bucket；调用点按 host 取 bucket 并 acquire）
- `apps/vendor-huobi/src/api/public-api.ts`、`apps/vendor-huobi/src/api/private-api.ts`：参考模式（global+business 双桶扣减、per-UID bucket、调用点选择 helper）

---

## 关键决策

| 决策                                                                                                                             | 原因                                                                                                                            | 替代方案                                                                      | 日期       |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------- |
| 本轮 Hyperliquid 限流实现范围采用 v1：只做 REST/IP 聚合限流 + weight 计算；address-based 动态 action budget 不实现，仅保留扩展点 | 你在 review 中给出 `1=看上面`，我按“先落 v1、v2 另开 review”的方式收敛范围，避免引入依赖 tradedUSDC 数据源的复杂度              | 直接实现 v2：进程内 address action budget（需要 tradedUSDC 数据源与刷新策略） | 2025-12-26 |
| REST/IP 聚合桶使用 `acquireSync(weight)` + `scopeError` 打印 meta 后直接抛错，不做捕获/等待                                      | 你明确要求 `2=Sync`，且仓库其它 vendor（binance/huobi）也采用“请求前 acquireSync、失败直接 throw，交给上层 retry/backoff”的模式 | 使用 `await acquire(weight)` 在桶不足时等待（不会抛错，但会阻塞调用链）       | 2025-12-26 |
| candleSnapshot 不改查询窗口，按官方“最多 5000 candles”上限做额外 weight 有界估算；响应后只做 debt 记账                           | 你要求 `3=两段式` 且不希望为了限流去大改既有逻辑；官方明确 5000 上限使得 startTime=0 不会导致无界 weight                        | 修改调用点，把 candleSnapshot 查询窗口改为有界（按 duration/limit 分段拉取）  | 2025-12-26 |
| WebSocket 限流本轮不实现（out-of-scope），仅保留未来扩展建议                                                                     | 你明确 review：websocket 部分先不做                                                                                             | 本轮同步实现 WS connection/subscription/message/inflight 限制                 | 2025-12-26 |
| 不做 Hyperliquid 429 主动退避（待官方文档明确后再加）                                                                            | 你 review 指出官方文档未明确 429/Retry-After 语义，先保持最小行为：记录日志 + 抛错，由上层决定 retry/backoff                    | 参考 Binance 在 client 内实现 mapRetryAfterUntil 主动退避（当前已移除）       | 2026-01-05 |

---

## 快速交接

**下次继续从这里开始：**

1. 如需继续扩充 Hyperliquid API 封装：沿用本次模式先加 `build*RequestBody`/`build*Action` 再补离线单测，避免引入网络或 mock
2. 如要排查 Jest "failed to exit gracefully"：可在 `apps/vendor-hyperliquid` 下用 `./node_modules/.bin/heft test --clean -- --detectOpenHandles` 定位未释放的 handle（当前不影响通过）

**注意事项：**

- 本次新增 public/private API 单测均为离线纯函数/签名验证，不会触发真实 HTTP 请求
- `buildUserFillsRequestBody` 已修复 startTime/endTime=0 时构造丢字段的问题（由 `if (params?.startTime)` 改为 `!= null` 判断）

---

_最后更新: 2026-01-07 00:00 by Codex_
