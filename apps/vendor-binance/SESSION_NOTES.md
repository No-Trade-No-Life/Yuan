# @yuants/vendor-binance — Session Notes

> 作为 Binance vendor 的单一真相源。请在每轮会话结束时更新最近工作、TODO、指令变化与下一步建议。

---

## 0. 元信息

- **项目名称**：@yuants/vendor-binance
- **最近更新时间**：2025-11-17 15:25（由 Codex Agent 更新账户 Profile 缓存）
- **当前状态标签**：重构中（credential 化 & 上下文治理）

---

## 1. 项目整体目标

- 对齐 `docs/zh-Hans/vendor-guide/implementation-checklist.md` 的所有要求，让 Binance vendor 可被 trade-copier / CLI 复用；
- 提供公共行情、利率、产品目录、账户、挂单、转账、订单动作（默认账户 + 凭证化）等服务；
- 引入 context-management 规范，确保多轮协作可追踪；
- 非目标：一次性完成所有模块重写；在未完成自测前上线生产环境。

---

## 2. 指令与约束

### 2.1 长期指令快照

- 遵循 `docs/zh-Hans/vendor-guide/implementation-checklist.md`；
- API 层禁止 `any`，保留官方注释链接；
- 结构参考 vendor-bitget / vendor-okx：`api/` + `services/`；
- credential 设计遵循 `.clinerules/credential.md`，`type = 'BINANCE'`；
- 重要信息写入 AGENTS / Session Notes，不依赖聊天记录。

### 2.2 当前阶段指令

- 补齐 `docs/context` 文档；
- 将 Binance API 拆分 public/private + Typed credential；
- 实现凭证化 Order Actions，并准备账户/挂单服务的 credential 版本；
- 保持 `PUBLIC_ONLY` 模式可运行公共数据。

### 2.3 临时指令

- 用户提醒（2025-11-17）：本轮重点是文档 + credential API，分阶段完成，不必一次重构全部；逐步对齐 vendor-bitget / vendor-okx。

### 2.4 指令冲突与变更记录

- 暂无。如有冲突，使用编号 `C1`, `C2` 等记录在此节并同步 AGENTS。

---

## 3. 当前阶段重点

- Stage 1：建立 context 文档体系（AGENTS / SESSION_NOTES）并同步指令；
- Stage 2：完成 API 层重构（public/private/typed credential）；
- Stage 3：实现凭证化 order actions + account/pending services；
- Stage 4：迁移 legacy 逻辑到 services 目录并逐步淘汰。

---

## 4. 重要背景与关键决策

### 4.1 架构概览

- `src/api/public-api.ts`：Binance 公共 REST helper；
- `src/api/private-api.ts`：Binance 私有 REST helper，需凭证；
- `src/legacy_index.ts`：旧版 account/order/transfer 逻辑（待迁移）；
- `src/public-data/*`：quote / interest_rate / product；
- （TODO）`src/services/*`：按 checklist 拆分 account/order/markets/transfer。

### 4.2 决策

- [D1] 2025-11-17：沿用 vendor-bitget 结构，在 `apps/vendor-binance/src/api/` 下实现 typed API，并准备引入 `services/` 目录；
- [D2] 2025-11-17：为 context-management 建立 `docs/context/AGENTS.md` 与 `SESSION_NOTES.md`，仅覆盖 vendor-binance。

### 4.3 技术债

- Legacy `legacy_index.ts` 仍包含默认账户逻辑，需要迁移至 `services/legacy.ts` 或新的模块；
- 尚未实现凭证化 Account Actions / Order Actions；
- 缺少 `services/orders/submitOrder.ts`、`cancelOrder.ts` 等模块；
- 转账接口未对齐新的 credential 设计。

---

## 5. 关键文件

- `src/api/public-api.ts`: 各类公共 REST，禁止 any；
- `src/api/private-api.ts`: 权限 REST，输出类型需补充；
- `src/legacy_index.ts`: 旧服务实现，逐步拆分；
- `src/quote.ts`, `src/product.ts`, `src/interest_rate.ts`: 公共数据脚本；
- `docs/context/AGENTS.md`, `docs/context/SESSION_NOTES.md`: 指令与状态文件。

---

## 6. 最近几轮工作记录

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

## 7. TODO / Backlog

| 优先级 | 任务                      | 说明                                                                      |
| ------ | ------------------------- | ------------------------------------------------------------------------- |
| 高     | 引入 `services/` 目录结构 | 把 legacy pending/transfer 拆分；新增 `services/legacy` or dedicated 模块 |
| 高     | 凭证化挂单服务            | 使用 `providePendingOrdersService`，复用 typed API                        |
| 中     | 转账流程凭证化            | 对接 `.clinerules/credential.md`                                          |
| 低     | e2e 测试脚本              | 参照 vendor-bitget / vendor-aster e2e 目录                                |

---

## 8. 指令冲突记录

- 暂无。

---

## 9. 下一位 Agent 的建议行动

1. 阅读第 7 节 TODO 并选择高优先级任务；
2. 参考 vendor-bitget / vendor-okx / vendor-aster 的账户/挂单/转账实现；
3. 拆分 legacy account/pending/transfer 到 `src/services/*`，并实现凭证化账户动作；
4. 更新 SESSION_NOTES，记录进度、测试命令与仍未解决的阻塞。
