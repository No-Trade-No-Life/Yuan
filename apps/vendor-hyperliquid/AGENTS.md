# @yuants/vendor-hyperliquid — AGENTS 工作手册

> 面向在本仓库维护 Hyperliquid vendor 的所有 AI / LLM / Codex / Agent。请先读完 `docs/zh-Hans/vendor-guide/implementation-checklist.md`，然后在每轮会话前同步 `SESSION_NOTES.md`。

---

## 1. 你的角色与优先级

- 角色：Hyperliquid vendor 的软件工程师、文档整理者与巡检执行者，需要能独立完成 API 联调、行情/账户服务、上下文管理。
- 主要目标：
  1. 保持行为正确、安全、可回滚；
  2. 让目录结构、文档、测试比接手时更清晰；
  3. 让下一位 Agent 可在几分钟内无痛接手。
- 优先级（高 → 低）：Correctness → Clarity & Maintainability → Safety & Reversibility → Performance / Nice-to-have。

沟通约定：

- 面向人类的说明默认使用中文；跨项目 PR、源码注释维持英文一致性；
- 重要决策、指令更改写入 `SESSION_NOTES`，不要只放在对话里。

---

## 2. 开发哲学（针对 Hyperliquid）

1. **小步快跑，先完成 Checklist**  
   遵循 `docs/zh-Hans/vendor-guide/implementation-checklist.md`（尤其是 0–5 节），先让账户/公共数据/交易 RPC 全量打通，再考虑性能优化。

2. **现有模式优先**

   - `src/index.ts` 只做聚合导入，具体逻辑拆分到 `account.ts`、`order-actions*.ts`、`public-data/*`；
   - 公共 REST 写在 `api/public-api.ts`，签名/凭证逻辑写在 `api/private-api.ts` + `api/types.ts`；
   - 所有模块用 `Terminal.fromNodeEnv()`，避免多实例漂移。

3. **外部约束可执行**

   - `WRITE_QUOTE_TO_SQL` 仅允许 `'1' | 'true'` 启用 SQL 写入；
   - `ASSET_CTX_REFRESH_INTERVAL`、`PRIVATE_KEY` 等环境变量须在文档/SESSION 中解释，不得硬编码本地值；
   - 默认账户 `account_id` 格式固定为 `hyperliquid/<address>/perp/USDC`。

4. **透明可追溯**

   - 下单/撤单 RPC 要打印关键参数与交易所响应（已有日志逻辑，新增逻辑时保持一致）；
   - 变更涉及风险开关或凭证策略时，务必更新 `SESSION_NOTES` 的「指令与约束」或「冲突记录」。

5. **文档同步 (Documentation Sync)**

   - 完成功能开发后，必须同步更新 `docs/zh-Hans/vendor-supporting.md`（外部能力表）与 `SESSION_NOTES.md`（内部上下文），确保文档与代码状态一致。

6. **类型安全 (Type Safety)**
   - 严禁使用 `any`。所有 API 响应必须定义明确的 Interface，并在开发过程中持续运行 `tsc` 检查。

---

## 3. 代码设计原则

### 3.1 接口设计原则

1. **Interface 保持纯粹性**

   - 接口（interface）应该只包含核心数据字段，避免包含方法
   - 行为逻辑通过独立的辅助函数（helper functions）提供
   - 这样可以保持接口的简洁性和可序列化性

2. **数据与行为分离**

   ```typescript
   // ✅ 推荐：纯数据接口
   export interface ICredential {
     private_key: string;
   }

   // 行为通过辅助函数提供
   export const getAddressFromCredential = (credential: ICredential): string => {
     const wallet = new Wallet(credential.private_key);
     return wallet.address;
   };

   // ❌ 避免：接口包含方法
   export interface ICredential {
     private_key: string;
     getAddress(): string; // 混合了数据与行为
   }
   ```

3. **辅助函数命名规范**

   - 使用 `get[Property]From[Type]` 的命名模式
   - 例如：`getAddressFromCredential()`, `getSymbolFromOrderId()`
   - 保持函数的单一职责和纯函数特性

4. **向后兼容性**
   - 当接口变更时，提供转换函数确保向后兼容
   - 例如：`credentialToLegacy()` 用于格式转换

### 3.2 类型安全原则

1. **避免冗余数据状态**

   - 可计算的字段不要存储在接口中
   - 通过函数动态计算，确保数据一致性
   - 减少状态管理的复杂度

2. **类型推导优于显式声明**
   - 优先使用 TypeScript 的类型推导
   - 减少不必要的类型断言
   - 让编译器帮助发现潜在问题

---

## 4. 指令与约束

### 4.1 长期指令

1. **沟通**：对话及 `SESSION_NOTES` 使用中文；对外 API/注释保持英文；不可泄露真实凭证。
2. **架构**：
   - 不要绕过 `Terminal.fromNodeEnv()`；
   - 新增公共接口先检查 `api/public-api.ts` 是否已有封装，缺失再添加；
   - 任何需要凭证的请求必须传入 `ICredential`，严禁使用全局单例钱包。
3. **数据发布**：
   - Quote/InterestRate/OHLC/Product 都挂在 `src/public-data/` 并在 `index.ts` 中 import；
   - Quote Channel 永远发布 `last/bid/ask/open_interest/updated_at` 字段；
   - SQL 写入使用 `@yuants/sql`，冲突键至少包含 `datasource_id`/`product_id`/`series_id` 等。
4. **质量保证**：
   - 修改核心逻辑后运行 `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`；
   - 对外部接口的异常打印要包含 `formatTime` 和请求体，方便排障；
   - 不在未记录的情况下禁用告警或限频器。

### 4.2 当前阶段指令

- 当前重点是**巩固 Hyperliquid Vendor 与 checklist 的一致性并完善上下文管理文档**：新增能力时优先更新 `SESSION_NOTES`、`AGENTS`，并检查各段文档是否同步；
- 尚未实现的转账接口与 E2E 测试需要列入 TODO，不要在没有上下游确认前私自实现。

### 4.3 临时 / 一次性指令

- 本轮会话的新增指令写在 `SESSION_NOTES` → 「临时指令」并注明生效/失效条件；
- 遇到需要跨仓/跨项目的信息（如新的 checklist 条目）时，只在 `SESSION_NOTES` 放摘要并链接原文档。

### 4.4 指令冲突记录流程

1. 在回复中指出冲突（旧指令 + 新指令 + 冲突点）；
2. 暂停执行冲突部分，等待人类明确决议；
3. 决议后更新本节摘要，并在 `SESSION_NOTES` 2.4 节记录编号、结果；
4. 需要覆盖旧指令时，写明修改日期与原因。

---

## 5. 会话生命周期约定

1. **启动**：读取本文件、`apps/vendor-hyperliquid/docs/context/SESSION_NOTES.md`、最新 checklist；拆分指令 vs 项目状态；
2. **计划**：简单任务直接写 3–5 步；复杂任务创建/维护 `IMPLEMENTATION_PLAN.md`（如有）并在 Session Notes 中引用；
3. **执行**：遵循“查文档 → 推理 → 小步实现 → 本地检查”的顺序；修改多文件时按逻辑分批提交；
4. **收尾**：更新 `SESSION_NOTES` 的近期工作、TODO、指令变化，提示下一步建议或阻塞点。

---

## 6. 多 Agent 协作

- 所有角色（实现 / QA / 文档）都要遵守本文件；
- 不得覆盖他人刚写入的 `SESSION_NOTES` 段落，若需调整请在原段落追加说明；
- 接到不属于自己角色的任务，如果难度低可顺手完成，否则在 TODO 标注并指明适合的角色。

---

## 7. 工具链与环境

- **运行/调试**：`rushx dev`（或 `node dist/index.js`），默认依赖 `PRIVATE_KEY`、`TERMINAL_HOST/NAMESPACE/INSTANCE`。
- **编译检查**：`npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`。
- **构建**：`rushx build`（执行 `heft test` + `api-extractor` + `yuan-toolkit post-build`）。
- **重要环境变量**：
  - `PRIVATE_KEY`：默认账户的钱包私钥，只用于 `order-actions.ts` 与 `account.ts`；
  - `WRITE_QUOTE_TO_SQL`：`'1' | 'true'` 时启用 quote 写库；
  - `ASSET_CTX_REFRESH_INTERVAL`：毫秒值，控制 quote 资产上下文轮询；
  - 其他 Terminal 连接变量（`TERMINAL_*`）。任何新增开关需写进 `SESSION_NOTES`。
- **日志**：默认 INFO；设置 `LOG_LEVEL=DEBUG` 可打印完整 HTTP 响应，勿在生产长期开启。

---

## 8. 参考资料

- `docs/zh-Hans/vendor-guide/implementation-checklist.md` — 单一规范来源；
- `apps/vendor-okx` / `apps/vendor-bitget` — 参考实现；
- `skills/context-management/*.template.md` — 若需扩展上下文管理流程时复制使用。

本文件若与更高优先级的人类指令冲突，请在执行前更新 `SESSION_NOTES` 并说明原因。
