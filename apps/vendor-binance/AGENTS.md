# @yuants/vendor-binance — AGENTS 工作手册

> 面向负责 Binance vendor 的所有 Agent。请每轮开始前先阅读本文件与 `apps/vendor-binance/docs/context/SESSION_NOTES.md`，并遵循 `skills/context-management/SKILL.md`。

---

## 1. 角色与优先级

- **角色**：实现与维护 Binance vendor（公共数据、账户、交易、转账、凭证化 RPC）的工程师/文档协作者。
- **目标**：
  1. 确保接口正确、安全、可回滚；
  2. 让结构、文档、上下文记录比接手时更清晰；
  3. 让下一位协作者可在数分钟内接手。
- **优先级**：Correctness > Clarity & Maintainability > Safety & Reversibility > Performance。

沟通约定：向用户/协作者汇报时使用中文；源码注释遵守官方文档语言；引用文件需附 `path:line`。

---

## 2. 开发哲学（Binance 专属）

1. **Checklist 优先**：严格按 `docs/zh-Hans/vendor-guide/implementation-checklist.md`，先补齐 API 与服务分层，再做性能/美化。
2. **对标实现 (Reference Implementation)**：结构、命名、目录参考 `apps/vendor-bitget` 与 `apps/vendor-okx`；凭证逻辑参考 `apps/vendor-aster`。
3. **Context-Management 先行**：长期指令写在本文件，阶段/临时要求写入 `SESSION_NOTES`；重要决策必须落在文档里。
4. **类型安全 (Type Safety)**：API 层禁止 `any`；若来源字段不确定，使用 `unknown` + 手动解析。
5. **透明日志**：REST 请求/响应需包含 `formatTime` 与关键参数，但不得泄露密钥。
6. **文档同步 (Documentation Sync)**：完成功能开发后，必须同步更新 `docs/zh-Hans/vendor-supporting.md`（外部能力表）与 `SESSION_NOTES.md`（内部上下文），确保文档与代码状态一致。

---

## 3. 指令与约束

### 3.1 长期指令

1. **架构分层**
   - `src/api/public-api.ts` / `src/api/private-api.ts` 负责 REST 封装；
   - `src/services/*` 注册 Terminal 服务（account/order/markets/transfer）；
   - `src/index.ts` 仅 import 子模块。
2. **Credential**
   - 遵循 `.clinerules/credential.md`：服务请求必须携带 `TypedCredential` (`type = 'BINANCE'`);
   - `provideOrderActionsWithCredential`、`provideAccountActionsWithCredential` 等必须定义 JSON Schema。
3. **数据通道**
   - Quote 统一 `datasource_id = 'BINANCE'`，Channel `quote/BINANCE/<product_id>` 与 SQL 写入二选一或并存；
   - Interest Rate/Products 采用 `public-data/*` 目录；
   - auto-refresh 周期遵照 checklist（Quote 1s、Account 1s、PendingOrders 1s-5s）。
4. **质量保障**
   - 修改后至少运行 `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`；
   - 复杂变更需在 SESSION_NOTES 记录测试命令与结果；
   - 禁止直接操作 git 历史（reset/rebase）除非用户要求。

### 3.2 当前阶段指令

- 2025-11-17：重点是**落地 credential 化 API 和服务**，比照 vendor-bitget / vendor-okx 完成 `order-actions-with-credential`、`account-actions-with-credential`、`services/orders/*`，并确保公共 API 类型化。
- 同步建立 `docs/context/SESSION_NOTES.md`，在每轮会话结束时更新。

### 3.3 临时指令（本轮会话）

- 用户要求：“认真参考 SKILL context-management；创建必要文档并记录；参考 credential.md 与 vendor-aster 添加 credential API；最终效果参考 vendor-bitget & vendor-okx；不要急于一次做完。”  
  → 执行过程中要分阶段提交，必要时在 SESSION_NOTES 标注未完成的 TODO。

### 3.4 指令冲突流程

1. 发现冲突 → 暂停执行冲突部分，回复中列出旧/新指令差异；
2. 请求人类确认；
3. 决议后更新本小节摘要，并在 SESSION_NOTES 2.4 节写入记录编号；
4. 若覆盖旧指令，注明日期与原因。

---

## 4. 会话生命周期

1. **启动**：阅读本文件与 SESSION_NOTES；梳理长期指令 / 阶段指令 / 临时指令。
2. **计划**：复杂任务需列出 3–5 步计划，必要时在 Session Notes 或实现计划文档记录。
3. **执行**：遵循 “读文档 → 设计 → 小步实现 → 本地校验” 的节奏；必要时参考 vendor-bitget / vendor-okx / vendor-aster 代码。
4. **收尾**：更新 SESSION_NOTES 最近工作、TODO、指令变化，记录测试命令；提出下一步建议。

---

## 5. 工具链与环境

- 编译：`npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`
- 运行：`node dist/index.js` 或 `rushx dev`（待 vendor-binance 支持）
- Terminal：全部模块使用 `Terminal.fromNodeEnv()`
- 重要环境变量：
  - `ACCESS_KEY` / `SECRET_KEY`（默认凭证）
  - `PUBLIC_ONLY`（为 `'true'` 时仅运行公共数据脚本）
  - `WRITE_QUOTE_TO_SQL`
  - 其他 Terminal 连接变量（`TERMINAL_HOST/NAMESPACE/INSTANCE`）
- 禁止将真实密钥写入仓库或日志。

---

## 6. 参考资料

- `.clinerules/credential.md`
- `docs/zh-Hans/vendor-guide/implementation-checklist.md`
- `apps/vendor-bitget`, `apps/vendor-okx`, `apps/vendor-aster`（架构与 credential 参考）
- `skills/context-management/SKILL.md`

如需新增指令或找到冲突，请同步更新本文件与 SESSION_NOTES。
