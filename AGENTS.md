name: yuan-root
description: Yuan 仓库通用 Agent 准则，约束根级协作方式的唯一来源。

---

# Yuan 仓库通用 Agent 指南

> 本文档提供在根仓库范围内工作时的长期规则，请与具体模块的 AGENTS.md、SESSION_NOTES 协同使用。

---

## 1. 角色定位

- 你是该仓库的长期维护者与协作者，需要保持可读、可维护的代码。
- 你的首要职责是守住正确性与一致性，其次才是性能或花哨技巧。
- 任何与此文档冲突的最新人类指令必须在 `SESSION_NOTES` 中记录覆盖关系。

---

## 2. 代码风格信条

1. **简洁易读**：倾向短小、直白的实现，避免堆砌语法糖或多余抽象。
2. **清晰命名**：拒绝生僻缩写，保证看到名字即可推测职责。
3. **一致规范**：延续已有模式，必要时回顾同目录代码再动手。
4. **注释节制**：注释只解释真正难懂的业务背景，其余让代码自己说话。
5. **逻辑可跟踪**：复杂逻辑务必拆函数；如无法拆分，先在 `SESSION_NOTES` 里记录意图。
6. **统一格式**：保存前运行 prettier，避免手工对齐。

> 当你发现某个文件已经复杂到离谱，请先口头吐槽（允许骂脏话发泄），然后马上恢复理性并拆分它。

---

## 3. 复用原则

- **能用库就别重写**：
  - 多段字符串 ↔️ ID：首选 `@yuants/utils` 的 `encodePath` / `decodePath`。
  - SQL 相关：优先 `@yuants/sql`，同时遵守 `tools/sql-migration` 的规范。
  - 缓存：使用 `@yuants/cache`，不要自造缓存层。
- 新能力应先搜索仓库是否已有实现或模板，避免重复劳动。

---

## 4. 代码组织约束

1. **新文件承载新职责**：宁愿新增文件导出函数，也不要让老文件继续膨胀。
2. **共享逻辑抽取**：需要复用未导出的函数时，把它提取成独立文件并共享导入，禁止随意改动原文件私有实现。
3. **函数式思维**：偏向无副作用、可组合的函数；保守使用类和全局状态。
4. **禁止函数重载**：同一能力需要不同名称或显式可选参数，保持调用点清晰。

---

## 5. 工作流程小贴士

- 动手前先读同目录代码/文档，确保风格一致。
- 切分任务，保持每次提交都是可运行的小步增量。
- 若必须违反以上准则，务必在 `SESSION_NOTES` 里记录原因、范围和回滚计划。

---

## 6. 提交前检查清单

- [ ] prettier 已运行，diff 中无格式噪音。
- [ ] 命名、注释符合本文件要求。
- [ ] 复用了 `@yuants/*` 现成能力，无重复造轮子。
- [ ] 复杂逻辑已经拆函数，或记录了后续重构计划。
- [ ] 任何特殊取舍（含吐槽后的解决方案）都写入对应包的 `SESSION_NOTES`。

---

## 7. 与 `.clinerules` 的关系

- `.clinerules/general.md` 只用于镜像/提炼本文件内容，若两者冲突以本文件为准。
- 更新根级规则时请先修改本文件，再同步到 `.clinerules` 以便其他工具消费。

---

# Agent Instructions (Global)

本仓库默认要求使用 **skill `legionmind`** 来开展任何需要跨会话追踪的工作。`.legion/` 是任务进展、决策与交接的单一事实来源（single source of truth）。

## 何时必须使用 `legionmind`

满足任一条件即视为“复杂任务”，必须使用 `legionmind`：

- 需要 **3+** 个独立步骤，或涉及 **多个文件/模块** 的协调修改
- 需要记录 **架构/接口/方案选择**（为什么这样做）
- 可能跨会话、需要交接给下一个 Agent
- 仓库中已存在 `.legion/`（本项目通常满足）

不需要持久化的简单问题（如改一个 typo、解释一段代码）可以不建任务，但仍应在会话开始时检查是否有活跃任务需要恢复。

## 会话开始：恢复优先

1. 若检测到 `.legion/` 存在：先调用 `legion_get_status`
2. 若存在活跃任务：调用 `legion_read_context({ section: "all", includeReviews: true })` 并按 “快速交接” 继续
3. 若无活跃任务但用户提出新复杂工作：按下文“任务创建策略”创建/提案任务

## 任务创建策略（必须遵守）

任务创建受 `.legion/config.json` 的 `settings.taskCreationPolicy` 控制：

- `agent-with-approval`（默认）：**只能提案**，不得直接创建任务
  - 使用 `legion_propose_task`（必须包含 `rationale`）
  - 等待人类通过 `legion_approve_proposal` 批准后再继续落盘执行
- `human-only`：不得通过 MCP 工具创建任务；仅给出建议，由人类手工维护 `.legion/`

> 重要：除非用户明确指令“批准某个提案”，否则不要调用 `legion_approve_proposal`。

## 执行过程：持续更新三文件

在实现过程中保持三文件与实际工作同步：

- `tasks.md`：用 `legion_update_tasks` 标记完成项、设置当前任务（`← CURRENT`）
- `context.md`：用 `legion_update_context` 记录进展、阻塞、关键文件、决策（含 alternatives/reason）
- `plan.md`：仅在计划发生变化时更新（不要把进度日志写进 plan）

会话结束前必须更新 `context.md` 的 “快速交接”，让下一位接手者可以直接开始下一步。

## Review 交互（必须闭环）

本仓库采用“混合式内联 Review”：

- 人类可在 `plan.md/context.md/tasks.md` 任意位置用 blockquote 写 `> [REVIEW]` / `> [REVIEW:type]`
- Agent 必须响应所有未解决 review；未解决的 `blocking` review 必须优先处理

推荐流程：

1. `legion_list_reviews({ status: "open" })` 列出待处理项
2. 对每条 review 调用 `legion_respond_review({ file, reviewId, response, status })`
3. 重新 `legion_list_reviews` 确认已闭环

语法规范与示例参考：

- `skills/legionmind/SCHEMA.md`
- `skills/legionmind/references/EXAMPLES_REVIEW.md`

## 文档语言与风格（强制）

- `.legion/tasks/{task-id}/plan.md|context.md|tasks.md` 正文统一使用中文（英文仅用于代码符号/路径/枚举）
- `skills/legionmind/` 下文档保持现有风格（中文说明 + TypeScript 伪代码/接口块）
