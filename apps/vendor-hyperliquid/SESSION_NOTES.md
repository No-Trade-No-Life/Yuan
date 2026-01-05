# Hyperliquid Vendor — Session Notes

> 单一真相源：记录当前目标、指令、决策与 TODO。所有 Agent 在动手前务必同步此文件；当前版本已对齐最新的 `skills/context-management/SESSION_NOTES.template.md`。

---

## 0. 元信息（Meta）

- **项目名称**：@yuants/vendor-hyperliquid
- **最近更新时间**：2025-12-26 15:30（由 Codex Agent 更新，接入 REST/IP tokenBucket 主动限流）
- **当前状态标签**：已接入 REST/IP 主动限流（等待线上验证与观测增强）

---

## 1. 项目整体目标（High-level Goal）

- 为 Hyperliquid 提供统一的账户信息、挂单、公共行情与交易 RPC，使 trade-copier / Web UI / CLI 可以直接复用。
- 将 CLI 与常驻进程行为对齐，通过 `Terminal.fromNodeEnv()` 连接统一控制面。
- 所有公共数据脚本统一位于 `src/public-data` 并支持写 SQL + Channel，满足运维 checklist，并在 Quote 中以 mid 价格暂时代替 bid/ask（需在监控层标注）。
- 下单 RPC 必须复用 `src/order-actions/submitOrder.ts`、`src/order-actions/cancelOrder.ts`，默认账户与凭证化版本保持一致，并沿用 `provideOrderActionsWithCredential`。
- 短期内暂不处理链上转账，只关注账户、行情与交易链路的稳定性，待 transfer 状态机方案确定后再扩展。

---

## 2. 指令与约束（Instructions & Constraints）

### 2.1 长期指令快照

- 沟通：对话与 Session Notes 使用中文；源码/注释/对外文档保持英文。
- 架构：`src/index.ts` 只聚合模块；公共 REST 放在 `api/public-api.ts`，签名/凭证逻辑在 `api/private-api.ts` + `api/types.ts`；所有模块使用 `Terminal.fromNodeEnv()`。
- 数据服务：Quote/Interest/Products/OHLC 全部从 `public-data` 暴露；`WRITE_QUOTE_TO_SQL` 为 `'1' | 'true'` 时写库，其余仅发布 Channel。
- 安全：凭证一律来自环境变量或请求参数，禁止硬编码；日志中允许打印地址但不要泄露私钥；更新任何风险开关必须同步至本文件。
- 质量：修改核心逻辑后跑 `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`；请求失败需包含 `formatTime` 日志，并确保 error stack 在 Terminal 侧可追踪。
- 订单：`order-actions/submitOrder.ts` / `order-actions/cancelOrder.ts` 是唯一允许修改的业务入口；`order-actions.ts` 与 `order-actions-with-credential.ts` 仅负责 wiring。
- 凭证化 RPC：现在接受 `{ order, credential: { type: 'HYPERLIQUID', payload: { private_key, address } } }` 的结构；所有调用端需要发 `credential.type = 'HYPERLIQUID'`。

### 2.2 当前阶段指令

- 维持 Hyperliquid vendor 与 `docs/zh-Hans/vendor-guide/implementation-checklist.md` 第 0–5 节一致；若有差异要在 4.3/7 节登记，并在 PR 描述注明理由。
- 建立并维护 AGENTS / SESSION_NOTES，后续每次需求变更必须先在本文件新增背景/决策，再动代码。
- 在落实转账、测试、监控之前，不要上线会破坏现有账户/行情服务的改动；任何涉及凭证或限频调整要提前在 8 节记录风险。
- 单元测试禁止使用 mock；如需 mock 外部依赖或 Terminal，请将场景放入功能/端到端测试中，并在 6 节登记运行结果。

### 2.3 临时指令（短期有效）

- 2025-11-26：交易/账户服务已改为 `@yuants/exchange::provideExchangeServices`，product_id 采用 `HYPERLIQUID/<instType>/<symbol>` 的全局路径；路由一律使用 `decodePath(product_id)`，account_id 仅作标签不做路由；旧的 account actions / order actions / legacy 服务已删除。
- 2025-11-19：已完成接口设计优化和 API 文档补充。主要变更包括 ICredential 接口重构、文档链接恢复、代码设计原则文档化。
- 所有调用端需要确认 `provideOrderActionsWithCredential` 新 schema（`credential.type/payload`）；在完成验证前，暂不再调整请求字段，防止多次破坏兼容。
- 下一轮若要继续推进 transfer/E2E，请依据 7.1 TODO 拆分计划，先更新本文件再开工。
- 若需要引用其它仓库/文档，仅在此记录摘要并提供路径。

### 2.4 指令冲突与变更记录

- 暂无冲突记录。如在 checklist 与人类指令之间发现冲突，按 `AGENTS.md` 3.4 流程记录。

---

## 3. 当前阶段的重点目标（Current Focus）

- 固化 Hyperliquid vendor 的上下文管理（AGENTS + Session Notes），确保 order-actions 重构信息可追溯。
- 自查账户、挂单、quote、interest-rate、ohlc、交易 RPC 与 checklist 的一致性，并验证凭证化 RPC 新 schema 被调用端接受。
- 列出尚未覆盖的 checklist 项（如 `transfer.ts`、E2E 测试）并排期。

---

## 4. 重要背景与关键决策（Context & Decisions）

### 4.1 架构 / 模块概览

- `src/index.ts`：聚合入口，按照新目录结构导入所有服务模块。
- `src/api/public-api.ts` / `src/api/private-api.ts`：REST helper；公共接口无凭证，私有接口接收 `ICredential` 并使用 `sign.ts`。
- `src/services/utils.ts`：工具函数集合，包含 `resolveAssetInfo`、`buildOrderPayload` 等核心逻辑（原 `order-utils.ts`）。
- **新目录结构（参考 vendor-aster）**：
  - `src/services/accounts/`：账户相关服务（perp.ts）
  - `src/services/orders/`：订单相关服务（submitOrder.ts, cancelOrder.ts, modifyOrder.ts）
  - `src/services/markets/`：市场数据服务（product.ts, quote.ts）
  - `src/services/`：根级服务（order-actions-with-credential.ts, fill-history.ts, interest-rate-service.ts, ohlc-service.ts）
- **代码规范变更**：
  - 所有 `console.log` 统一改为 `console.info` 以遵循项目标准
  - 服务文件导入路径按照新目录结构调整
- `src/cli.ts`：仅 `import './index'`，确保 CLI 与常驻行为一致。

### 4.2 已做出的关键决策

- **[D1] 默认账户使用环境变量 `PRIVATE_KEY` 推导**

  - 背景：Hyperliquid 只有地址签名，无官方 UID；需要唯一 account_id。
  - 决策：`getDefaultCredential()` 从 `PRIVATE_KEY` 创建钱包并生成 `hyperliquid/<address>/perp/USDC`（见 `account.ts`）。
  - 影响：部署环境必须提供私钥；`order-actions.ts` / `account.ts` / `pending orders` 共用同一账户。

- **[D2] Quote 写库由 `WRITE_QUOTE_TO_SQL` 控制**

  - 背景：运维希望 Channel 始终存在，但写库可按需要开启。
  - 决策：`public-data/quote.ts` 仅在 env 匹配 `/^(1|true)$/i` 时写入 SQL，其余情况下只发布 Channel。
  - 影响：Checklist 第 4 节要求已满足；需要在运维手册说明可用值。

- **[D3] 交易 RPC 分为默认凭证与请求级凭证**
  - 背景：copier 需要固定账户，外部服务可能传入临时凭证。
  - 决策：保持 `order-actions.ts`（默认）+ `order-actions-with-credential.ts` 并共享 `order-utils.ts`。
  - 影响：扩展多账户时只需复制 credential 校验逻辑，仍需在 Session Notes 记录新增账户。
- **[D4] 凭证化 Submit/Cancel 统一通过 helper 暴露**

- **[D5] ICredential 接口设计优化（2025-11-19）**

  - 背景：原接口包含 `private_key` 和 `address`，其中 `address` 可从私钥推导，存在冗余状态。
  - 决策：重构接口为纯数据结构，将 `address` 推导逻辑分离到辅助函数 `getAddressFromCredential()`。
  - 变更：

    ```typescript
    // 优化前
    export interface ICredential {
      private_key: string;
      address: string;
    }

    // 优化后
    export interface ICredential {
      private_key: string;
    }
    export const getAddressFromCredential = (credential: ICredential): string => {
      const wallet = new Wallet(credential.private_key);
      return wallet.address;
    };
    ```

  - 影响：消除数据冗余，提高类型安全性，遵循接口纯粹性原则。
  - 更新文件：`src/api/types.ts`, 所有调用方文件

- **[D6] API 文档链接补充（2025-11-19）**

  - 背景：从 git 提交 895d7520 发现原有完整 API 文档链接，在重构过程中丢失。
  - 决策：恢复所有 API 函数的官方文档链接，指向 Hyperliquid GitBook 具体章节。
  - 恢复的文档链接：
    - Private API: placeOrder, cancelOrder, modifyOrder, getUserFills
    - Public API: getUserPerpetualsAccountSummary, getPerpetualsMetaData, getSpotMetaData, getUserFundingHistory, getUserOpenOrders, getHistoricalFundingRates, getMetaAndAssetCtxs, getCandleSnapshot
  - 影响：开发者可直接通过 IDE 智能提示访问官方文档，提升开发效率。
  - 更新文件：`src/api/private-api.ts`, `src/api/public-api.ts`

- **[D7] 代码设计原则写入 AGENTS.md（2025-11-19）**

  - 背景：在接口设计优化过程中总结的设计原则需要文档化，供后续开发遵循。
  - 决策：在 `AGENTS.md` 中新增"代码设计原则"章节，详细记录 Interface 纯粹性、数据与行为分离等原则。
  - 新增原则：
    - Interface 保持纯粹性，只包含核心数据字段
    - 通过辅助函数提供行为逻辑
    - 使用 `get[Property]From[Type]` 命名规范
    - 提供向后兼容转换函数
  - 影响：建立团队开发标准，确保代码架构一致性。

- **[D5] 目录结构重构参考 vendor-aster**

  - 背景：原有扁平化结构难以维护，需要更清晰的服务分组和职责分离。
  - 决策：采用 `services/accounts/`、`services/orders/`、`services/markets/` 三层结构，与 vendor-aster 保持一致。
  - 影响：提升代码可维护性，明确服务职责分离，便于后续功能扩展和多 Agent 协作。

- **[D6] 日志输出统一使用 console.info**

  - 背景：项目要求使用 console.info 而非 console.log 以保持日志输出一致性。
  - 决策：所有服务模块中的 console.log 替换为 console.info，保持错误信息仍使用 console.error。
  - 影响：统一日志输出格式，便于日志分析和系统监控。

- **[D8] 接入 Hyperliquid REST/IP 主动限流（2025-12-26）**
  - 背景：官方说明 REST 请求按 IP 聚合限额 `1200 weight / minute`，且 `info/exchange` 不同 type/action 有不同 weight；当前 vendor 存在高频轮询（quote/ohlc）容易触发 429。
  - 决策：
    - 在 `src/api/client.ts` 的 `fetch` 前执行 `tokenBucket(...).acquireSync(weight)`，不足时直接抛错（不捕获），交给上层 retry/backoff。
    - weight 计算与额外加权策略集中在 `src/api/rate-limit.ts`，以 rule registry 的方式保持开闭原则（新增 type 只加规则，不改核心流程）。
    - `candleSnapshot` 的额外 weight 按官方“最多 5000 根 candles”做有界估算；响应后按返回条数计算 `deltaWeight` 并用 `await tokenBucket(...).acquire(deltaWeight)` 阻塞等待（不使用 acquireSync，避免响应后因令牌不足报错）。
    - 若收到 429：先打印日志并抛错（不做 client 内主动退避；等待官方文档明确后再补）。
    - WebSocket 限流本轮不实现；address-based 动态 action budget 本轮不实现，仅保留扩展点。
  - 影响：上层调用链需要能承接 `HYPERLIQUID_API_RATE_LIMIT` 抛错（scopeError 包装）并做重试/退避。
  - 验证命令（项目目录 `apps/vendor-hyperliquid`）：
    - `./node_modules/.bin/tsc --noEmit --project tsconfig.json`
    - `./node_modules/.bin/heft test --clean`

### 4.3 已接受的折衷 / 技术债

- 未实现 `src/transfer.ts`（checklist 第 6 节仍是缺口）。需规划账户转账、地址注册与状态机。
- 缺少自动化 E2E / submit-order 测试脚本；目前仅靠 TS 编译和人工自测。
- 产品/quote 等使用 REST 轮询 + RxJS，暂未加入 WebSocket 或断线重连回补，需监控延迟。
- Account ID 通过环境私钥推导，未使用 `@yuants/cache`；如后续需要多账户，需要重新评估。
- 凭证化 Submit/Cancel 请求形态已变化，但 trade-copier/CLI 的兼容性尚未验证，可能需要提供迁移指引或兼容层。
- `cancelOrderAction` 依赖 `order.comment` 中的 JSON `asset_id` 或 `resolveAssetInfo` 的 REST 回落；缺乏测试覆盖，错误将直接抛出至 Terminal。

---

## 5. 关键文件与模块说明（Files & Modules）

- `src/services/exchange.ts`：通过 `provideExchangeServices` 暴露交易/账户接口，强制使用凭证 + 全局 product_id 路由。
- `src/services/accounts/{perp,spot}.ts`：基于 `getUserPerpetualsAccountSummary` / `getUserTokenBalances` 的持仓快照。
- `src/services/orders/{submitOrder,cancelOrder,modifyOrder,listOrders}.ts`：下单/撤单/改单与未成交订单查询，依赖 `resolveAssetInfo` 与全局 product_id。
- `src/services/markets/{product,quote,interest-rate,ohlc}.ts`：产品列表、行情、资金费率、K 线等公共数据服务。
- `src/services/utils.ts`：产品路径解析、资产元数据缓存、价格 round/中间价估算。

---

## 6. 最近几轮工作记录（Recent Sessions）

> 约定：仅记录已经结束的会话；进行中的内容放在第 11 节，收尾后再搬运；按时间倒序追加。

### 2026-01-07 — Codex

- **本轮摘要**：
  - 为切换到 `ohlc_v2`，移除基于 `createSeriesProvider` 的历史数据脚本（markets/ohlc、markets/interest-rate）。
  - 清理 `src/index.ts` 中对应模块导入，避免旧表链路继续注册。
- **修改的文件**：
  - `apps/vendor-hyperliquid/src/services/markets/ohlc.ts`（删除）
  - `apps/vendor-hyperliquid/src/services/markets/interest-rate.ts`（删除）
  - `apps/vendor-hyperliquid/src/index.ts`
- **运行的测试 / 检查**：
  - 命令：未运行
  - 结果：未运行（与全仓 ohlc 迁移合并验证）

### 2025-12-03 — Codex Agent

- **本轮摘要**：
  - 为 perp 账户补充 USDC 余额，使用清算所 `marginSummary.accountValue - Σ(unrealizedPnl)` 作为现金余额生成 `PERPETUAL-ASSET` 头寸（避免被当作永续品种），修复 equity 缺失现金的问题。
  - Spot 账户估值改为使用 `allMids` 当前价格折算为 USDC，浮盈与估值同步更新。
  - 修复 API 返回 null 时的健壮性：spot 余额与 open orders 为空时不再抛异常。
- **修改的文件**：
  - `apps/vendor-hyperliquid/src/services/accounts/perp.ts`（新增 USDC 资产头寸，过滤 USD/USDC 不再标记为永续）
  - `apps/vendor-hyperliquid/src/services/accounts/spot.ts`（引入 allMids 现价折算，填充估值/浮盈）
  - `apps/vendor-hyperliquid/src/services/orders/listOrders.ts`（空列表兼容）
  - `apps/vendor-hyperliquid/src/services/exchange.ts`（支持按 product_id 查询 `PERPETUAL-ASSET` 头寸）
- **运行的测试 / 检查**：
  - 命令：`npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`
  - 结果：Passed

### 2025-12-08 — Codex

- **本轮摘要**：
  - spot 账户的产品映射增加缓存（24 小时 TTL），避免每次查询 positions 都重新拉产品列表；产品列表加载失败时仍会回退旧的 product_id 生成逻辑。
- **修改的文件**：
  - `apps/vendor-hyperliquid/src/services/accounts/spot.ts`
- **运行的测试 / 检查**：
  - `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`

### 2025-12-08 — Codex

- **本轮摘要**：
  - spot 账户在生成 position 前读取最新 spot product 列表，构建 base → product_id 的映射，用余额资产匹配 product_id，避免硬编码 `${asset}-USDC`。
- **修改的文件**：
  - `apps/vendor-hyperliquid/src/services/accounts/spot.ts`
- **运行的测试 / 检查**：
  - `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`

### 2025-11-26 — Codex Agent

- **本轮摘要**：
  - 交易与账户服务改用 `@yuants/exchange::provideExchangeServices` 统一暴露，移除 legacy/account-actions/order-actions 旧入口。
  - 全量切换 product_id 为全局路径 `HYPERLIQUID/<instType>/<symbol>`，quote/interest-rate/ohlc/订单/持仓均通过 `decodePath(product_id)` 路由，移除对 account_id 的路由依赖。
  - 更新 product/quote/interest-rate/ohlc 数据服务以匹配新的 product_id 结构，并补充 exchange 层的 product 列表复用。
  - 凭证接口 `ICredential` 增加 `address` 字段并删除 `getAddressFromCredential`，所有账户/订单请求直接使用 `credential.address`。
  - CredentialId 前缀改为大写 `HYPERLIQUID/`，列表订单的 `account_id` 输出统一置空字符串（下游不再用 account_id 路由）。
- **修改的文件**：
  - `src/services/exchange.ts`（新增 exchange 入口）
  - `src/index.ts`、`src/services/markets/*`、`src/services/orders/*`、`src/services/accounts/*`、`src/services/utils.ts`（product_id 与路由调整）
  - `package.json`、`tsconfig.json`（依赖与路径配置）
  - `AGENTS.md`、`SESSION_NOTES.md`
- **运行的测试 / 检查**：
  - 命令：`rushx build`（含 tsc + api-extractor + yuan-toolkit post-build）
  - 结果：TypeScript 编译通过，但 `yuan-toolkit post-build` 报错 `TypeError: Cannot read properties of undefined (reading 'model')`（未生成错误日志）。需要后续排查 post-build 依赖（可能与 docker 镜像或工具链配置有关）。

### 2025-11-22 — Antigravity Agent

- **本轮摘要**：
  - 重构账户服务：将 `perp.ts` 和 `spot.ts` 重构为纯异步函数，移除副作用。
  - 建立 Legacy 兼容层：创建 `src/services/legacy.ts`，承载原有的 `provideAccountInfoService` 和 `providePendingOrdersService`，并恢复了被删除的默认账户 `SubmitOrder` 和 `CancelOrder` 服务。
  - 代码去重：清理 `account-actions-with-credential.ts`，复用新的纯函数逻辑。
  - 提交分析：分析了 commit `94c6a267`，确认其引入了 `@yuants/cache` 并更新了文档。
- **修改的文件**：
  - `src/services/accounts/perp.ts`（重构为纯函数）
  - `src/services/accounts/spot.ts`（重构为纯函数）
  - `src/services/legacy.ts`（新增，承载旧服务）
  - `src/services/account-actions-with-credential.ts`（清理重复代码）
  - `src/index.ts`（更新导入）
- **详细备注**：
  - 此次重构对齐了 `vendor-aster` 的设计模式，实现了逻辑与服务注册的分离。
  - 恢复 Legacy Order Actions 保证了对旧有调用方式的兼容性。
- **运行的测试 / 检查**：
  - 命令：`npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`
  - 结果：Passed

### 2025-11-21 — Antigravity Agent

- **本轮摘要**：
  - 补全 Hyperliquid vendor 功能：Spot 账户信息、成交流水服务。
  - 规范化 Account ID：移除 `/USDC` 后缀，统一使用 `hyperliquid/${walletAddress}/perp` 和 `hyperliquid/${walletAddress}/spot`。
  - 统一账户估值货币：Perp 账户 money 字段 currency 调整为 `USD`。
  - 新增 `src/services/accounts/spot.ts` 实现现货账户信息查询。
- **修改的文件**：
  - `src/services/accounts/perp.ts`（Account ID 格式调整，Currency 调整）
  - `src/services/accounts/spot.ts`（新增）
  - `src/index.ts`（导入新服务）
- **详细备注**：
  - Account ID 变更属于 Breaking Change，需通知下游依赖。
  - Spot 账户目前仅支持余额查询，暂不支持下单（API 限制）。
- **运行的测试 / 检查**：
  - 命令：`npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`
  - 结果：Passed

### 2025-11-19 — Claude Agent

- **本轮摘要**：
  - 补全 Hyperliquid vendor 缺失的核心交易功能：未成交订单查询、成交流水、改单功能。
  - 重构代码目录结构，参考 vendor-aster 采用服务分层架构。
  - 统一代码规范，将所有 console.log 改为 console.info。
  - 新增 `src/services/fill-history.ts` 实现成交流水服务，支持 `/UserFillHistory` 接口。
  - 新增 `src/services/orders/modifyOrder.ts` 实现改单功能，通过 cancel + place new 策略。
  - 扩展 `src/api/private-api.ts` 添加 `getUserFills` API 封装。
  - 更新 `vendor-supporting.md` 将 Hyperliquid 现货和永续合约的功能状态标记为完整支持。
  - 将 modifyOrder 正确注册到凭证化 RPC 服务中。
- **修改的文件**：
  - **目录重构**：
    - `src/services/accounts/perp.ts`（从 account.ts 迁移）
    - `src/services/orders/submitOrder.ts`（从 order-actions/ 迁移）
    - `src/services/orders/cancelOrder.ts`（从 order-actions/ 迁移）
    - `src/services/orders/modifyOrder.ts`（新增）
    - `src/services/markets/`（从 public-data/ 迁移所有文件）
    - `src/services/fill-history.ts`（新增）
    - `src/services/order-actions-with-credential.ts`（从根目录迁移）
  - **其他文件**：
    - `src/services/utils.ts`（从 order-utils.ts 重命名）
    - `src/api/private-api.ts`（扩展 getUserFills）
    - `src/index.ts`（更新导入路径）
    - `docs/zh-Hans/vendor-supporting.md`（更新功能状态）
- **详细备注**：
  - 新目录结构提升代码可维护性，服务职责更清晰
  - 成交流水服务支持时间范围查询和完整字段映射，符合 Yuan Protocol 规范
  - 改单功能通过取消原订单 + 下新订单实现，Hyperliquid API 无原生改单接口
  - 所有新服务遵循现有的凭证管理架构，使用 `ICredential` 和签名机制
  - 统一日志输出规范，便于日志分析和系统监控
- **运行的测试 / 检查**：
  - 命令：`npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`
  - 结果：目录重构后存在编译错误，需要修复导入路径和类型定义
  - 状态：待后续会话完成路径修复和类型检查

### 2025-11-15 — Codex Agent

- **本轮摘要**：
  - 全量复查 `SESSION_NOTES` 与 `AGENTS`，确保 order-actions 重构（commit `a5d9208f`）的背景、决策、风险与 TODO 已写入。
  - 将凭证化 Submit/Cancel 新 schema、shared helper 入口、Quote mid 价格策略等信息同步至 1/2/4/5/7/8 节。
  - 清理并补全 TODO / Risks / Open Questions，突出 transfer 方案与调用端兼容性这两个阻塞点。
- **修改的文件**：
  - `apps/vendor-hyperliquid/docs/context/SESSION_NOTES.md`
- **详细备注**：
  - 暂未修改运行时代码；本轮仅更新文档与指令；
  - 新增的短期指令提醒调用端验证 `credential.type/payload` 请求结构，避免多次 breaking change。
- **运行的测试 / 检查**：
  - 命令：`n/a`（仅文档更新）
  - 结果：尚未执行；后续任何代码改动仍需运行 `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`。

### 2025-11-15 — Codex Agent

- **本轮摘要**：
  - 对 commit `a5d9208f` 进行梳理，确认 Submit/Cancel RPC 逻辑被拆分至独立模块并复用 `provideOrderActionsWithCredential`。
  - 回顾 `order-actions-with-credential.ts` 的 Credential 校验、下单/撤单流程，确保新的 `order-actions/submitOrder.ts` 与 `order-actions/cancelOrder.ts` 行为与旧实现一致。
  - 记录此次重构仅涉及代码整理 + Rush changelog，没有新增测试，提醒后续按 7.1 TODO 补集成测试。
- **修改的文件**：
  - `apps/vendor-hyperliquid/src/order-actions-with-credential.ts`
  - `apps/vendor-hyperliquid/src/order-actions/submitOrder.ts`
  - `apps/vendor-hyperliquid/src/order-actions/cancelOrder.ts`
  - `common/changes/@yuants/vendor-hyperliquid/2025-11-15-13-09.json`
- **详细备注**：
  - `order-actions-with-credential.ts` 现在通过框架提供的 helper 注册服务，校验 schema 只保留 address/private_key；
  - `submitOrder`/`cancelOrderAction` 负责抛错而不是写入 message code，RPC handler 统一返回成功响应；
  - 需要在未来测试中覆盖 JSON comment 解析与 asset 解析逻辑，避免重构引入回归。
- **运行的测试 / 检查**：
  - 命令：`n/a`（commit 中未附带测试）
  - 结果：尚未执行；按指令改动核心逻辑后需手动跑 `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`。

### 2025-11-15 — Codex Agent

- **本轮摘要**：
  - 复盘 commit `8edc7b7c` / `c4d75b73` 引入的架构变化（account, public-data, order-actions）。
  - 对照 `docs/zh-Hans/vendor-guide/implementation-checklist.md` 梳理当前实现覆盖面与缺口。
  - 在 `apps/vendor-hyperliquid/docs/context/` 下创建 `AGENTS.md` 与 `SESSION_NOTES.md`，建立上下文管理模板。
- **修改的文件**：
  - `apps/vendor-hyperliquid/docs/context/AGENTS.md`
  - `apps/vendor-hyperliquid/docs/context/SESSION_NOTES.md`
- **详细备注**：
  - 暂未更改任何运行时代码；
  - 仍需为转账接口与自动化测试创建计划（见 TODO）。
- **运行的测试 / 检查**：
  - 命令：`n/a`（仅文档更新）
  - 结果：尚未执行；后续改代码前需跑 `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`。

---

## 7. 当前 TODO / 任务列表（Tasks & TODO）

> 使用勾选框追踪进展；完成的任务用 `[x]`，不要直接删除。

### 7.1 高优先级（下一轮优先处理）

- [ ] 补齐 `@yuants/exchange` 依赖链接/构建（建议 rush install/update 后跑 `tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json` 验证）。
- [ ] 设计并实现 `src/transfer.ts`（地址注册 + TransferApply/Eval 状态机），与 checklist 第 6 节对齐。
- [ ] 为 Submit/Cancel 编写最小 E2E/集成测试或脚本（可参考其他 vendor 的 `src/e2e`），并记录运行方式。
- [ ] 与 trade-copier / CLI 调用方确认 `provideOrderActionsWithCredential` 新 schema（`credential.type/payload` + `order` 包装），并在 README 或示例脚本中同步调用方式。
- [ ] 复查账户/挂单/quote 服务在断线情况下的重试与限频，完善监控/日志。

### 7.2 中优先级 / 待排期

- [ ] 引入 `@yuants/cache` 或等效机制以支持多账户缓存，避免重复推导 address/pending orders。
- [ ] 若 Hyperliquid 官方 WebSocket 可用，评估将 quote/订单流切换为 WS + REST fallback。
- [ ] 在 README 或运维文档中记录 `WRITE_QUOTE_TO_SQL`、`ASSET_CTX_REFRESH_INTERVAL`、`PRIVATE_KEY` 的配置示例。

### 7.3 想法 / Nice-to-have

- [ ] 为 product/interest-rate/ohlc 增加漂移检测或数据质量告警。
- [ ] 将常用命令整理成 `apps/vendor-hyperliquid/README.md`，方便新成员上手。

> 规则：新任务请按优先级归类；每位 Agent 在结束前至少更新“高优先级”区域。

---

## 8. 风险点 / 容易踩坑的地方（Risks & Gotchas）

- **风险 1：缺失 transfer 流程导致资金调度中断**

  - 影响：`@yuants/app-transfer-controller` 无法落地 Hyperliquid，调拨链路会在该 vendor 上报错。
  - 背景：目前尚未实现 `src/transfer.ts`，也没有注册任何 transfer address。
  - 建议：尽快根据 checklist 第 6 节实现 TransferApply/Eval，并在 Session Notes 中记录每次上线。

- **风险 2：`PRIVATE_KEY`/`WRITE_QUOTE_TO_SQL` 等环境变量配置错误**

  - 影响：账户 ID 生成失败或 quote SQL 写入误触发，导致流程中断或数据库写入噪音。
  - 背景：默认凭证完全依赖环境变量；quote writer 通过布尔字符串控制。
  - 建议：在部署模板中显式列出这些变量，并在 7.2 TODO 完成后把样例写入 README。

- **风险 3：REST 轮询延迟累积**

  - 影响：行情/账户数据与真实交易所偏离，trade-copier 决策延迟。
  - 背景：当前 quote/product/interest-rate/ohlc 均使用 REST 轮询 + RxJS，缺少 WS fallback。
  - 建议：在监控中关注更新延迟，并评估 WS 接入可行性（见 7.2 TODO）。

- **风险 4：凭证化 Submit/Cancel 请求结构发生 Breaking Change**
  - 影响：调用端若仍发送旧的 `{ account_id, credential }` 结构，将直接被拒绝或抛异常，导致 trade-copier 无法落单/撤单。
  - 背景：已切换至 `provideOrderActionsWithCredential`，强制要求 `credential.type = 'HYPERLIQUID'` 与嵌套的 `payload`。
  - 建议：按 7.1 TODO 与下游确认，并在 README / 示例中更新；必要时提供向后兼容层或迁移文档。

---

## 9. 尚未解决的问题（Open Questions）

- **问题 1：transfer 实现方案**

  - 当前思路：复用其他 vendor 的 `addAccountTransferAddress` + `TransferApply` 状态机，但 Hyperliquid 是否支持链上/内部划转仍不确定。
  - 备选方案：
    - 方案 A：仅实现内部资金划转，链上提现交由外部钱包；实现成本低，但覆盖面有限。
    - 方案 B：实现链上提现并引入 `current_tx_context`；需要更多测试，但能闭环 transfer controller。

- **问题 2：多账户支持策略**

  - 当前思路：沿用 `getDefaultCredential()` 并在凭证化 RPC 中校验传入地址。
  - 备选方案：
    - 方案 A：引入 `@yuants/cache` 维护 address → account_id 映射，复用 OKX/Bitget 方案。
    - 方案 B：在配置层约定多个 `PRIVATE_KEY_*`，由进程多实例运行；实现简单但难以扩展。

- **问题 3：Quote WebSocket 接入时机**
  - 当前思路：REST 轮询可满足 MVP，但易受限频影响。
  - 备选方案：
    - 方案 A：引用官方 WS，降级 REST；需要实现重连与去重。
    - 方案 B：维持 REST，但通过 `requestWithFlowControl` 加强限频管理；延迟仍较高。
- **问题 4：老调用端如何兼容新的凭证化请求结构**
  - 当前思路：所有调用端逐步升级到 `credential.type/payload` 结构。
  - 备选方案：
    - 方案 A：在 Terminal 层保留旧端点或在 handler 中检测旧结构并做转换（短期兼容，但需额外测试）。
    - 方案 B：通过文档/变更公告强制调用端升级，同时在 E2E 中新增 schema 校验，避免重复 break。

---

## 10. 下一位 Agent 的建议行动（Next Steps for Next Agent）

1. 阅读本文件第 2 节与 `apps/vendor-hyperliquid/docs/context/AGENTS.md`，确认指令是否有更新；如存在 `IMPLEMENTATION_PLAN.md`，一并同步进度。
2. 从 7.1 高优先级列表顶部开始处理，特别是确认 `provideOrderActionsWithCredential` 兼容性与 transfer 方案；若需要更多上下文，可参考 4.1/4.2 的模块说明与决策。
3. 在动手前，审查 `src/services/exchange.ts`、`src/services/orders/*`、`src/services/markets/*` 是否会受到影响，并根据风险 2 校验环境变量。
4. 处理完成后，更新本文件的第 6/7/8/9/10 节，附上测试记录；若任务尚未完成，请在第 11 节记录阻塞点。

当前阻塞：transfer 需求缺少明确方案（问题 1），凭证化 Submit/Cancel 的新请求结构（问题 4）需要调用端确认，同时本地 `tsc` 编译因 `@yuants/exchange` 未构建/未链接而失败（需先完成 rush/pnpm 安装与依赖构建）。

---

## 11. 临时草稿区（Scratchpad，可定期清理）

- （空）当前无临时草稿；若有调试命令、对比数据、临时 TODO，请写在此处并在工作结束时整理。
