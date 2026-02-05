# Bitget Vendor — Session Notes

> 单一真相源：记录 `apps/vendor-bitget` 的目标、指令、决策、TODO 与风险。结构与 `skills/context-management/SESSION_NOTES.template.md` 对齐，亦参考 `apps/vendor-hyperliquid/docs/context/SESSION_NOTES.md`。

---

## 0. 元信息（Meta）

- **项目名称**：@yuants/vendor-bitget
- **最近更新时间**：2025-11-20 23:20（由 Antigravity 补全 Spot/Future 功能）
- **当前状态标签**：已完成基础功能

---

## 1. 项目整体目标（High-level Goal）

- 构建 Bitget 交易所的统一 vendor adapter，为 `trade-copier`、`transfer-controller`、CLI 与 Web UI 提供账户、挂单、行情、下单、转账服务。
- 通过模块化（`services/legacy` + `services/account-actions-with-credential` + `services/order-actions-with-credential` + `services/markets/*` + `services/transfer`）与 `@yuants/*` 通用接口实现复用。
- 确保实时性、错误透传与审计可追踪性，满足 checklist 要求。
- 当前阶段聚焦 USDT 永续与 Spot，不含期权/保证金融资。

---

## 2. 指令与约束（Instructions & Constraints）

### 2.1 长期指令快照

- 中文对话/文档，英文源码/接口。
- `src/index.ts` 仅导入模块；公共 REST 在 `api/public-api.ts`，私有 REST 在 `api/private-api.ts`，所有私有函数显式传 `ICredential`。
- 账户 ID 统一 `bitget/<uid>/<scope>`，`@yuants/cache` 缓存 UID/parentId，供账户、转账、凭证下单复用。
- `provideAccountInfoService` & `providePendingOrdersService` 每账户独立，刷新约 1s / ≤5s；`product_id` 必须来自 `encodePath`。
- `services/legacy.ts`（默认）与 `services/order-actions-with-credential.ts`（凭证化）同时存在，日志记录请求参数并透传 Bitget 错误。
- `services/markets/*` 负责产品/行情/资金费率，支持 `WRITE_QUOTE_TO_SQL` Flag；Quote 至少 5s 刷新。
- `services/transfer.ts` 注册 TRC20 链上提现、Spot↔Futures 内部调拨、Parent/Sub Account 互转。

### 2.2 当前阶段指令

- Commit `b00e9aa7` 完成模块化重构；今后改动须保持分层、同步更新 README 与文档，并记录在 4/6/7 节。
- 需优先补齐 credential-aware RPC、TRC20 提现、子账户调拨的回归脚本与手动验证记录。
- 所有新的 Feature Flag / 环境变量务必写入本文件与 `apps/vendor-bitget/README.md`。

### 2.3 临时指令（短期有效）

- 当前会话需对齐 vendor-aster 的 services 目录，迁移 Bitget 默认账户/行情/转账逻辑至 `src/services/*`，新增 account-actions-with-credential，并同步 AGENTS / Session Notes。

### 2.4 指令冲突与变更记录

- 暂无冲突记录。若 checklist 与用户指令冲突，依流程记录 C# 编号并更新 AGENTS/Session Notes。

---

## 3. 当前阶段的重点目标（Current Focus）

- 巩固 commit `b00e9aa7` 引入的模块化 Bitget 结构，确保账户、挂单、行情、下单、转账稳定运行。
- 已补全 Spot/Future 的 `listOrders`, `modifyOrder`, `placeOrder`, `cancelOrder` 及 OHLC/利率数据。
- 整理运维手册，帮助 `trade-copier`/`transfer-controller` 团队快速接入。

---

## 4. 重要背景与关键决策（Context & Decisions）

### 4.1 架构 / 模块概览

- `src/services/accounts/profile.ts`：缓存 UID / parentId / main-account 状态，提供 `getFuturesAccountId`、`isMainAccount` 等 helper。
- `src/services/accounts/futures.ts` / `spot.ts`：封装账户查询与 pending-order mapping，供默认服务与凭证化服务复用。
- `src/services/exchange.ts`：统一入口，使用 `provideExchangeServices` 注册所有服务。
- `src/services/orders/order-utils.ts`：参数映射。
- `src/services/markets/product.ts` / `quote.ts`：REST 轮询 + SQL 写入 + quote channel。
- `src/services/interest-rate-service.ts`：资金费率历史写库接口。
- `src/services/transfer.ts`：注册 TRC20 提现、Spot↔Futures 内部调拨、Parent/Sub 互转。
- `src/api/client.ts`：REST 基础设施（签名、日志、简易限流占位），`api/public-api.ts`/`private-api.ts` 暴露具体接口。

### 4.2 已做出的关键决策

- **[D1] 引入 vendor implementation checklist 结构**：删除旧版 `src/api.ts`，新增 `api/client.ts` + `public/private-api.ts`，`src/index.ts` 只聚合模块。
- **[D2] 增加 credential-aware Submit/Cancel**：允许运行期注入任意 Bitget 凭证，无需 redeploy；account_id 以 `^bitget/` 限制。
- **[D3] 扩展 transfer 状态机**：覆盖 TRC20 链上提现（INIT→PENDING→COMPLETE），Spot↔Futures 内部转账，以及 Parent/Sub Account 调拨。

### 4.3 已接受的折衷 / 技术债

- **T1**：行情/资金费率使用 REST 轮询（5s）而非 WebSocket，存在延迟；后续视需求补 WS。
- **T2**：`request*WithFlowControl` 已实现但未应用到高频私有接口，429 时会抛错；TODO 中需跟进。

---

## 5. 关键文件与模块说明（Files & Modules）

- `apps/vendor-bitget/README.md`：能力列表、目录结构、运行期望。
- `apps/vendor-bitget/src/services/accounts/*.ts`：账户 profile 缓存、期货/现货账户与挂单映射。
- `apps/vendor-bitget/src/services/legacy.ts`：默认账户的 Account/Pending/Submit/Cancel。
- `apps/vendor-bitget/src/services/account-actions-with-credential.ts`：凭证化账户快照服务。
- `apps/vendor-bitget/src/services/order-actions-with-credential.ts` 与 `services/orders/order-utils.ts`：凭证化下单与参数映射。
- `apps/vendor-bitget/src/services/markets/*`：产品、行情、资金费率脚本。
- `apps/vendor-bitget/src/services/transfer.ts`：转账接口注册。
- `docs/en/vendor-guide/implementation-checklist.md`：适配规范。

---

## 6. 最近几轮工作记录（Recent Sessions）

> 仅记录已结束的会话；进行中的内容放在第 11 节，收尾后再搬运；最新记录置顶。

### 2026-02-05 — OpenCode

- **本轮摘要**：
  - proxy IP 选择改为异步等待（固定 30s），requestPublic/requestPrivate 使用 await 请求上下文。
- **修改的文件**：
  - `apps/vendor-bitget/src/api/client.ts`
- **运行的测试 / 检查**：
  - 未运行（本次仅修改 proxy ip 选择链路）

### 2026-02-05 — OpenCode

- **本轮摘要**：
  - Bitget REST client 在 `USE_HTTP_PROXY=true` 时引入 proxy ip 维度，流控 key 由 `encodePath([BaseKey, ip])` 生成；请求通过 `labels.ip` 路由。
  - 直连场景使用 `terminal.terminalInfo.tags.public_ip`，缺失时限频日志并 fallback 到 `public-ip-unknown`。
- **修改的文件**：
  - `apps/vendor-bitget/src/api/client.ts`
- **运行的测试 / 检查**：
  - `rush build`（repo 根目录）

### 2026-01-30 — OpenCode

- **本轮摘要**：
  - 在 Bitget REST client 引入 `@yuants/http-services` 的 `fetch`，增加 `USE_HTTP_PROXY` 开关与 `fetchImpl` 回退逻辑。
  - `USE_HTTP_PROXY=true` 时覆盖 `globalThis.fetch`，未开启时优先原生 fetch，不可用则回退。
  - `package.json` 新增 `@yuants/http-services` 依赖。
- **修改的文件**：
  - `apps/vendor-bitget/src/api/client.ts`
  - `apps/vendor-bitget/package.json`
  - `apps/vendor-bitget/SESSION_NOTES.md`
- **运行的测试 / 检查**：
  - 命令：未运行（按指令不运行测试）
  - 结果：未运行

### 2026-01-07 — Codex

- **本轮摘要**：
  - 为切换到 `ohlc_v2`，移除基于 `createSeriesProvider` 的历史数据脚本（markets/ohlc、markets/interest-rate）。
  - 清理 `src/index.ts` 中对应模块导入，避免旧表链路继续注册。
- **修改的文件**：
  - `apps/vendor-bitget/src/services/markets/ohlc.ts`（删除）
  - `apps/vendor-bitget/src/services/markets/interest-rate.ts`（删除）
  - `apps/vendor-bitget/src/index.ts`
- **运行的测试 / 检查**：
  - 命令：未运行
  - 结果：未运行（与全仓 ohlc 迁移合并验证）

### 2025-12-04 — Codex

- **本轮摘要**：
  - product 服务新增对 SPOT 产品的获取与写库，`listProducts` 现在返回 futures + spot 并定期写入 `product` 表。
  - 账户服务合并 futures/spot，统一通过 `getAccountAssets` + `getCurrentPosition` 获取资产与持仓，并用 SPOT tickers 估算 `closable_price`。
  - 修正 UTA 下单参数：去除 futures 下单的 `reduceOnly`，避免与 `posSide` 并存触发 25238 错误。
  - 支持下单 Post-only（MAKER）：当 `order_type === 'MAKER'` 时传 `timeInForce: post_only`；product margin_rate 使用 `maxLeverage`，修正 coin futures `market_id`。
- **运行的测试 / 检查**：
  - 命令：`npx -y typescript@5.6.3 --noEmit --project apps/vendor-bitget/tsconfig.json`
  - 结果：失败（npm 报错 could not determine executable to run；本地未能通过 npx 拉起 tsc）

### 2025-12-09 — Codex

- **本轮摘要**：
  - 全量切换到 UTA v3 API：删除旧版 `api/private-api.ts`、`api/public-api.ts`，用新版 UTA 接口（账户/订单/行情/资金费率/产品）替代并重命名。
  - 重构账户、订单、行情服务以适配 UTA：账户配置改用 `getAccountSettings`，持仓/挂单改用 `getCurrentPosition`/`getUnfilledOrders`，下撤改单统一走 `postPlaceOrder`/`postCancelOrder`/`postModifyOrder`，现货资产用 `getAccountFundingAssets`，行情/产品/利率改用 UTA 公共端点。
  - 清理根目录 `node_modules`，用 `npx -y node@22.12.0 common/scripts/install-run-rush.js build --to @yuants/vendor-bitget` 通过构建。
  - 补充合约账户余额为 position：`services/accounts/futures.ts` 将 UTA 账户资产（USDT 等）映射为 balance position，与持仓列表合并输出。
- **修改的文件**：
  - 删除 `apps/vendor-bitget/src/api/private-api.ts`, `apps/vendor-bitget/src/api/public-api.ts`；重命名并扩充 UTA 版本。
  - 更新 `services/accounts/*`, `services/orders/*`, `services/markets/*` 依赖新的 UTA API。
  - `apps/vendor-bitget/SESSION_NOTES.md`, `apps/vendor-bitget/AGENTS.md`（指令同步）。
- **运行的测试 / 检查**：
  - 命令：`npx -y node@22.12.0 common/scripts/install-run-rush.js build --to @yuants/vendor-bitget`
  - 结果：通过

### 2025-11-26 — Antigravity

- **本轮摘要**：
  - 重构 vendor-bitget 以使用 `@yuants/exchange` 的 `provideExchangeServices`，实现统一的服务注册与管理。
  - 引入 Globalized Product ID 格式 `BITGET/InstType/Symbol`，替代旧的 `InstType/Symbol`，并移除 `account_id` 路由依赖。
  - 清理 `services/legacy.ts`、`account-actions-with-credential.ts`、`order-actions-with-credential.ts`，保留 `services/transfer.ts`。
  - 更新所有订单操作（Submit/Cancel/Modify）及账户服务（Futures/Spot）以适配新的 Product ID 格式。
  - 拆分 `listOrders` 为 `listSpotOrders` 和 `listFuturesOrders`，移除 `account_id` 依赖。
  - 修正 `credentialId` 格式为 `BITGET/<uid>`。
- **修改的文件**：
  - `apps/vendor-bitget/package.json`（新增 `@yuants/exchange`）
  - `apps/vendor-bitget/src/index.ts`
  - `apps/vendor-bitget/src/services/exchange.ts`（新增）
  - `apps/vendor-bitget/src/services/markets/product.ts`
  - `apps/vendor-bitget/src/services/orders/*`
  - `apps/vendor-bitget/src/services/accounts/*`
  - `apps/vendor-bitget/AGENTS.md`
- **详细备注**：
  - `provideExchangeServices` 统一了凭证管理与服务分发；
  - 所有 `product_id` 均通过 `encodePath` 生成，确保格式统一；
  - 遗留的 transfer 代码保留在 `services/transfer.ts` 中，未做逻辑变更。
- **运行的测试 / 检查**：
  - 命令：`npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json`
  - 结果：通过

### 2025-11-20 — Antigravity

- **本轮摘要**：
  - 补全 Bitget 供应商缺失功能：Spot/Future 的 `listOrders`, `modifyOrder`；Spot 的 `placeOrder`, `cancelOrder`。
  - 实现行情数据服务：Spot/Future 的 `ohlc`；Spot 的借贷利率（`interest-rate`）。
  - 修复 Spot 利率实现，正确拆分 Base/Quote 并映射 Long/Short 利率。
  - 修复 OHLC duration 格式，采用 RFC 3339 标准（如 `PT1M`）。
  - 修复 `listOrders` 返回类型，严格对齐 `IOrder` 接口（移除 `client_order_id`，修正 `type`/`side`/`status` 映射）。
  - 重构 Spot 利率实现：新增 `getSpotSymbols` API，使用 `createCache` 缓存 Spot 交易对信息；切换至 `private-api` 调用 `getSpotCrossInterestRate` (需鉴权)，并正确映射 `dailyInterestRate` 为小时利率。
  - 更新 `vendor-supporting.md` 反映最新支持状态。
- **修改的文件**：
  - `apps/vendor-bitget/src/api/private-api.ts`, `apps/vendor-bitget/src/api/public-api.ts`
  - `apps/vendor-bitget/src/services/orders/*`
  - `apps/vendor-bitget/src/services/markets/*`
  - `apps/vendor-bitget/src/services/order-actions-with-credential.ts`
  - `apps/vendor-bitget/src/index.ts`
  - `docs/zh-Hans/vendor-supporting.md`
- **详细备注**：
  - Spot 改单采用 `cancel-replace` 模式；
  - OHLC 实现了 Bitget 粒度到内部标准秒数的映射；
  - Spot 利率数据通过 `getSpotCrossInterestRate` 获取，并按 OKX 模式映射 Base/Quote 借贷利率。
- **运行的测试 / 检查**：
  - 命令：`npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json`
  - 结果：通过

### 2025-11-17 — Codex

- **本轮摘要**：
  - 为 `services/accounts/profile.ts` 引入按凭证 key（`access_key:passphrase`）驱动的 `createCache`，解决凭证化 account actions 反复触发 `getAccountInfo` 的问题；
  - 默认账户 helper（`getFuturesAccountId`, `getSpotAccountId`, `getUid`, `isMainAccount` 等）改为复用新的 `resolveAccountProfile`，减少 TTL 内的 API 调用。
- **修改的文件**：
  - `apps/vendor-bitget/src/services/accounts/profile.ts`
- **详细备注**：
  - Profile TTL 设为 60 秒，cache miss 会抛错；`accountProfileCache` 仍导出供其他模块共享；
  - 未涉及 API Schema 或指令调整。
- **运行的测试 / 检查**：
  - 命令：`n/a`
  - 结果：未运行（建议后续变更执行 `npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json`）

### 2025-11-17 — Codex

- **本轮摘要**：
  - 参照 vendor-aster 的 services 分层迁移 Bitget 默认账户、挂单、行情、转账逻辑：新增 `src/services/accounts/*`, `services/legacy.ts`, `services/markets/*`, `services/transfer.ts`，`index.ts` 仅聚合 services。
  - 增加 `services/account-actions-with-credential.ts`，复用期货/现货快照 helper，支持凭证化 `ListAccounts/GetAccountInfo`。
  - 同步 `apps/vendor-bitget/docs/context/AGENTS.md` 与 `SESSION_NOTES.md`，更新架构描述与临时指令。
- **修改的文件**：
  - `apps/vendor-bitget/src/index.ts`, `apps/vendor-bitget/src/services/**/*`
  - `apps/vendor-bitget/docs/context/AGENTS.md`, `apps/vendor-bitget/docs/context/SESSION_NOTES.md`
- **详细备注**：
  - `services/accounts/profile.ts` 缓存 UID/parentId，供 transfer、legacy、凭证化服务共享；
  - `services/legacy.ts` 合并默认账户快照与 Submit/Cancel，避免重复注册 Terminal；
  - `services/markets/*` 纯粹负责产品/行情/资金费率，路径与 vendor-aster 保持一致。
- **运行的测试 / 检查**：
  - 命令：`npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json`
  - 结果：通过

### 2025-11-17 — Codex

- **本轮摘要**：
  - 将 `order-actions-with-credential.ts` 对齐 vendor-okx：使用 `provideOrderActionsWithCredential` 并强制 `credential.type = 'BITGET'` 协议，避免重复注册 Schema。
  - 在 `AGENTS.md` 与中英文 implementation checklist 中记录“凭证化 RPC 必须通过 helper 注册”的原则。
  - 逐条核对 public/private API 注释：修正 `getMarginCurrencies` 返回类型并确认文档链接；对 404 的 `Get-Symbols`/`Get-Order-Pending`/`spot Get-Pending-Orders` 改为可访问的 bitgetlimited GitHub 备份文档；`getSpotOrdersPending` 按官方 `Get-Unfilled-Orders` 重新实现。
- **修改的文件**：
  - `apps/vendor-bitget/src/order-actions-with-credential.ts`, `apps/vendor-bitget/src/api/public-api.ts`, `apps/vendor-bitget/src/api/private-api.ts`
  - `apps/vendor-bitget/docs/context/AGENTS.md`
  - `docs/en/vendor-guide/implementation-checklist.md`, `docs/zh-Hans/vendor-guide/implementation-checklist.md`
- **详细备注**：
  - Submit/Cancel 失败会抛出错误，由框架返回非 0 code；
  - 未来如需 `ModifyOrder` / `ListOrders` 可在 helper actions 中扩展。
- **运行的测试 / 检查**：
  - 命令：未运行
  - 结果：n/a（待下一轮运行 `npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json`）

### 2025-11-17 — Codex

- **本轮摘要**：
  - 从 commit `b00e9aa7` 前的 `src/api.ts` 恢复 Bitget API 文档注释（限频、用途、官方链接），并同步到 `api/public-api.ts` / `api/private-api.ts`。
  - 为缺失的 pending-order 接口补充官方文档注释，保持与旧实现一致的描述风格。
- **修改的文件**：
  - `apps/vendor-bitget/src/api/public-api.ts`, `apps/vendor-bitget/src/api/private-api.ts`
- **详细备注**：
  - 文档内容与原版一致（中文描述 + 限速提示 + 链接），避免再次出现“any 无注释”的回归；
  - 其余类型逻辑沿用上一轮更新。
- **运行的测试 / 检查**：
  - 命令：无
  - 结果：n/a（可在后续类型检查中一并验证）

### 2025-11-17 — Codex

- **本轮摘要**：
  - 恢复并补充 Bitget public/private API 的文档注释，列出 REST 路径及官方链接；所有 helper 均定义显式类型，移除 `any`。
  - 为公共数据与 interest-rate 脚本接入新的响应类型；更新 implementation checklist（中英）强调“禁止使用 any”与“API helper 必须携带 doc”。
- **修改的文件**：
  - `apps/vendor-bitget/src/api/client.ts`, `apps/vendor-bitget/src/api/public-api.ts`, `apps/vendor-bitget/src/api/private-api.ts`
  - `apps/vendor-bitget/src/services/markets/product.ts`, `apps/vendor-bitget/src/services/markets/quote.ts`, `apps/vendor-bitget/src/services/markets/interest-rate.ts`
  - `docs/en/vendor-guide/implementation-checklist.md`, `docs/zh-Hans/vendor-guide/implementation-checklist.md`
- **详细备注**：
  - `requestPublic*` 等 helper 现以泛型替代 `any`，保持响应推断；
  - 文档要求明确记录 API URL，避免误删注释的回归。
- **运行的测试 / 检查**：
  - 命令：未运行（类型与文档调整）
  - 结果：n/a（建议下轮执行 `npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json` 验证类型更改）

### 2025-11-17 — Codex

- **本轮摘要**：
  - 创建 `apps/vendor-bitget/docs/context/AGENTS.md` 与 `SESSION_NOTES.md`，将 commit `b00e9aa7` 的架构、指令、风险固化到上下文文档。
  - 收敛指令范围到 Bitget 项目，删除根目录临时文件。
- **修改的文件**：
  - `apps/vendor-bitget/docs/context/AGENTS.md`
  - `apps/vendor-bitget/docs/context/SESSION_NOTES.md`
  - （删除）`AGENTS.md`, `codex/SESSION_NOTES.md`
- **详细备注**：
  - 本轮仅文档调整；临时指令“只整理文档”已写入 2.3 节。
- **运行的测试 / 检查**：
  - 命令：无（文档工作）
  - 结果：n/a

### 2025-11-14 — Siyuan Wang（commit b00e9aa7）

- **本轮摘要**：
  - 重构 Bitget vendor，拆分 public/private API，新增账户缓存、pending services、credential-aware RPC、公用数据模块与 transfer 状态机。
  - 更新 README、vendor docs 与 implementation checklist。
- **修改的文件**：
  - `apps/vendor-bitget/README.md`, `apps/vendor-bitget/src/account.ts（2025-11-17 起拆分为 services/accounts/* 与 services/legacy.ts）`, `apps/vendor-bitget/src/api/*`, `apps/vendor-bitget/src/order-actions*.ts（现位于 services/*）`, `apps/vendor-bitget/src/public-data/*（现位于 services/markets/*）`, `apps/vendor-bitget/src/transfer.ts（现位于 services/transfer.ts）`, `docs/en|zh-Hans/packages/@yuants-vendor-bitget.md`, `docs/en/vendor-guide/implementation-checklist.md`
- **详细备注**：
  - 删除旧 `src/api.ts`；`src/index.ts` 仅导入模块。
  - Transfer 模块覆盖 TRC20、Spot↔Futures、Parent/Sub 通路。
- **运行的测试 / 检查**：
  - 命令：未在提交信息中提供
  - 结果：未知（需按 7.1 TODO 补测）

---

## 7. 当前 TODO / 任务列表（Tasks & TODO）

### 7.1 高优先级

- [ ] 依据 `docs/en/vendor-guide/implementation-checklist.md` 执行完整手动验证：账户、挂单、产品、Quote、Submit/Cancel、TransferApply/Eval，并在 6 节记录结果。
- [ ] 为 credential-aware Submit/Cancel 添加 e2e/smoke 测试脚本（最小下单+撤单），验证多凭证流程。
- [ ] 在 `private-api.ts` 高频接口（pending orders、funding time、spot/futures 资产）启用 `request*WithFlowControl`，避免 429。

### 7.2 中优先级

- [ ] 编写运维手册/CLI 示例文档，解释 transfer-controller 如何选择 TRC20 / 内部 / 子账号通路。
- [ ] 统一 `services/markets/quote.ts` 与 SQL `product` 表的同步机制，确保冷启动时 funding 任务能获取 product 列表。

### 7.3 想法 / Nice-to-have

- [ ] 引入 Bitget WebSocket 报价 + REST fallback，降低延迟。
- [ ] 评估是否需要现货的 credential-aware RPC（当前仅支持 USDT Futures）。

---

## 8. 风险点 / 容易踩坑的地方（Risks & Gotchas）

- **链上提现仅主账户可用**

  - 影响：子账户凭证将导致 TRC20 Withdraw 卡在 INIT；
  - 建议：部署前确认使用主账户凭证；若需子账户提现需额外授权并记录。

- **API 限速 / 流控缺失**

  - 背景：pending orders、funding time 等仍直接调用 `requestPrivate`；
  - 影响：Bitget 429 会终止服务，导致账户/挂单断更；
  - 建议：实现 TODO 中的 flow-control，日志保留 trace_id。

- **SQL 写入压力**
  - 背景：`quote.ts` 在 `WRITE_QUOTE_TO_SQL=1` 时每秒写库；
  - 建议：确认数据库 IOPS；必要时调低 `writeInterval` 或分批写入。

---

## 9. 尚未解决的问题（Open Questions）

- **O1：Credential-aware RPC 是否需要支持 Spot/Margin？**

  - 现状：已支持 Spot/Margin 的下单、撤单、改单及利率查询。
  - 结论：已解决。

- **O2：公共数据是否需要 WebSocket？**
  - 现状：REST 轮询；
  - 方案 A：维持现状，依赖 retry；
  - 方案 B：使用 Bitget WebSocket，REST 作为备援。

---

## 10. 下一位 Agent 的建议行动（Next Steps）

1. 阅读本文件 2/3/4/7 节与 `AGENTS.md`，确认指令范围。
2. 优先执行 7.1 的手动验证和 credential-aware 测试，记录结果。
3. 开始任何 API 调用前确认凭证来自主账户并在 8 节登记潜在风险。
4. 完成改动后更新 6/7/8/9/10 节，并在 11 节清理草稿。

---

## 11. 当前会话草稿 / Scratchpad

### 2025-12-08 — Codex

- 新增 UTA “Get Account Assets” API helper（GET `/api/v3/account/assets`，20/s UID），类型对齐文档，仅返回非零余额；已从 `private-api.ts` 拆出单独文件 `src/api/uta-account-api.ts`，尚未接入账户服务。
- 在 `src/api/private-api` 中补充 UTA 资产/交易接口：资金账户资产 `getAccountFundingAssets`、持仓 `getCurrentPosition`、未成交订单 `getUnfilledOrders`、下单 `postPlaceOrder`、改单 `postModifyOrder`、撤单 `postCancelOrder`、账户设置 `getAccountSettings`；保留转账/提现相关接口以兼容 transfer 服务。
- 新增 `src/api/public-api` 覆盖 UTA 公共接口：`getInstruments`、`getTickers`、`getOpenInterestV3`、`getCurrentFundingRate`、`getHistoryFundingRate`、`getHistoryCandles`。
- 删除老版 `api/private-api.ts`、`api/public-api.ts`，并重构账户/订单/行情服务依赖 UTA 接口。
- 运行 `npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json` ✅。
