---
name: git-changes-reporter
description: 生成结构化 git 变更报告（JSON + Markdown）。使用此技能当用户提到"git 变更"、"commit 摘要"、"代码审查"、"release note"、"近期改动"、"每日摘要"，或需要分析指定 commit 区间的代码变更。包含三元组结构（设计意图、核心代码、影响范围）的语义化报告，适用于代码审查、发布说明、团队同步、CI/CD 等场景。
---

# Git Changes Reporter

## 何时使用本 Skill

满足以下任一条件时，应使用本 Skill：

- 需要为人类工程师生成可读的变更摘要（团队同步、代码审查、发布说明）
- 需要为 Agent 提供完整 git 变更上下文以回答后续问题
- CI/CD 流水线中需要存储和分析变更记录
- 用户提到"近期改动"、"commit 摘要"、"release note"等需求

**不要使用本 Skill 的情况**：

- 仅需列出 commit 列表（直接用 `git log`）
- 单个 commit 的详细分析（直接用 `git show`）

## 核心原则

### Agent 主导判断

- **脚本**：只负责数据收集，不做内容选择
- **Agent**：阅读数据，判断重要性，选择展示内容，撰写分析

### 简洁至上

上下文是共享资源。报告应该：

- **聚焦意图**：不仅说"做了什么"，更要说"为什么"
- **代码片段优先**：5-15 行核心代码胜过长篇解释
- **结构化呈现**：用列表和表格而非段落堆砌

### 渐进式披露

三个分析深度级别：

- **Level 1 (基础)**：统计信息、目录热度、贡献者分析
- **Level 2 (中级)**：含代码片段、风险识别、领域聚类（**默认**）
- **Level 3 (深度)**：含调用关系、完整风险评估、详细影响分析

## 工作流程

### 阶段一：生成结构化 JSON

**目的**：收集原始数据，自动提取代码片段和风险指标

```bash
.claude/skills/git-changes-reporter/scripts/generate-json.js <old_commit> <new_commit> [output_path] [options]
```

**选项**：

| 选项                        | 说明                                   | 默认值                               |
| --------------------------- | -------------------------------------- | ------------------------------------ |
| `--markers=FILE1,FILE2,...` | 项目边界特征文件（用于 monorepo 分析） | `package.json,Cargo.toml,go.mod,...` |

**Monorepo 项目检测**：

脚本会自动扫描仓库中的特征文件（如 `package.json`、`Cargo.toml`）来识别项目边界，支持任意深度的嵌套结构：

```bash
# 默认使用常见特征文件检测项目
generate-json.js HEAD~10 HEAD

# 指定特定的特征文件（如纯 Python 项目）
generate-json.js HEAD~10 HEAD --markers=pyproject.toml,setup.py
```

**输出内容**：

- `directoryAnalysis`：目录热点分析
  - `topLevel[]`：顶层目录统计（如 `apps`, `libraries`）
  - `projects[]`：项目级别统计（如 `apps/vendor-okx`, `libraries/protocol`）
    - `project`：项目路径
    - `fileCount`：变更文件数
    - `marker`：检测到的特征文件（如 `package.json`）
  - `markersUsed`：使用的特征文件列表
- `commits[]`：每个 commit 的详细信息
  - `short`：短哈希（用于引用）
  - `subject`：提交主题
  - `conventionalCommit`：解析的 feat/fix/refactor 等类型
  - `files[]`：变更文件列表
    - `path`：文件路径
    - `changeType`：added/modified/deleted/renamed
    - `codeSnippets[]`：自动提取的函数/类/接口定义（最多 15 行）
- `analysis.domains[]`：自动识别的技术领域
- `analysis.riskIndicators[]`：风险指标（breaking_change/large_refactor/no_tests/api_change）
- `contributors[]`：贡献者统计

### 阶段二：Agent 阅读 JSON 并生成报告

**Agent 职责**：

1. 分段读取 JSON 文件（按需读取，避免超出 token 限制）
2. 理解变更的技术意图和业务影响
3. 选择重要的代码片段展示
4. 按照下方模板格式输出最终 Markdown 报告

**读取策略**（JSON 文件可能较大）：

```bash
# 读取概览信息
Read JSON offset=0 limit=100  # meta, contributors, analysis 部分

# 按需读取具体 commit
Read JSON offset=X limit=200  # 特定 commit 的详细信息
```

### 阶段三：质量验证

**目的**：确保报告符合质量要求，防止胡编乱造

#### 第一次验证：基础检查

验证报告格式和结构完整性：

```bash
.claude/skills/git-changes-reporter/scripts/validate-report.js <markdown_file>
```

**检查内容**：

- 必需章节（概览、核心变更、贡献者、风险评估）
- 代码片段格式
- 文件引用格式
- Commit hash 格式
- 设计意图完整性

#### 第二次验证：严格模式（默认启用）

验证报告内容真实性，防止胡编乱造：

```bash
# 严格模式已默认启用（提供 --json 即可）
.claude/skills/git-changes-reporter/scripts/validate-report.js <markdown_file> \
  --json <json_file>
```

**严格模式自动检查**：

- ✅ **Commit 覆盖率**：确保 100% 覆盖 JSON 中所有 commits，无遗漏
- ✅ **文件引用真实性**：验证所有文件路径存在于仓库（通过 `git ls-files`）
- ✅ **Commit hash 真实性**：验证所有 commit hash 存在于仓库（通过 `git cat-file`）

**如需仅做格式检查**（不推荐）：

```bash
# 使用 --basic 禁用严格验证
.claude/skills/git-changes-reporter/scripts/validate-report.js <markdown_file> \
  --json <json_file> \
  --basic
```

#### 第三次验证：人工复查清单（可选）

生成二次确认清单供 Agent 逐项复查：

```bash
.claude/skills/git-changes-reporter/scripts/validate-report.js <markdown_file> \
  --json <json_file> \
  --checklist
```

**清单内容**：

- 列出所有应覆盖的 commits
- 统计代码片段数量
- 显示文件引用列表

**工作流建议**：

1. **首次生成报告**：先运行基础验证，修复格式问题
2. **内容完善后**：运行严格模式（**默认启用**，只需提供 `--json`），确保内容真实性
3. **提交前**：使用 `--checklist` 进行人工复查

**重要**：严格验证已默认启用，Agent 无法跳过真实性检查，有效防止胡编乱造。

## 报告模板与关键要求

Agent 必须使用**三元组结构 + 提交明细**输出每个核心变更：

1. **设计意图**（为什么做，至少 50 字）
2. **核心代码**（5-15 行代码片段 + 文件引用）
3. **影响范围**（影响的模块和注意事项）
4. **提交明细**（每个 commit 一句话：`hash: 做了什么`）

**⚠️ 全覆盖要求**：核心变更章节必须涵盖所有提交，不能遗漏任何一个 commit。

> **完整模板、示例和详细要求**：见 [references/report-template.md](references/report-template.md) > **避免常见错误**：见 [references/bad-examples.md](references/bad-examples.md)

## 故障排除

| 问题                      | 解决方案                                          |
| ------------------------- | ------------------------------------------------- |
| JSON 文件太大无法一次读取 | 分段读取：先读 meta/analysis，再按需读具体 commit |
| 不确定哪些变更重要        | 优先看 riskIndicators 和 conventionalCommit 类型  |
| Commit 数量太多           | 按领域分组，相似变更合并描述                      |

## 参考资源

- [references/report-template.md](references/report-template.md)：完整模板示例
- [references/bad-examples.md](references/bad-examples.md)：反面示例
- [scripts/README.md](scripts/README.md)：脚本使用文档

---

**版本**：3.0.0
**上次更新**：2025-12-06
