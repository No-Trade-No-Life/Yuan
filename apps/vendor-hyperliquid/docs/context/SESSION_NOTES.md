# Hyperliquid Vendor — Session Notes

> 单一真相源：记录当前目标、指令、决策与 TODO。所有 Agent 在动手前务必同步此文件；当前版本已对齐最新的 `skills/context-management/SESSION_NOTES.template.md`。

---

## 0. 元信息（Meta）

- **项目名称**：@yuants/vendor-hyperliquid
- **最近更新时间**：2025-11-15 15:58（由 Codex Agent 更新）
- **当前状态标签**：实现中（对齐 checklist & 上下文管理）

---

## 1. 项目整体目标（High-level Goal）

- 为 Hyperliquid 提供统一的账户信息、挂单、公共行情与交易 RPC，使 trade-copier / Web UI / CLI 可以直接复用。
- 将 CLI 与常驻进程行为对齐，通过 `Terminal.fromNodeEnv()` 连接统一控制面。
- 所有公共数据脚本统一位于 `src/public-data` 并支持写 SQL + Channel，满足运维 checklist。
- 短期内暂不处理链上转账，只关注账户、行情与交易链路的稳定性。

---

## 2. 指令与约束（Instructions & Constraints）

### 2.1 长期指令快照

- 沟通：对话与 Session Notes 使用中文；源码/注释/对外文档保持英文。
- 架构：`src/index.ts` 只聚合模块；公共 REST 放在 `api/public-api.ts`，签名/凭证逻辑在 `api/private-api.ts` + `api/types.ts`；所有模块使用 `Terminal.fromNodeEnv()`。
- 数据服务：Quote/Interest/Products/OHLC 全部从 `public-data` 暴露；`WRITE_QUOTE_TO_SQL` 为 `'1' | 'true'` 时写库，其余仅发布 Channel。
- 安全：凭证一律来自环境变量或请求参数，禁止硬编码；日志中允许打印地址但不要泄露私钥；更新任何风险开关必须同步至本文件。
- 质量：修改核心逻辑后跑 `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`；请求失败需包含 `formatTime` 日志。

### 2.2 当前阶段指令

- 维持 Hyperliquid vendor 与 `docs/zh-Hans/vendor-guide/implementation-checklist.md` 第 0–5 节一致；若有差异要在 4.3/7 节登记。
- 建立并维护 AGENTS / SESSION_NOTES，后续每次需求变更必须先更新文档再改代码。
- 在落实转账、测试、监控之前，不要上线会破坏现有账户/行情服务的改动。

### 2.3 临时指令（短期有效）

- 本轮任务聚焦：梳理现有改动 → 对照 checklist → 更新上下文文档。暂不更改运行时代码。
- 若需要引用其它仓库/文档，仅在此记录摘要并提供路径。

### 2.4 指令冲突与变更记录

- 暂无冲突记录。如在 checklist 与人类指令之间发现冲突，按 `AGENTS.md` 3.4 流程记录。

---

## 3. 当前阶段的重点目标（Current Focus）

- 固化 Hyperliquid vendor 的上下文管理（AGENTS + Session Notes）。
- 自查账户、挂单、quote、interest-rate、ohlc、交易 RPC 与 checklist 的一致性。
- 列出尚未覆盖的 checklist 项（如 `transfer.ts`、E2E 测试）并排期。

---

## 4. 重要背景与关键决策（Context & Decisions）

### 4.1 架构 / 模块概览

- `src/index.ts`：聚合入口，依次导入 `account`, `order-actions`, `order-actions-with-credential`, `public-data`。
- `src/api/public-api.ts` / `src/api/private-api.ts`：REST helper；公共接口无凭证，私有接口接收 `ICredential` 并使用 `sign.ts`。
- `src/account.ts`：注册 `provideAccountInfoService` 与 `providePendingOrdersService`，账户 ID 规范为 `hyperliquid/<address>/perp/USDC`。
- `src/order-actions*.ts`：默认凭证与请求级凭证两套 Submit/Cancel，实现 schema 校验与错误透传。
- `src/order-utils.ts`：解析 `product_id`、meta cache、价格 round/slippage。
- `src/public-data/*`：`product`, `quote`, `interest-rate`, `ohlc` 统一导出，支持 SQL + Channel。
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

### 4.3 已接受的折衷 / 技术债

- 未实现 `src/transfer.ts`（checklist 第 6 节仍是缺口）。需规划账户转账、地址注册与状态机。
- 缺少自动化 E2E / submit-order 测试脚本；目前仅靠 TS 编译和人工自测。
- 产品/quote 等使用 REST 轮询 + RxJS，暂未加入 WebSocket 或断线重连回补，需监控延迟。
- Account ID 通过环境私钥推导，未使用 `@yuants/cache`；如后续需要多账户，需要重新评估。

---

## 5. 关键文件与模块说明（Files & Modules）

- `apps/vendor-hyperliquid/src/account.ts`：账户权益 + 未成交订单服务，刷新间隔 1s/2s，依赖 `getUserPerpetualsAccountSummary` 与 `getUserOpenOrders`。
- `apps/vendor-hyperliquid/src/order-actions.ts`：默认账户 Submit/Cancel 的 RPC，对 `account_id` 做常量校验。
- `apps/vendor-hyperliquid/src/order-actions-with-credential.ts`：请求级 credential 版 Submit/Cancel，校验 account_id 与地址匹配。
- `apps/vendor-hyperliquid/src/order-utils.ts`：产品元数据缓存、价格 round、mid price with slippage。
- `apps/vendor-hyperliquid/src/public-data/quote.ts`：Quote Channel + SQL 写入开关。
- `apps/vendor-hyperliquid/src/public-data/product.ts`：Spot/Perp 产品同步与 SQL writer。
- `apps/vendor-hyperliquid/src/public-data/interest-rate.ts`：资金费率采集任务与 Series provider。
- `apps/vendor-hyperliquid/src/public-data/ohlc.ts`：K 线 series provider（REST snapshot）。

---

## 6. 最近几轮工作记录（Recent Sessions）

> 约定：仅记录已经结束的会话；进行中的内容放在第 11 节，收尾后再搬运；按时间倒序追加。

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

- [ ] 设计并实现 `src/transfer.ts`（地址注册 + TransferApply/Eval 状态机），与 checklist 第 6 节对齐。
- [ ] 为 Submit/Cancel 编写最小 E2E/集成测试或脚本（可参考其他 vendor 的 `src/e2e`），并记录运行方式。
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

---

## 10. 下一位 Agent 的建议行动（Next Steps for Next Agent）

1. 阅读本文件第 2 节与 `apps/vendor-hyperliquid/docs/context/AGENTS.md`，确认指令是否有更新；如存在 `IMPLEMENTATION_PLAN.md`，一并同步进度。
2. 从 7.1 高优先级列表顶部开始处理；若需要更多上下文，可参考 4.1/4.2 的模块说明与决策。
3. 在动手前，审查 `src/account.ts`、`src/order-actions*.ts`、`src/public-data/*` 是否会受到影响，并根据风险 2 校验环境变量。
4. 处理完成后，更新本文件的第 6/7/8/9/10 节，附上测试记录；若任务尚未完成，请在第 11 节记录阻塞点。

当前阻塞：transfer 需求缺少明确方案（问题 1）；需要产品/运维确认 Hyperliquid 的可用 API 或流程方可继续。

---

## 11. 临时草稿区（Scratchpad，可定期清理）

- （空）当前无临时草稿；若有调试命令、对比数据、临时 TODO，请写在此处并在工作结束时整理。
