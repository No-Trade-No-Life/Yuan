# yuanctl 实现计划（针对 SESSION_NOTES 7.1 高优先级）

> 基于 `.claude/skills/context-management/IMPLEMENTATION_PLAN.template.md`。覆盖 SESSION_NOTES 7.1 的两项高优先级任务：设计/实现差异盘点与关键路径测试计划。

## 元信息（Meta）

- 计划名称：yuanctl 设计一致性审计与关键路径测试
- 关联 Issue / 需求：SESSION_NOTES 7.1
- 创建时间：2025-11-24
- 最近更新时间：2025-11-24（Codex）

---

## 阶段规划（Stages）

### Stage 1: 设计-实现差异梳理

**Goal（目标）**：

- 对照 `docs/deployment-cli-design.md` 与当前代码实现（命令/flag/输出/确认/默认值），列出差异清单和优先级。

**Success Criteria（成功标准）**：

- 差异清单按资源/动词分类，标注影响范围（兼容性/安全/体验）。
- 输出可执行的修复建议或确认“无差异”的结论。

**Tests（需要的测试）**：

- 手动/静态审查：检查 `src/cli/verbs/*`、`src/client/*`、`src/printers/*`、`updateChecker.ts` 与设计文档的对应关系。

**Status（状态）**：

- Complete

---

### Stage 2: 关键路径测试策略与脚手架

**Goal**：

- 为配置解析、get/watch/logs 等核心路径制定自动化测试策略，确定测试类型（unit/e2e）、输入输出样例与环境需求。

**Success Criteria**：

- 已形成测试列表与预期（见 `docs/testing-plan.md`），涵盖配置解析、get/watch/logs 等核心路径。
- 确定了 mock/fixture/CLI 调用方式与 CI 命令（`rushx test`）。
- 如需 E2E，前置条件与配置样例已在文档中列出。

**Tests**：

- 文档化的测试计划与脚手架建议（`docs/testing-plan.md`）；后续实现测试用例按此执行。

**Status**：

- Complete

---

### Stage 3: 差异修复与测试落地

**Goal**：

- 根据 Stage 1 的差异清单完成修复，并在 Stage 2 的测试框架下验证关键路径。

**Success Criteria**：

- 设计一致性差异已关闭或有明确延期记录；新增/更新的测试覆盖配置解析、get/watch/logs 基本场景。
- 测试在 CI/本地通过（记录命令与结果），Session Notes 更新修复与测试情况。

**Tests**：

- `node common/scripts/install-run-rush.js test --to @yuants/tool-yuanctl`（或等效 `rushx test`/`rushx lint`）
- 针对新增用例的具体命令（待 Stage 2 定义）。

**Status**：

- Not Started

---

## 实现流程建议（Implementation Flow）

1. **Understand / 理解现状**
   - 查阅 `SESSION_NOTES` 相关背景与指令；阅读 `docs/deployment-cli-design.md` 和当前 `src/cli`/`src/client`/`src/printers`。
2. **Test / 测试优先（尽可能 TDD）**
   - 先写/确定测试（让测试先红），确保能暴露差异或缺失。
3. **Implement / 实现**
   - 以最少改动让测试变绿，保持分层与安全确认语义。
4. **Refactor / 重构**
   - 在测试通过前提下整理结构、抽取函数，避免过早抽象。
5. **Commit / 提交**
   - 运行必要检查（test/lint），自审 diff，提交信息说明 Stage 关联与原因。

---

## Definition of Done（完成定义）

- [ ] 三个 Stage 的 `Status` 均为 `Complete`
- [ ] 承诺的测试已编写并通过（含新增用例）
- [ ] 设计一致性差异已关闭或记录明确延期
- [ ] 代码符合 AGENTS 与项目风格/安全要求
- [ ] `SESSION_NOTES` 已更新：记录完成情况、测试命令与结果、残留风险/技术债（如有）
