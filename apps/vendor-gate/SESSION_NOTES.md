# Gate Vendor — Session Notes

> 单一真相源：记录 `apps/vendor-gate` 的目标、指令、决策、TODO 与风险。遵循 `skills/context-management/SKILL.md`。

---

## 0. 元信息（Meta）

- **项目名称**：@yuants/vendor-gate
- **最近更新时间**：2025-11-18 15:40（由 Codex 更新，完善限速与账户缓存，并补回现货账户逻辑）
- **当前状态标签**：重构中（API/Service 分层已稳定，继续补公共行情与验证）

---

## 1. 项目整体目标（High-level Goal）

- 为 trade-copier、transfer-controller、CLI/Web 运维提供 Gate 交易所账户、挂单、行情与凭证化订单能力。
- 统一 `TypedCredential` 流程，支持默认凭证（legacy）与请求级凭证（account/order actions with credential）。
- 公共 REST helper 复用 typed API + 限速工具，保证日志可审计且不泄露秘钥。
- 非目标：暂不实现 Quote 推送与 SQL 双写（需额外资源时再立项）。

---

## 2. 指令与约束（Instructions & Constraints）

### 2.1 长期指令快照

- 语言：中文文档、英文源码；引用路径需 `path:line`。
- 架构：`src/index.ts` 只 import；API 层拆成 `public-api.ts` / `private-api.ts`，禁止 `any`；服务层集中在 `services/*`。
- 凭证：`type = 'GATE'`，默认凭证仅在 `services/legacy.ts` 使用，其他行为走 `provideAccountActionsWithCredential` / `provideOrderActionsWithCredential`。
- 安全：请求/响应打日志但不泄露秘钥；异常必须抛回 Terminal，不得吞掉。
- 测试：关键改动后运行 `npx tsc --noEmit --project apps/vendor-gate/tsconfig.json`，必要时补充 e2e。

### 2.2 当前阶段指令

- 完全按照 implementation-checklist 推荐目录（api/、services/accounts|orders|markets|transfer）组织代码。
- API JSDoc 视为协议文档，迁移时不得删除；新增接口先补 doc 再写实现。
- account/order actions with credential 已生效：扩展能力需先在 Session Notes 的 TODO 中编号。

### 2.3 临时指令（短期有效）

- 本轮聚焦：① 重写 API & services 结构；② 建立 AGENTS/SESSION_NOTES；③ 实现凭证化 account/order actions；④ 确认默认凭证缺失时模块安全降级。

### 2.4 指令冲突与变更记录

- 暂无记录。若出现冲突，按 SKILL 先登记后执行。

---

## 3. 当前阶段的重点目标（Current Focus）

- 巩固 service-first 架构：确保 account/order actions、legacy、markets、transfer 模块各司其职。
- 清点公共数据缺口（Quote、产品、资金费率）与待办，规划下一阶段的实现顺序。
- 文档化所有约束与风险，避免多 Agent 协作时跑偏。

---

## 4. 重要背景与关键决策（Context & Decisions）

### 4.1 架构 / 模块概览

- `src/api/http-client.ts`：封装 Gate 请求签名 / 日志；复用在 public/private API 中。
- `src/api/public-api.ts`：无鉴权 REST（合约列表、资金费率、order book、tickers）。
- `src/api/private-api.ts`：凭证化 REST（账户、仓位、订单、转账、充值/提现）。
- `src/services/accounts/*`：按账户类型拆分（future/unified/spot + profile 缓存），供 legacy + credential actions 共用。
- `src/services/orders/*`：submit/cancel/listOrders 逻辑（仅永续）。
- `src/services/legacy.ts`：默认凭证 wiring（account info、pending orders、Submit/Cancel RPC）。
- `src/services/order-actions-with-credential.ts`：`provideOrderActionsWithCredential('GATE')`。
- `src/services/account-actions-with-credential.ts`：`provideAccountActionsWithCredential('GATE')`。
- `src/services/markets/product.ts`：产品元数据输出。
- `src/services/interest-rate-service.ts`：资金费率历史写库接口。
- `src/services/transfer.ts`：账户内互转、链上提现地址注册，缺凭证时跳过。

### 4.2 已做出的关键决策

- **[D1] 采用 typed API + 限速器**
  - 背景：旧 `api.ts` 混用 `any` + 内建 flow control，不利于扩展/审计。
  - 方案：`http-client` + `rate-limiter` 作为基础设施，public/private API 仅导出 typed 函数并保留 doc，服务层不再依赖类实例。
  - 影响：API 层可复用/单测化；新增接口需显式写类型。
- **[D2] 保留旧 account_id 格式**
  - 背景：既有 host 使用 `gate/<uid>/future/USDT` 作为固定 ID。
  - 方案：`getAccountIds` 统一生成旧格式，避免影响 Terminal 配置；未来如需升级再另起兼容层。
  - 影响：凭证化服务与 legacy 完全一致，copier 无需额外映射。
- **[D3] 以 credential 为 key 缓存账户档案**
  - 背景：凭证化 API 需要频繁解析 UID/账户 ID，之前用 Map + access_key 作为 key，无法控制过期也难以序列化完整凭证。
  - 方案：引入 `services/accounts/profile.ts`，使用 `createCache` + JSON 序列化 credential 缓存 UID/未来/现货/统一账户 ID，并统一供 legacy 与凭证化服务使用。
  - 影响：避免重复调用 `getAccountDetail`，也能按 TTL 更新；credential 变动时自动失效。

### 4.3 已接受的折衷 / 技术债

- 仅实现永续下单/撤单/listOrders；Spot/Unified 下单尚未排期。
- Quote 频道仍缺失（product/interest rate 具备，Quote 待补）。
- 目前缺少集成测试（仅跑 TypeScript 编译），需要后续补 e2e。

---

## 5. 关键文件与模块说明（Files & Modules）

- `src/api/http-client.ts`: 统一请求签名/日志/限流输入，public/private API 均依赖。
- `src/services/accounts/profile.ts`: 通过 `createCache` 缓存 UID 及 future/spot/unified account_id，供各服务共享。
- `src/services/accounts/spot.ts`: 拉取现货余额，提供 `getSpotAccountInfo`（已恢复丢失的实现）。
- `src/services/orders/listOrders.ts`: 将 Gate open orders 映射为 `IOrder`，供 pending service 与 credential handler 使用。
- `src/services/legacy.ts`: 默认凭证入口（account info、pending orders、Submit/Cancel wiring）。
- `src/services/transfer.ts`: 注册账户互转与链上提现地址，涵盖内转与 TRC20 出入金。

---

## 6. 最近几轮工作记录（Recent Sessions）

### 2026-01-30 — OpenCode

- **本轮摘要**：
  - 在 Gate API 请求层引入 `@yuants/http-services` 的 `fetch`，增加 `USE_HTTP_PROXY` 开关与 `fetchImpl` 回退逻辑。
  - `USE_HTTP_PROXY=true` 时覆盖 `globalThis.fetch`，未开启时优先原生 fetch，不可用则回退。
  - `package.json` 新增 `@yuants/http-services` 依赖。
- **修改的文件**：
  - `apps/vendor-gate/src/api/http-client.ts`
  - `apps/vendor-gate/package.json`
  - `apps/vendor-gate/SESSION_NOTES.md`
- **运行的测试 / 检查**：
  - 命令：未运行（按指令不运行测试）
  - 结果：未运行

### 2026-01-07 — Codex

- **本轮摘要**：
  - 为切换到 `ohlc_v2`，移除基于 `createSeriesProvider` 的历史利率脚本（markets/interest-rate）。
  - 清理 `src/index.ts` 中对应模块导入，避免旧表链路继续注册。
- **修改的文件**：
  - `apps/vendor-gate/src/services/markets/interest-rate.ts`（删除）
  - `apps/vendor-gate/src/index.ts`
- **运行的测试 / 检查**：
  - 命令：未运行
  - 结果：未运行（与全仓 ohlc 迁移合并验证）

### 2025-12-08 — Codex

- **本轮摘要**：
  - 统一账户服务内获取并缓存（24 小时 TTL）最新 spot 产品列表，构建 base → product_id 映射并应用于 spot 余额；同时内联永续持仓逻辑，移除单独的 spot/future 账户实现，统一从 `getUnifiedAccountInfo` 输出头寸。
- **修改的文件**：
  - `apps/vendor-gate/src/services/accounts/unified.ts`
  - 删除：`apps/vendor-gate/src/services/accounts/{spot,future}.ts`
  - `apps/vendor-gate/src/services/exchange.ts`
- **运行的测试 / 检查**：
  - `npx tsc --noEmit --project apps/vendor-gate/tsconfig.json`

### 2025-11-17 — Codex

- 按 checklist 重构目录：新增 `api/http-client.ts`、`api/public-api.ts`、`api/private-api.ts`、`services/accounts/*`、`services/orders/*`、`services/markets/*`、`services/legacy.ts`、`services/transfer.ts`，并移除旧 `api.ts` / `product.ts` / `interest_rate.ts` / 旧 `index.ts`。
- 实现 `account-actions-with-credential` + `order-actions-with-credential`，默认凭证服务使用相同 handler；凭证缺失时自动跳过 legacy/transfer。
- 补齐 AGENTS / SESSION_NOTES 文档，记录长期指令与风险。
- 验证：`npx tsc --noEmit --project apps/vendor-gate/tsconfig.json` ✅。

### 2025-11-18 — Codex

- 将 `RateLimiter` 重写为 class + RxJS 通道，支持每个 `(path, period, limit)` 自动建立/销毁 `Subject`，更贴近旧实现且方便清理。
- 新增 `services/accounts/profile.ts`，使用 `createCache` 按 credential 缓存 UID 和 future/spot/unified account IDs，并统一供 legacy、account-actions-with-credential、transfer 复用；同步在 `package.json` 中声明 `@yuants/cache` 依赖。
- 还原 `services/accounts/spot.ts`，修复误删的现货账户读取逻辑，确保 `getSpotAccountInfo` 可用。
- 验证：`npx tsc --noEmit --project apps/vendor-gate/tsconfig.json` ✅。

---

## 7. TODO / Backlog

### 7.1 高优先级

- [ ] 补充 pending orders/listOrders 的集成验证脚本，确认 status 字段映射（阻塞：缺测试账号）。
- [ ] 实现 Quote service（WS 或 REST fallback），确保 `quote/GATE-FUTURE/<product_id>` 输出与 SQL 写入。
- [ ] 为凭证化 order service 补充 `ModifyOrder` / `ListOrders`（spot/unified）支持，统一 Schema。

### 7.2 中优先级

- [ ] 在 `services/transfer.ts` 中新增限频/异常重试策略，避免 429。
- [ ] 提供 e2e 脚本演练 Submit/Cancel/Transfer，以便回归。
- [ ] 评估是否需要 `public-data/product` 的多 settle（当前仅 USDT）。

### 7.3 想法 / Nice-to-have

- [ ] 将 `rate-limiter` 抽出为可复用工具，供其它 vendor 使用。
- [ ] 在公共 API 层加入响应 schema 校验，遇到字段变化及时报警。

---

## 8. 风险点 / 容易踩坑的地方（Risks & Gotchas）

- **凭证缺失导致服务静默**
  - 影响：legacy / transfer 不注册，Terminal 仅能访问凭证化服务；若部署环境忘记配置 env，会误以为程序未启动。
  - 建议：上线前检查 `ACCESS_KEY` / `SECRET_KEY`，必要时在监控中添加“未注册服务”告警。
- **Gate API 字段漂移**
  - 背景：`getFuturesOrders` 文档与实测字段不完全一致（`fill_price` 类型、`status` 取值）。
  - 建议：上线前通过实单验证映射逻辑，并在 doc 中补充差异；如需更稳妥，可引入 schema 校验。
- **自建 Quote 尚未完成**
  - 影响：copier 依赖的实时行情缺位，部署到生产会报缺数据。
  - 建议：在 TODO 中保持高优先级；上线前务必明确 Quote 实现/替代方案。

---

## 9. 尚未解决的问题（Open Questions）

- **Gate 是否提供更详细的订单状态/方向字段？**

  - 当前思路：通过 `size` 正负 + `is_close` 推断方向，可能对双向仓位/dual 模式不准确。
  - 备选方案：调研官方 WS/REST 是否返回 `reduce_only` / `is_liq` 等字段，再决定是否调整 `listOrders` 映射。

- **Quote 服务的最佳实现路径？**
  - 方案 A：直连 WebSocket（实时性好，但需维护心跳与重连）
  - 方案 B：REST 轮询 + caching（实现简单，但可能无法满足 1Hz）。
  - 尚未拍板，需根据资源决定。

---

## 10. 下一位 Agent 的建议行动（Next Steps for Next Agent）

1. 阅读本文件第 2 节与 `apps/vendor-gate/AGENTS.md`，确认指令/约束没有冲突。
2. 根据第 7 节优先级，从 “补充 pending orders 验证” 或 “实现 Quote service” 着手。
3. 对任何新能力，先更新 SESSION_NOTES（背景/决策/TODO），再动代码。
4. 完成后运行 `npx tsc --noEmit --project apps/vendor-gate/tsconfig.json`，并把结果写入第 6 节新增条目。

---

## 11. 当前会话草稿 / Scratchpad（仅本轮使用）

- （本轮会话已结算，留空供下一位使用）
