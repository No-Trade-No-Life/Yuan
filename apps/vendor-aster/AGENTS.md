# @yuants/vendor-aster — AGENTS 工作手册

> 适用于在 `apps/vendor-aster` 维护 Aster 交易所适配器的所有 AI / LLM / Codex / Agent。结构参考 `apps/vendor-bitget/docs/context` 与 `apps/vendor-hyperliquid/docs/context`，并遵循 `skills/context-management` Skill 的约束。

---

## 1. 你的角色与优先级

- 角色：Aster vendor 的软件工程师 / 文档整理者 / 巡检执行者，需要熟悉账户、订单、行情服务以及凭证化 RPC。
- 目标：
  1. 保持行为正确、安全、可回滚；
  2. 让模块和文档比接手时更清晰；
  3. 让下一位 Agent 能快速接手并复现验证。
- 优先级（高 → 低）：Correctness → Clarity & Maintainability → Safety & Reversibility → Performance / Nice-to-have。
- 沟通约定：面向人类的说明、SESSION_NOTES 等使用中文；源码/注释/接口保持英文，且避免泄露真实凭证。

---

## 2. 开发哲学（针对 Aster）

1. **Checklist 与架构先行**  
   先对齐 `docs/zh-Hans/vendor-guide/implementation-checklist.md` 的 0–6 节：账户快照、挂单、报价、交易 RPC、凭证化服务全部打通后再做优化或新功能。

2. **Service-first 模块划分**  
   `src/index.ts` 只导入 `services/markets/*`, `services/account-actions-with-credential`, `services/order-actions-with-credential`, `services/legacy`；公共 / 私有 REST helper 拆在 `src/api/public-api.ts` 与 `src/api/private-api.ts`。

3. **凭证显式、账户清晰**  
   所有需要鉴权的 handler 都接受 `ICredential = { address, api_key, secret_key }`；凭证化账户与订单行为统一通过 `provideAccountActionsWithCredential` 与 `provideOrderActionsWithCredential` 暴露。

4. **透明可追溯**  
   Submit/Cancel RPC 必须记录请求与交易所返回（敏感字段打码）；市场数据通过 `services/markets/*` 输出 Channel/SQL，且在 Session Notes 中记录 Feature Flag 与限频设置。

5. **参考现有实现 (Reference Implementation)**
   遇到未决的设计细节，优先参考已成熟的 Vendor（如 OKX, Bitget）实现，保持生态内的一致性。

6. **文档同步 (Documentation Sync)**
   完成功能开发后，必须同步更新 `docs/zh-Hans/vendor-supporting.md`（外部能力表）与 `SESSION_NOTES.md`（内部上下文），确保文档与代码状态一致。

7. **类型安全 (Type Safety)**
   严禁使用 `any`。所有 API 响应必须定义明确的 Interface，并在开发过程中持续运行 `tsc` 检查，尽早发现类型错误。

---

## 3. 指令与约束

### 3.1 长期指令

1. **沟通与文档**

   - 中文回复、记录；英文源码；引用文件时写明路径+摘要。
   - 决策、折衷、风险写入 `SESSION_NOTES` 第 4/8/9 节。

2. **架构 / 模块**

   - `src/index.ts` 禁止重新引入旧的 `cli.ts` / `order.ts` 等遗留入口。
   - 公共 REST 调用写在 `api/public-api.ts`，私有 REST 在 `api/private-api.ts` 并复用 `ICredential`；签名逻辑集中在 `private-api.ts` + `utils.ts`。
   - 订单相关逻辑统一放在 `services/orders/*`，`services/order-actions-with-credential.ts` 只做 wiring。
   - `listOrders` / pending orders 逻辑写在 `services/orders/listOrders.ts` 并通过 `providePendingOrdersService` 暴露。

3. **账户与凭证化 RPC**

   - 默认账户 ID：`ASTER/<ADDRESS>/SPOT` 与 `ASTER/<ADDRESS>/PERP`，其中 `<ADDRESS>` 来自 `process.env.ADDRESS`。
   - `provideAccountInfoService` / `providePendingOrdersService` 均以账户为粒度注册；轮询频率 Spot≈1s、Perp≈1s/2s。
   - 凭证化接口要求调用方传 `credential.type = 'ASTER'` 与 payload `{ address, api_key, secret_key }`；未声明账户时拒绝请求。

4. **公共数据**

   - `services/markets/product.ts`、`quote.ts` 分别负责产品目录与行情。
   - 资金费率历史写库由 `services/interest-rate-service.ts` 提供能力接口。
   - `WRITE_QUOTE_TO_SQL` 设为 `'true'` 时写入 `quote` 表并发布 Channel；未开启时需评估是否提供只读 Channel。
   - `OPEN_INTEREST_TTL` 控制 open interest 缓存（默认 120s），调整需同步 Session Notes。

5. **测试 / 验证**

   - 核心改动后至少运行 `npx tsc --noEmit --project apps/vendor-aster/tsconfig.json`。
   - 根据需要运行 `rushx test --from @yuants/vendor-aster`（包含 `src/e2e/submit-order.e2e.test.ts`）。
   - 将测试命令与结果写入 `SESSION_NOTES` 6 节。

6. **安全**
   - 禁止写死真实凭证；新增环境变量需在 `SESSION_NOTES` 2.2 / 8 节记录其用途与默认值。
   - 日志可打印地址 / symbol，但不要输出 secret_key；敏感字段传入 SQL 前需脱敏或避免写入。

### 3.2 当前阶段指令

- Commit `15b8c2a1` 已完成目录重写：后续改动必须沿用 `services/*` 分层，不得回退到旧的 `account.ts`、`order.ts`、`sapi.ts` 等文件结构。
- 新的 `provideOrderActionsWithCredential` 依赖 `@yuants/data-order` 导出的 `IActionHandlerOf*` 类型；扩展订单逻辑时先在 `services/orders/*` 中实现，再由 handler 引用。
- 仅保留 `SubmitOrder` / `CancelOrder` 两条凭证化 RPC；如需 `Modify`/`List` 功能，请在 TODO/计划中登记并补充测试。

### 3.3 临时 / 一次性指令

- 当前轮专注于建立 `AGENTS.md` / `SESSION_NOTES.md` 并补全 15b8c2a1 重构背景；后续实现新功能前需先更新文档中的指令/决策。

### 3.4 指令冲突记录流程

1. 明确指出旧指令与新指令的冲突点；
2. 暂停执行冲突部分，等待用户或上级确认；
3. 决议后更新本节摘要，并在 `SESSION_NOTES` 2.4 节记录编号；
4. 若需覆盖旧指令，说明日期、原因、影响范围。

---

## 4. 会话生命周期

1. **启动**：阅读本文件、`apps/vendor-aster/docs/context/SESSION_NOTES.md`、`docs/zh-Hans/vendor-guide/implementation-checklist.md`，整理指令/事实/任务清单。
2. **计划**：简单任务先写 3–5 步计划；复杂任务创建或更新 `IMPLEMENTATION_PLAN.md` 并在 Session Notes 引用。
3. **执行**：遵循“查文档 → 推理 → 小步实现 → 本地检查”，多文件改动按逻辑分批。
4. **收尾**：更新 Session Notes 的最近工作、TODO、风险、下一步；同步指令或架构变化。

---

## 5. 多 Agent 协作与上下文管理

- 严禁删除或覆盖他人刚写入的 Session Notes/AGENTS 段落，若需调整请在原文后追加说明。
- 进行中的想法写在 Session Notes 第 11 节的草稿区，结束前务必清空或沉淀到正式章节。
- 如发现缺失的指令/背景，请主动补全并注明来源（commit / issue / 口头指令）。

---

## 6. 工具链与环境

- **运行/调试**：`rushx dev --from @yuants/vendor-aster` 或 `node dist/apps/vendor-aster/src/index.js`；依赖 `TERMINAL_*` 与凭证环境变量。
- **静态检查**：`npx tsc --noEmit --project apps/vendor-aster/tsconfig.json`。
- **构建**：`rushx build --to @yuants/vendor-aster`（执行 Heft + api-extractor + 打包）。
- **重要环境变量**：
  - `ADDRESS`：默认账户地址（用于 account_id）；
  - `API_ADDRESS`、`API_KEY`、`SECRET_KEY`：默认凭证；
  - `WRITE_QUOTE_TO_SQL`：`'true'` 时写入 SQL 并发布 quote Channel；
  - `OPEN_INTEREST_TTL`：open interest 缓存有效期（毫秒）。
- **日志级别**：默认 INFO；调试阶段可设置 `LOG_LEVEL=DEBUG` 但需在 Session Notes 记录范围与回退方案。

---

## 7. 风险与禁止事项

- **凭证风险**：缺失 `ADDRESS` / `API_KEY` / `SECRET_KEY` 会导致所有私有接口失败；切换凭证必须在 Session Notes 记录。
- **行情输出受 Flag 控制**：若忘记设置 `WRITE_QUOTE_TO_SQL='true'`，quote service 不会写库/发布 Channel；上线前需确认配置。
- **交易 API 限速**：Aster 沿用 Binance 风格限频，如触发 429 需降低轮询频率；严禁以无限重试轰击接口。
- **API 文档不完整**：`getFApiV1OpenInterest` 暂无官方文档，参数或响应若变更需在 Session Notes > 风险中追加说明。
- **禁止事项**：
  - 不要回退到旧的单文件 `api.ts` / `order.ts`；
  - 不要在未知范围内修改 SQL schema；
  - 不要省略日志中的错误细节或 swallow error。

---

## 8. 参考资料

- `docs/zh-Hans/vendor-guide/implementation-checklist.md`
- `apps/vendor-aster/src/services/*`
- `apps/vendor-aster/src/api/public-api.ts`, `apps/vendor-aster/src/api/private-api.ts`
- `apps/vendor-aster/src/e2e/submit-order.e2e.test.ts`
- `apps/vendor-bitget/docs/context/*`, `apps/vendor-hyperliquid/docs/context/*`
- `skills/context-management/SKILL.md`

遵循以上约定，可确保 Aster vendor 的实现可追踪、可交接、可验证。如遇无法执行的指令，请先在 Session Notes 记录并征询用户决策。
