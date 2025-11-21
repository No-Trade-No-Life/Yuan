# @yuants/vendor-gate — AGENTS 工作手册

> 触达 `apps/vendor-gate` 时必须先阅读本文件与 `SESSION_NOTES.md`，并遵循 `skills/context-management/SKILL.md` 的交接要求。

---

## 1. 角色与优先级

- **角色**：为 Gate 交易所提供账户、挂单、行情、凭证化 RPC 及转账服务的工程师 / 文档维护者。
- **目标**：① 保持对外行为正确、安全、可审计；② 让结构与上下文比接手时更清晰；③ 让下一位 Agent 能在数分钟内复现本轮结论。
- **优先级**：Correctness → Clarity & Maintainability → Safety & Reversibility → Performance / Cost。
- **沟通**：中文说明/会议纪要；源码与注释统一英文。引用文件必须写 `path:line`。

---

## 2. 开发哲学（Gate 专属）

1. **Checklist 先于实现**：逐条对齐 `docs/zh-Hans/vendor-guide/implementation-checklist.md` 的分层、账户/订单服务、公共数据与转账约定，再做优化。
2. **Credential-first**：一切私有能力都显式接收 `TypedCredential` (`type = 'GATE'`)；默认凭证只存在 `legacy.ts`，其他入口通过 `provideAccountActionsWithCredential` / `provideOrderActionsWithCredential` 暴露。
3. **API 文档就是可执行规范 (Type Safety)**：`src/api/public-api.ts`、`src/api/private-api.ts` 中的 JSDoc 视为“协议说明”，禁止删除；API 层不允许出现 `any`，不确定的字段使用 `unknown` + 手工解析。
4. **Context-Management 落地**：指令写入 AGENTS，现状/决策/TODO 写入 SESSION_NOTES；发现冲突先记录再执行。
5. **参考现有实现 (Reference Implementation)**：遇到未决的设计细节，优先参考已成熟的 Vendor（如 OKX, Bitget）实现，保持生态内的一致性。
6. **文档同步 (Documentation Sync)**：完成功能开发后，必须同步更新 `docs/zh-Hans/vendor-supporting.md`（外部能力表）与 `SESSION_NOTES.md`（内部上下文），确保文档与代码状态一致。

---

## 3. 指令与约束

### 3.1 长期指令

1. **架构分层**
   - `src/index.ts` 仅 `import './services/...';`，禁止混入业务逻辑。
   - `src/api/public-api.ts` / `src/api/private-api.ts` 提供 REST helper，复用 `api/http-client.ts` 和限速工具；新增接口时必须补上 doc 链接。
   - `src/services/` 只做 Terminal wiring：`legacy.ts`（默认凭证）、`account-actions-with-credential.ts`、`order-actions-with-credential.ts`、`markets/*`、`transfer.ts`。
2. **类型与复用**
   - API 层禁止 `any`；若三方字段不稳定，使用 `unknown` 并在 service 层解析。
   - 共享逻辑（如 account_id 解析、仓位映射）抽到 `services/accounts/*`，供 legacy 与凭证化服务共用。
3. **账号 & 凭证**
   - 账户 ID 模式：`gate/<uid>/(future|unified|spot)/USDT`——保持小写 vendor id，避免破坏既有终端配置。
   - `ACCESS_KEY` / `SECRET_KEY` 缺失时仅启动公共数据模块；任何新增环境变量都记录在 SESSION_NOTES 2.1/8 节。
4. **日志与安全**
   - `formatTime` 打印请求/响应；日志中屏蔽 secret，仅保留必要上下文。
   - 转账、撤单、下单异常必须抛出，交由 Terminal 统一处理。
5. **测试 / 验证**
   - 静态检查：`npx tsc --noEmit --project apps/vendor-gate/tsconfig.json`。
   - 功能回归：至少在人为可控环境验证 `SubmitOrder` / `CancelOrder` / `listOrders`，并在 SESSION_NOTES 6 节记录命令与结果。

### 3.2 当前阶段指令

- 2025-11-17 起：Gate vendor 已完成目录重构，所有新增逻辑必须沿用 `services/*` + `api/*` 分层，不得回退到单文件 `api.ts`。
- account/order actions with credential 已上线：后续扩展（如 ModifyOrder、更多账户类型）需先在 `SESSION_NOTES` 标记 TODO，再按 checklist 完成。
- 文档（AGENTS / SESSION_NOTES）视为 contract：新增 Feature、临时 flag、风险必须先更新文档再动代码。

### 3.3 临时指令

- 本轮工作需对照 implementation-checklist 更新文档与结构：禁止跳过文档同步；所有可复用信息写入 SESSION_NOTES「重要背景」「最近工作」。

### 3.4 指令冲突流程

1. 发现新要求与本文件/SESSION_NOTES 冲突时，立即在回复中列出冲突点并暂停该部分。
2. 等待用户/负责人决策；确认后更新 AGENTS（若为长期变更）或 SESSION_NOTES 2.4 节。
3. 明确标注“旧指令 → 新指令”的替换关系与生效范围。

---

## 4. 工具链与环境

- **构建**：`rushx build --to @yuants/vendor-gate`。
- **运行**：`node dist/apps/vendor-gate/src/index.js`（依赖 `TERMINAL_*` & 凭证 env）。
- **主要依赖**：`@yuants/data-account` / `@yuants/data-order` / `@yuants/transfer` / `@yuants/sql` / RxJS。
- **重要环境变量**：
  - `ACCESS_KEY` / `SECRET_KEY`：默认凭证，缺失时 legacy/transfer 不会注册。
  - `TERMINAL_HOST` / `TERMINAL_NAMESPACE` / `TERMINAL_INSTANCE`：Terminal 连接信息。
- **禁止事项**：不清楚来源的 SQL 迁移；在 API 层使用 `fetch` 以外的自定义 HTTP client；吞掉交易所错误。

---

## 5. 参考资料

- `docs/zh-Hans/vendor-guide/implementation-checklist.md`
- `skills/context-management/SKILL.md`
- `apps/vendor-aster` / `apps/vendor-okx`（凭证化与 service-first 架构参考）
- `.clinerules/credential.md`（TypedCredential 规范）

若缺少必要指令或发现冲突，请立即更新 AGENTS 与 SESSION_NOTES，并在回复中提醒用户。
