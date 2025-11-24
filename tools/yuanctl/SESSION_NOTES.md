# Yuanctl — Session Notes

> 基于 `.claude/skills/context-management/SESSION_NOTES.template.md` 的正式版本。作为 `@yuants/tool-yuanctl` 的单一真相源，记录目标、指令、决策、TODO、风险与交接。操作前请阅读本文件与 `tools/yuanctl/AGENTS.md`。

---

## 0. 元信息（Meta）

- **项目名称**：@yuants/tool-yuanctl
- **最近更新时间**：2025-11-24 07:20（Codex，UTC）
- **当前状态标签**：文档整理 / 上下文建设

---

## 1. 项目整体目标（High-level Goal）

- 提供 kubectl 风格的运维 CLI，复用 Terminal + SQL + Channel 能力管理部署与节点，行为与 Web 控制台保持一致。
- 支持多 Host/Context 的可移植配置（XDG + TOML），便于脚本与人工操作共享。
- 保持输出、确认、安全策略稳定：查询/描述安全可批量，写操作提供确认/降级选项。
- 非目标（当前阶段）：直接访问数据库或实现声明式 `apply` 部署（后续另行设计）。

---

## 2. 指令与约束（Instructions & Constraints）

### 2.1 长期指令快照

- 先读 `tools/yuanctl/AGENTS.md`、本文件、`README.md`、`docs/deployment-cli-design.md`；重要决策与偏差写回本文件。
- 分层：命令解析在 `src/cli`，业务客户端在 `src/client`，配置在 `src/config`，输出在 `src/printers`，入口最小化。
- 仅通过 Host Terminal (SQL/Channel/服务) 交互，禁止直连数据库；复用 `@yuants/sql`/`@yuants/utils`/`@yuants/protocol`。
- 配置遵循 XDG + TOML，flag > env > config；新增字段同步 `config-init` 模板、类型与文档；保留 `YUANCTL_DISABLE_UPDATE_CHECK`。
- 写操作保持确认/幂等与安全防护，错误提示清晰不泄露敏感信息；完成工作后更新 Session Notes（最近记录、TODO、风险/问题）。

### 2.2 当前阶段指令

- 2025-11：建立并固化 context 文档（AGENTS/SESSION_NOTES），盘点设计与实现一致性，准备测试/验收计划。

### 2.3 临时指令（短期有效）

- 本轮仅进行文档整理，不改业务逻辑或生成文件。

### 2.4 指令冲突与变更记录

- 暂无冲突记录。若有新指令与 2.1/2.2 冲突，按 context-management 流程记录编号并在 AGENTS 同步。

---

## 3. 当前阶段的重点目标（Current Focus）

- 发布并维护 AGENTS/SESSION_NOTES，保证协作可追踪。
- 对照 `docs/deployment-cli-design.md` 盘点实现差异，列出修正计划。
- 制定配置解析、get/watch/logs 等关键路径的测试/验收方案。

---

## 4. 重要背景与关键决策（Context & Decisions）

### 4.1 架构 / 模块概览

- `src/cli`：Clipanion 命令树与动词实现（get/describe/enable/disable/delete/restart/logs/config-init）。
- `src/config`：解析 XDG/TOML，合并 flag/env/默认值；`config-init` 输出模板。
- `src/client`：`TerminalGateway` 管理 Host 连接；Deployments/NodeUnits/Logs 客户端复用 SQL/Channel 能力。
- `src/printers`：表格/JSON/YAML/describe 渲染，保持字段与排序稳定。
- `updateChecker.ts`：npm 更新提示，受 `YUANCTL_DISABLE_UPDATE_CHECK` 控制。
- `scripts/run-yuanctl-e2e.js`：E2E 脚本入口（需确认依赖/配置）。

### 4.2 已做出的关键决策

- **[D1]** CLI 采用 kubectl 风格动词/资源，可通过新增 verb 模块扩展，保持核心结构稳定。
- **[D2]** 所有数据交互通过 Host Terminal，不直连数据库；连接超时由 `TerminalGateway` 控制。
- **[D3]** 配置采用 XDG + TOML，flag/env 优先；`config-init` 只输出模板，不直接写文件。

### 4.3 已接受的折衷 / 技术债

- 暂未提供声明式 `apply`/部署模板；需后续设计安全边界。
- E2E 覆盖与离线/受限网络场景的行为描述仍需完善。

---

## 5. 关键文件与模块说明（Files & Modules）

- `tools/yuanctl/README.md`：功能概览、安装与配置。
- `tools/yuanctl/docs/deployment-cli-design.md`：设计背景、命令映射、架构预期。
- `tools/yuanctl/src/cli/index.ts`、`src/cli/verbs/*`：命令注册与动词实现。
- `tools/yuanctl/src/client/*.ts`：Terminal 连接与资源客户端。
- `tools/yuanctl/src/config/*`：配置类型与解析逻辑。
- `tools/yuanctl/src/printers/*`：输出渲染与格式控制。
- `tools/yuanctl/scripts/run-yuanctl-e2e.js`：E2E 入口与依赖。

---

## 6. 最近几轮工作记录（Recent Sessions）

### 2025-11-25 — Codex

- **本轮摘要**：
  - 为 CLI 增补模拟测试 `src/cli/__tests__/cli-commands.test.ts`（get/logs），并为测试提供 crypto mock 与 console 捕获。
  - 调整测试脚本为 `heft test --clean --debug`，解决默认 reporter 在本环境下导致的 TypeScript 子进程退出问题；`rushx test` 已可通过。
  - e2e 入口脚本未实跑（需 Docker 镜像与网络），保持 README 中的前置条件说明。
- **修改的文件**：
  - `tools/yuanctl/src/cli/__tests__/cli-commands.test.ts`
  - `tools/yuanctl/package.json`
- **运行的测试 / 检查**：
  - `cd tools/yuanctl && rushx test`（通过；使用 `--debug` 关闭 HeftJestReporter）

### 2025-11-24 — Codex

- **本轮摘要**：
  - 完成 SESSION_NOTES 7.1 对应的实现计划（`IMPLEMENTATION_PLAN.md`），Stage 1 完成，Stage 2 完成，Stage 3 未开始。
  - 设计对齐审计（Stage 1）：梳理当前实现与设计文档的差异。
  - 输出测试策略与脚手架文档（`docs/testing-plan.md`），并新增 CLI 模拟测试与 e2e 脚本入口（README 说明）。
- **发现的差异 / 待修复点**：
  - `logs`：`--since` 宣传支持但未实现（仅警告并忽略），需补实现或文档标注。
  - `logs` 仅接受 `deployment`/`deployments` 资源，`deploymentlogs` 别名在解析器存在但未被命令接受。
  - `logs --tail` 固定从 -128 KiB 读取再截尾，对大日志文件可能无法满足用户指定 tail 行数。
  - `describe nodeunits` 若未指定 identifier，会直接取第一个节点且忽略 selector/filter，不符合“可筛选”预期。
- **修改的文件**：
  - `tools/yuanctl/IMPLEMENTATION_PLAN.md`
  - `tools/yuanctl/docs/testing-plan.md`
  - `tools/yuanctl/src/cli/__tests__/cli-commands.test.ts`
  - `tools/yuanctl/package.json`
  - `tools/yuanctl/README.md`
- **运行的测试 / 检查**：
  - 未运行（尝试 `rush test --to` 发现 Rush 无 test 子命令，未进一步执行）

### 2025-11-24 — Codex

- **本轮摘要**：
  - 使用模板创建并填充 `tools/yuanctl/AGENTS.md` 与 `tools/yuanctl/SESSION_NOTES.md`，建立 context-management 文档体系。
  - 梳理 yuanctl 架构、设计基线与指令快照。
- **修改的文件**：
  - `tools/yuanctl/AGENTS.md`, `tools/yuanctl/SESSION_NOTES.md`
- **运行的测试 / 检查**：
  - 未运行（文档更新）

---

## 7. 当前 TODO / 任务列表（Tasks & TODO）

### 7.1 高优先级（下一轮优先处理）

- [ ] 对照 `docs/deployment-cli-design.md` 核查现有实现（命令/flag/输出/确认语义），记录差异与修复计划。（审计完成，待修复落地）
- [ ] 按 `docs/testing-plan.md` 落地自动化测试/验收脚本（配置解析、get/watch/logs），并运行测试。

### 7.2 中优先级 / 待排期

- [ ] 记录 update-checker 在离线/受限网络下的期望行为与开关策略，必要时补充文档或守护逻辑。
- [ ] 审核 `scripts/run-yuanctl-e2e.js` 前置条件，确认是否需要样例配置或 mock。

### 7.3 想法 / Nice-to-have

- [ ] 探索声明式 `apply`/部署模板的设计草案与安全边界。

---

## 8. 风险点 / 容易踩坑的地方（Risks & Gotchas）

- **Terminal 连接依赖外部 Host**：缺失/错误 `host_url` 或 TLS 参数会导致超时；需提供清晰错误并允许调整超时。
- **写操作影响生产部署**：enable/disable/delete/restart 会改动部署状态，新增功能需保留确认/过滤机制避免批量误操作。

---

## 9. 尚未解决的问题（Open Questions）

- 是否需要内置 dry-run/权限校验模式以降低批量操作风险？
- `apply`/部署模板的演进路线是否需要提前设计资源与回滚策略？

---

## 10. 下一位 Agent 的建议行动（Next Steps for Next Agent）

1. 阅读 `tools/yuanctl/AGENTS.md` 与本文件第 2/4/7 节，确认约束与当前重点。
2. 计划改动前，对照 `docs/deployment-cli-design.md` 的命令与输出预期；若发现偏差，在第 4/6 节记录结论。
3. 运行必要检查：`node common/scripts/install-run-rush.js test --to @yuants/tool-yuanctl` 或至少 `rushx test`/`rushx lint`；记录命令与结果。
4. 完成后更新第 6/7/8/9 节，并清理第 11 节 Scratchpad，保持上下文可接力。

---

## 11. 当前会话草稿 / Scratchpad（仅本轮使用）

### 当前会话（进行中） — 2025-11-24 07:20 — Codex

- （空）本轮仅整理文档；后续会话可在此记录进行中内容并在收尾时结算。
