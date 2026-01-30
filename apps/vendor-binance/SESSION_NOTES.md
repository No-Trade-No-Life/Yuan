# Binance Vendor — Session Notes

> 单一真相源：记录 `apps/vendor-binance` 的目标、指令、决策、TODO 与风险。结构与 `skills/context-management/SESSION_NOTES.template.md` 对齐，亦参考 `apps/vendor-bitget/SESSION_NOTES.md`。

---

## 0. 元信息（Meta）

- **项目名称**：@yuants/vendor-binance
- **最近更新时间**：2026-01-30 11:20(确认日志与错误 payload 脱敏)
- **当前状态标签**：重构中（credential 化 & 上下文治理）

---

## 1. 项目整体目标（High-level Goal）

- 对齐 `docs/zh-Hans/vendor-guide/implementation-checklist.md` 的所有要求，让 Binance vendor 可被 trade-copier / CLI 复用。
- 提供公共行情、利率、产品目录、账户、挂单、转账、订单动作（默认账户 + 凭证化）等服务。
- 引入 context-management 规范，确保多轮协作可追踪。
- 非目标：一次性完成所有模块重写；在未完成自测前上线生产环境。

---

## 2. 指令与约束（Instructions & Constraints）

### 2.1 长期指令快照

- 遵循 `docs/zh-Hans/vendor-guide/implementation-checklist.md`。
- API 层禁止 `any`，保留官方注释链接。
- 结构参考 vendor-bitget / vendor-okx：`api/` + `services/`。
- credential 设计遵循 `.clinerules/credential.md`，`type = 'BINANCE'`。
- 重要信息写入 AGENTS / Session Notes，不依赖聊天记录。
- 公共数据（Quote/Product/InterestRate/OHLC）置于 `src/public-data/` 目录。

### 2.2 当前阶段指令

- 补齐 `docs/context` 文档。
- 将 Binance API 拆分 public/private + Typed credential。
- 实现凭证化 Order Actions，并准备账户/挂单服务的 credential 版本。
- 保持 `PUBLIC_ONLY` 模式可运行公共数据。

### 2.3 临时指令（短期有效）

- 用户提醒（2025-11-17）：本轮重点是文档 + credential API，分阶段完成，不必一次重构全部；逐步对齐 vendor-bitget / vendor-okx。

### 2.4 指令冲突与变更记录

- 暂无。如有冲突，使用编号 `C1`, `C2` 等记录在此节并同步 AGENTS。

---

## 3. 当前阶段的重点目标（Current Focus）

- Stage 1：建立 context 文档体系（AGENTS / SESSION_NOTES）并同步指令。
- Stage 2：完成 API 层重构（public/private/typed credential）。
- Stage 3：实现凭证化 order actions + account/pending services。
- Stage 4：迁移 legacy 逻辑到 services 目录并逐步淘汰。

---

## 4. 重要背景与关键决策（Context & Decisions）

### 4.1 架构 / 模块概览

- `src/api/public-api.ts`：Binance 公共 REST helper。
- `src/api/private-api.ts`：Binance 私有 REST helper，需凭证。
- `src/legacy_index.ts`：旧版 account/order/transfer 逻辑（待迁移）。
- `src/public-data/*`：quote / product（旧的 interest_rate/ohlc 已移除）。
- `src/services/*`：按 checklist 拆分 account/order/markets/transfer。

### 4.2 已做出的关键决策

- **[D1] 2025-11-17**：沿用 vendor-bitget 结构，在 `apps/vendor-binance/src/api/` 下实现 typed API，并准备引入 `services/` 目录。
- **[D2] 2025-11-17**：为 context-management 建立 `docs/context/AGENTS.md` 与 `SESSION_NOTES.md`，仅覆盖 vendor-binance。
- **[D3] 2025-11-23**：公共数据文件（quote, product, interest_rate, ohlc）统一移至 `src/public-data/` 目录，保持根目录整洁。
- **[D4] 2025-11-23**：Spot 改单使用 `cancelReplace` 接口，Futures 改单使用 `amend` 接口。
- **[D5] 2025-11-23**：OHLC 数据源（Binance API）返回升序数据，`ohlc.ts` 不进行 reverse，直接 yield 升序数据，并调整分页逻辑（取 `periods[0]` 作为 oldest）。
- **[D6] 2025-11-23**：Spot Quote 中的利率映射遵循用户指定规则：`interest_rate_long` = Quote Asset Rate, `interest_rate_short` = Base Asset Rate。
- **[D7] 2025-11-23**：Margin 接口（如 `next-hourly-interest-rate`、`interestRateHistory`）属于 USER_DATA 安全类型（需 API Key 和签名）。这些 API 在 `private-api.ts` 中定义，内部使用 `getDefaultCredential()` + `requestPrivate` 调用。`callApi` 简化为：有 credential 就签名，保持语义清晰。

### 4.3 已接受的折衷 / 技术债

- Legacy `legacy_index.ts` 仍包含默认账户逻辑，需要迁移至 `services/legacy.ts` 或新的模块。
- 尚未实现凭证化 Account Actions / Order Actions 的完整覆盖（如转账）。
- 转账接口未对齐新的 credential 设计。

---

## 5. 关键文件与模块说明（Files & Modules）

- `src/api/public-api.ts`: 各类公共 REST，禁止 any。
- `src/api/private-api.ts`: 权限 REST，输出类型需补充。
- `src/legacy_index.ts`: 旧服务实现，逐步拆分。
- `src/public-data/*`: 公共数据脚本 (Quote, Product, Interest Rate, OHLC)。
- `src/services/orders/modifyOrder.ts`: 改单实现 (Spot & Futures)。
- `docs/context/AGENTS.md`, `SESSION_NOTES.md`: 指令与状态文件。

---

## 6. 最近几轮工作记录（Recent Sessions）

> 仅记录已结束的会话;进行中的内容放在第 11 节,收尾后再搬运;最新记录置顶。

### 2026-01-30 — OpenCode

- **本轮摘要**：
  - 复核 `api/client.ts` 日志与错误 payload 已完成脱敏：不输出签名、API key、signData 或完整 query。
  - 记录当前状态与后续注意事项，未新增代码改动。
- **修改的文件**：
  - `apps/vendor-binance/SESSION_NOTES.md`
- **运行的测试 / 检查**：
  - 命令：未运行（按指令不执行测试）
  - 结果：未运行

### 2026-01-30 — OpenCode

- **本轮摘要**：
  - 进一步脱敏 `ACTIVE_RATE_LIMIT` 错误 payload，移除 `endpoint` 字段，仅保留 host+pathname。
- **修改的文件**：
  - `apps/vendor-binance/src/api/client.ts`
- **运行的测试 / 检查**：
  - 命令：未运行（按指令不执行测试）
  - 结果：未运行

### 2026-01-30 — OpenCode

- **本轮摘要**：
  - 在 `api/client.ts` 移除请求日志中的 API key、签名与完整 query，避免泄露敏感信息。
  - 保留必要日志字段（method/host/path/usedWeight/retryAfter）。
  - 限流错误 `ACTIVE_RATE_LIMIT` 的 payload 仅保留 `host+pathname`，避免签名泄露。
- **修改的文件**：
  - `apps/vendor-binance/src/api/client.ts`
- **运行的测试 / 检查**：
  - 命令：未运行（按指令不执行测试）
  - 结果：未运行

### 2026-01-30 — OpenCode

- **本轮摘要**：
  - 在 `api/client.ts` 新增 `@yuants/http-services` 的 `fetch` import，覆盖本地 fetch 标识以走代理。
  - 更新 `apps/vendor-binance` 依赖，新增 `@yuants/http-services`。
- **修改的文件**：
  - `apps/vendor-binance/src/api/client.ts`
  - `apps/vendor-binance/package.json`
- **运行的测试 / 检查**：
  - 命令：未运行（按指令不执行测试）
  - 结果：未运行

### 2026-01-07 — Codex

- **本轮摘要**：
  - 为切换到 `ohlc_v2`，移除基于 `createSeriesProvider` 的公共历史数据脚本：`public-data/ohlc.ts` 与 `public-data/interest_rate.ts`。
  - 清理 `src/index.ts` 中对应模块导入，避免旧表链路继续注册。
- **修改的文件**：
  - `apps/vendor-binance/src/public-data/ohlc.ts`（删除）
  - `apps/vendor-binance/src/public-data/interest_rate.ts`（删除）
  - `apps/vendor-binance/src/index.ts`
- **运行的测试 / 检查**：
  - 命令：未运行
  - 结果：未运行（与全仓 ohlc 迁移合并验证）

### 2025-12-24 — Codex

- **本轮摘要**：
  - private-api 每个请求在调用 `requestPrivate` 前按 endpoint host 获取 `tokenBucket` 并 `acquireSync(权重)`，权重取自接口注释（条件权重在方法内判定）；不抽 wrapper，不加 host guard。
  - public-api 同步做主动限流：每个请求在调用 `requestPublic` 前执行 `tokenBucket(url.host).acquireSync(weight)`。
  - client.ts 新增 3 个 tokenBucket（`api.binance.com`/`fapi.binance.com`/`papi.binance.com`）作为首次 create，private-api 侧仅获取既有桶。
  - 新增最小单测覆盖 host 路由与条件权重（private/public 各一套）。
- **修改的文件**：
  - `apps/vendor-binance/src/api/client.ts`
  - `apps/vendor-binance/src/api/private-api.ts`
  - `apps/vendor-binance/src/api/public-api.ts`
  - `apps/vendor-binance/src/api/private-api.rateLimit.test.ts`
  - `apps/vendor-binance/src/api/public-api.rateLimit.test.ts`
- **运行的测试 / 检查**：
  - `npx tsc --noEmit --project tsconfig.json`（workdir: apps/vendor-binance）
  - `npx heft test --clean`（workdir: apps/vendor-binance）

### 2025-12-04 — Codex

- **本轮摘要**：
  - quote 的 open interest 与 margin 利率请求按 `exchangeInfo.rateLimits` 计算的间隔串行发送，并设置默认间隔（Futures 500ms、Spot/Margin 200ms），避免瞬时请求过快导致 IP 被封。
  - `margin/allPairs` 返回非数组或 4xx 时降级为空数组并记录日志，防止 quote pipeline 由于不可迭代输入崩溃。
  - 串行请求的节流改为使用 RxJS `timer` + `concatMap`，不再使用 `await wait`。
- **修改的文件**：
  - `apps/vendor-binance/src/public-data/quote.ts`
- **运行的测试 / 检查**：
  - `./node_modules/.bin/tsc --noEmit --project apps/vendor-binance/tsconfig.json`

### 2025-11-25 — Antigravity

- **本轮摘要**:
  - 在 `product.ts` 中添加 Spot 和 Margin 产品支持,现在同时获取 Futures、Spot 和 Margin 三种产品。
  - 在 `public-api.ts` 中新增 `getSpotExchangeInfo` 及相关类型定义。
- **修改的文件**:
  - `apps/vendor-binance/src/api/public-api.ts`
  - `apps/vendor-binance/src/public-data/product.ts`
- **运行的测试 / 检查**:
  - `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json` (Passed)

### 2025-11-24 — Codex

- **本轮摘要**：
  - 修复 Futures Quote 资金费率，使用 `lastFundingRate` 而非恒定的 `interestRate` 字段，映射 long/short 时保留符号。
  - 检查 `docs/zh-Hans/vendor-supporting.md` 暂无需要更新的项目状态。
- **修改的文件**：
  - `apps/vendor-binance/src/public-data/quote.ts`
- **运行的测试 / 检查**：
  - `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`

### 2025-11-23 — Antigravity

- **本轮摘要**：
  - 实现 `modifyOrder`：Spot 使用 `cancelReplace`，Futures 使用 `amend`。
  - 实现公共数据：OHLC (Spot & Futures) 和 Interest Rate (Spot Lending & Futures Funding)。
  - 重构：将 `quote.ts`, `product.ts`, `interest_rate.ts` 移至 `src/public-data/`。
  - 修复：`order-actions-with-credential.ts` 使用 `@yuants/data-order` 的 `provideOrderActionsWithCredential`。
- **修改的文件**：
  - `apps/vendor-binance/src/api/private-api.ts`
  - `apps/vendor-binance/src/services/orders/modifyOrder.ts`
  - `apps/vendor-binance/src/services/order-actions-with-credential.ts`
  - `apps/vendor-binance/src/public-data/ohlc.ts`
  - `apps/vendor-binance/src/public-data/interest_rate.ts`
  - `apps/vendor-binance/src/index.ts`
- **运行的测试 / 检查**：
  - `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json` (Passed)
- **用户干预**：
  - 用户手动移除了 `ohlc.ts` 中的 `.reverse()`，改为直接 yield 升序数据。
  - 修正了分页逻辑：`current_end` 取 `periods[0]` (oldest) 而非 `periods[length-1]`。
- **新增功能**：
  - **Spot Quote**: 在 `quote.ts` 中通过 `getSpotBookTicker` 增加现货行情。
  - **Margin Interest Rate**:
    - API: 新增 `getMarginNextHourlyInterestRate` (Quote) 和 `getMarginInterestRateHistory` (History)。
    - Quote: 实现 `marginInterestRateCache`，通过 `getMarginAllPairs` 获取资产列表，驱动缓存查询并生成 `margin/<asset>` 的利率报价。
    - Interest Rate: `interest_rate.ts` 支持 `margin` 类型，使用 `getMarginInterestRateHistory`。

### 2025-11-17 — Codex

- **本轮摘要**：
  - spot account 现在会把 USDT 之外的资产暴露为 `positions`，legacy 服务与新 credential 服务一致。
  - order actions 补齐现货账户：`listOrders`、`submitOrder`、`cancelOrder` 支持 `/spot/`，并为 futures/spot 统一映射 `order_status` 为 ACCEPTED/TRADED/CANCELLED。
  - 私有 API 新增 spot 下单/撤单/查询接口，order utils 补充 spot product_id 解码与状态映射。
  - 修正 REST 签名顺序：统一先追加除 timestamp 之外的参数，再在末尾加入 `timestamp`，避免 Binance Spot `openOrders` 校验失败。
- **修改的文件**：
  - `apps/vendor-binance/src/legacy_index.ts`
  - `apps/vendor-binance/src/services/accounts/spot.ts`
  - `apps/vendor-binance/src/api/private-api.ts`
  - `apps/vendor-binance/src/services/orders/{order-utils,listOrders,submitOrder,cancelOrder}.ts`
  - `apps/vendor-binance/src/api/client.ts`
- **运行的测试 / 检查**：
  - `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`

### 2025-11-17 — Codex

- **本轮摘要**：
  - Profile 缓存改为直接对 credential 序列化并作为 cache key，移除 credentialStore 依赖以避免状态不一致。
- **修改的文件**：
  - `apps/vendor-binance/src/services/accounts/profile.ts`
- **运行的测试 / 检查**：
  - `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`

### 2025-11-17 — Codex

- **本轮摘要**：
  - 使用 `@yuants/cache` 取代手写 Map，按 `access_key` 缓存 Binance 账户 Profile；缓存失效后自动刷新，避免多次调用 `getSpotAccountInfo`；
  - 凭证化 Account Actions 现在可以稳定复用 UID（`binance/<uid>/...`）而不重复命中限频。
- **修改的文件**：
  - `apps/vendor-binance/src/services/accounts/profile.ts`
- **详细备注**：
  - Profile TTL 设为 60 秒，缓存 miss 时会抛出明确错误；缓存依赖 credential store，确保刷新时仍能获取 secret；
  - 仅文档/逻辑修改，未更改 API Schema。
- **运行的测试 / 检查**：
  - 命令：`n/a`
  - 结果：未运行（纯缓存重构，后续改动建议执行 `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`）

### 2025-11-17 — Codex Agent

- 初始化 Binance vendor context 文档，创建 `docs/context/AGENTS.md` 与 `SESSION_NOTES.md`；
- 记录项目目标、阶段指令、技术债；
- 规划并实现凭证化下单/撤单：新增 `src/services/orders/{order-utils,submitOrder,cancelOrder}.ts` 与 `services/order-actions-with-credential.ts`，`src/index.ts` 注册服务；
- `src/api/private-api.ts` re-export `ICredential` 供服务层使用；
- 新增凭证化账户服务：`src/services/account-actions-with-credential.ts` 以及 `services/accounts/{profile,unified,spot}.ts`，提供 `listAccounts` + `getAccountInfo`；
- 凭证化下单新增 `listOrders`：`src/services/orders/listOrders.ts` 并在 `order-actions-with-credential.ts` 注册；
- 测试：`npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`；
- TODO：继续拆分 pending/transfer 服务，补完凭证化挂单 / 转账（见第 7 节）。

---

## 7. 当前 TODO / 任务列表（Tasks & TODO）

### 7.1 高优先级

- [ ] 引入 `services/` 目录结构：把 legacy pending/transfer 拆分；新增 `services/legacy` or dedicated 模块。
- [ ] 凭证化挂单服务：使用 `providePendingOrdersService`，复用 typed API。
- [ ] 转账流程凭证化：对接 `.clinerules/credential.md`。

### 7.2 中优先级

- [ ] e2e 测试脚本：参照 vendor-bitget / vendor-aster e2e 目录。

### 7.3 想法 / Nice-to-have

- [ ] 考虑为 Spot Interest Rate 寻找更好的数据源（目前仅占位或部分实现）。

---

## 8. 风险点 / 容易踩坑的地方（Risks & Gotchas）

- **Spot Interest Rate 数据源**
  - 现状：Spot 借贷利率数据源可能需要鉴权或更复杂的获取方式，目前实现可能不完整。
  - 建议：进一步调研 Binance Margin Interest Rate 的公共 API。

---

## 9. 尚未解决的问题（Open Questions）

- 暂无。

---

## 10. 下一位 Agent 的建议行动（Next Steps）

1. 继续拆分 legacy account/pending/transfer 到 `src/services/*`。
2. 实现凭证化挂单服务。
3. 完善 Spot Interest Rate 实现。

---

## 11. 当前会话草稿 / Scratchpad

- 暂无。
