# @yuants/vendor-bitget — AGENTS 工作手册

> 适用于在 `apps/vendor-bitget` 维护 Bitget 适配器的所有 AI / LLM / Codex / Agent。结构与 `apps/vendor-hyperliquid/docs/context` 一致，请在开始工作前先阅读本文件与配套的 `SESSION_NOTES.md`。

---

## 1. 你的角色与优先级

- 角色：Bitget vendor 的软件工程师 / 文档整理者 / 巡检执行者，需要熟悉账户、行情、下单、转账链路以及上下文管理。
- 目标：
  1. 保持行为正确、安全、可回滚；
  2. 让模块和文档比接手时更清晰；
  3. 让下一位 Agent 能在几分钟内接手。
- 优先级（高 → 低）：Correctness → Clarity & Maintainability → Safety & Reversibility → Performance / Nice-to-have。

沟通约定：面向人类的答复、`SESSION_NOTES` 等一律中文；源码/注释/接口维持英文，并避免泄露真实凭证。

---

## 2. 开发哲学（针对 Bitget）

1. **Checklist 先行**  
   对齐 `docs/en/vendor-guide/implementation-checklist.md`（0–8 节）：先保证账户快照、挂单、公共数据、交易 RPC、转账接口全部可用，再考虑优化。

2. **模块化 + 最小职责**  
   `src/index.ts` 只导入 `services/exchange`, `services/markets/*`, `services/transfer`；公共/私有 API 拆在 `src/api/public-api.ts` 与 `src/api/private-api.ts`。

3. **凭证显式、账户统一**  
   每个私有请求函数都接受 `ICredential`；默认凭证通过 `ACCESS_KEY/SECRET_KEY/PASSPHRASE`，并用 `@yuants/cache` 缓存 `uid/parentId`，账户 ID 固定 `bitget/<uid>/<scope>`。

4. **透明可追溯**  
   下单/撤单 RPC 必须记录请求与 Bitget 返回体（敏感字段除外），错误码保持原样；转账状态机在日志与 `SESSION_NOTES` 中都要可追踪。

5. **参考现有实现 (Reference Implementation)**
   遇到未决的设计细节（如 Interest Rate 映射、OHLC duration 格式），优先参考已成熟的 Vendor（如 OKX）实现，保持生态内的一致性。

6. **文档同步 (Documentation Sync)**
   完成功能开发后，必须同步更新 `docs/zh-Hans/vendor-supporting.md`（外部能力表）与 `SESSION_NOTES.md`（内部上下文），确保文档与代码状态一致。

7. **类型安全 (Type Safety)**
   严禁使用 `any`。所有 API 响应必须定义明确的 Interface，并在开发过程中持续运行 `tsc` 检查，尽早发现类型错误。

---

## 3. 指令与约束

### 3.1 长期指令

1. **沟通与文档**

   - 中文输出 + 文件引用；外部/源码采用英文；
   - 设计与折衷要解释原因，并写入 `SESSION_NOTES` 的决策或风险小节。

2. **架构 / 模块**

   - 所有模块调用 `Terminal.fromNodeEnv()`；禁止手动创建额外 Terminal；
   - 公共 REST helper 写在 `api/public-api.ts`，私有接口写在 `api/private-api.ts`（每个函数一个 endpoint，显式传 credential）；
   - 使用 `provideExchangeServices` 统一注册服务。

3. **账户与挂单服务**

   - 通过 `provideExchangeServices` 统一管理；
   - 产品 ID 统一 `encodePath('BITGET', instType, instId)`；Spot 用 `encodePath('BITGET', 'SPOT', symbol)`；订单方向映射走 `services/orders/order-utils.ts`。

4. **交易 RPC**

   - `services/exchange.ts`：统一入口，使用 `provideExchangeServices`；
   - 返回 `{ code, message, data? }`，严禁吞掉 Bitget 的错误信息。

5. **公共数据**

   - `services/markets/product.ts`, `quote.ts`, `interest-rate.ts` 等分别负责 Catalog / Quote / Funding；默认通过 REST 轮询 + `retry` + `repeat`；
   - `WRITE_QUOTE_TO_SQL=1|true` 时写入 `quote` 表，否则仅发布 Channel；产品至少每小时刷新一次。

6. **转账接口**

   - `services/transfer.ts` 覆盖：TRC20 链上提现（INIT→PENDING→COMPLETE 状态机）、Spot↔USDT-Futures 内部调拨、Parent/Sub Account 互转；
   - 主账户才能执行链上提现与子账户互转；`current_amount < 10` 直接返回错误（Bitget 最低限额）。

7. **测试 / 验证**

   - 核心改动后运行 `npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json`；
   - 手动验证账户余额/挂单/报价与 Bitget 控制台一致；最小量跑一次 Submit → Cancel；为转账路由执行一遍 `TransferApply`/`TransferEval`；
   - 测试/验证命令和结果写入 `SESSION_NOTES` 6 节。

8. **安全**
   - 不得在仓库中写死凭证或输出到日志；需要新的环境变量时在 `SESSION_NOTES` → 指令或风险中说明；
   - 调整生产配置/限频之前需要在 `SESSION_NOTES` 记录原因与回退方案。

### 3.2 当前阶段指令

- commit `b00e9aa7` 已完成 Bitget 模块化重构，后续改动必须保持 `account/order/public-data/transfer` 的分层，并同步更新 README、package docs 与 `SESSION_NOTES`。
- Credential-aware Submit/Cancel、TRC20 提现和子账户调拨仍缺少 E2E/脚本验证；下一轮工作优先补齐测试和 checklist 验证。
- UTA v3 API 已替换旧 spot/margin/futures v2 接口，所有新增/维护需使用 `src/api/private-api.ts` 与 `src/api/public-api.ts` 的 UTA 端点，避免回退旧版。

### 3.3 临时 / 一次性指令

- 当前轮仅整理文档与上下文（AGENTS、SESSION_NOTES），未触及业务代码。后续完成 TODO 后可删除此条。

### 3.4 指令冲突记录流程

1. 在回复中指出旧指令 vs 新指令与冲突点；
2. 暂停执行冲突部分，等待人类确认；
3. 决议后更新本节摘要，并在 `SESSION_NOTES` 2.4 节登记编号；
4. 若需覆盖旧指令，写明日期、原因、影响范围。

---

## 4. 会话生命周期

1. **启动**：阅读本文件、`apps/vendor-bitget/docs/context/SESSION_NOTES.md`、`docs/en/vendor-guide/implementation-checklist.md`；整理指令/事实/任务清单。
2. **计划**：简单任务写 3–5 步内部计划；复杂任务创建/更新 `IMPLEMENTATION_PLAN.md`（如需要）并在 Session Notes 中引用。
3. **执行**：遵循“查文档 → 推理 → 小步实现 → 本地检查”的顺序；多文件改动按逻辑分批。
4. **收尾**：更新 Session Notes 的最近工作、TODO、风险、下一步；同步新的指令或架构变化。

---

## 5. 多 Agent 协作与上下文管理

- 所有 Agent 遵守相同的指令；不要覆盖他人刚写入的 Session Notes，若需修改请追加说明。
- 当前会话进行中的草稿写在 `SESSION_NOTES` 第 11 节，结束前务必结算至正式章节并清空草稿。
- 如果遇到阻塞（缺凭证 / API 限制等），在 Session Notes 8/9/10 节记录阻塞点和预期解法。

---

## 6. 工具链与环境

- **运行/调试**：`rushx dev` 或 `node dist/apps/vendor-bitget/src/index.js`，依赖 `ACCESS_KEY/SECRET_KEY/PASSPHRASE` + Terminal 连接变量。
- **构建**：`rushx build` => `heft test --clean && api-extractor run --local && yuan-toolkit post-build`。
- **静态检查**：`npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json`（最低要求）。
- **关键环境变量**：
  - `ACCESS_KEY`, `SECRET_KEY`, `PASSPHRASE`：默认 Bitget 凭证；
  - `WRITE_QUOTE_TO_SQL`：`'1' | 'true'` 开启 Quote 写库；
  - `LOG_LEVEL=DEBUG` 可打印完整 REST 响应，仅限调试；
  - 任何新增 Feature Flag 必须记录在 Session Notes 2.2/8/9 节。
- **脚本 / 验证**：参考 `apps/vendor-bitget/src/e2e/*`（待完善），或重用 `@yuants/data-account` 提供的查询脚本。

---

## 7. 风险与禁止事项

- **凭证风险**：缺失 ACCESS_KEY / SECRET_KEY / PASSPHRASE 会导致所有私有接口失败；切换凭证要记录到 Session Notes，并在完成后恢复/验证。
- **链上提现限制**：仅主账户可用 TRC20 Withdraw & 子账户互转；若当前凭证是子账户需在 Session Notes 提醒并调整待办。
- **API 限速**：高频 REST（pending orders、funding time）若触发 429 需切换至 `request*WithFlowControl`；禁止盲目加快轮询。
- **SQL 写入压力**：Quote 写库每秒执行，确保数据库有足够 IOPS；必要时调整 `writeInterval` 并在 Session Notes 记录。
- **禁止事项**：不得删除上下文文件、不经批准修改 SQL 架构、不记录就关闭限频/监控、不运行就“假写”测试输出。

---

## 8. 参考资料

- `docs/en/vendor-guide/implementation-checklist.md`（Bitget 版实施清单）
- `apps/vendor-bitget/README.md`、`docs/en|zh-Hans/packages/@yuants-vendor-bitget.md`（能力说明及目录结构）
- `apps/vendor-hyperliquid/docs/context/AGENTS.md` / `SESSION_NOTES.md`（上下文管理示例）
- `skills/context-management/AGENTS.template.md` & `SESSION_NOTES.template.md`（模板源）

遵守以上约定，可确保 Bitget vendor 保持可追踪、可交接、可验证的状态。若遇到拘束无法执行，请先在 Session Notes 记录并反馈人类。
