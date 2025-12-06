---
name: git-changes-reporter
description: 生成结构化 git 变更报告，包含原始 JSON 数据和语义化 Markdown 解读。使用此技能当需要分析指定提交区间的代码变更，生成供工程师快速理解的报告，或为 Agent 提供上下文回答进一步问题。适用于代码审查、发布说明、团队同步、CI 每日摘要等场景。
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
.claude/skills/git-changes-reporter/scripts/generate-json.js <old_commit> <new_commit> [output_path]
```

**输出内容**：

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

**目的**：确保报告符合质量要求

```bash
.claude/skills/git-changes-reporter/scripts/validate-report.js <markdown_file>
```

## 报告模板

Agent 应按以下结构输出报告：

> 详细模板见 [references/report-template.md](references/report-template.md)

````markdown
# Git 变更报告（<old_commit>..<new_commit>）

> **时间范围**：YYYY-MM-DD 至 YYYY-MM-DD
> **分析深度**：Level 2

## 1. 概览

- **提交数量**：N
- **主要贡献者**：Author1 (X commits), Author2 (Y commits)
- **热点目录**：`apps` (N 文件), `common` (M 文件)
- **风险指标**：⚠️ N 个高风险项

## 2. 核心变更

### 2.1 [变更主题/领域名称]

**相关提交**：`hash1`, `hash2`
**作者**：Author Name

**设计意图**：
[解释为什么做这个改动，业务背景，技术动机。至少 50 字。]

**核心代码**：
[file.ts:L42-L58](path/to/file.ts#L42-L58)

```typescript
// 选择最能体现设计意图的 5-15 行代码
const example = () => {
  // ...
};
```
````

**影响范围**：

- 影响模块：`module-a`, `module-b`
- 需要关注：[具体的注意事项]

### 2.2 [下一个变更主题]

...

## 3. 贡献者

| 作者 | 提交数 | 主要工作 | 关键提交 |
| ---- | ------ | -------- | -------- |
| Name | N      | 简述贡献 | `hash`   |

## 4. 风险评估

### 兼容性影响

[具体描述 API 变更、配置格式变化，列出受影响的模块/服务]

### 配置变更

[新增、修改或删除的配置项]

### 性能影响

[可能影响性能的变更]

### 测试覆盖

[测试文件变更情况，是否有测试覆盖]

````

## 关键要求

### 1. 代码片段

- 每个核心变更**必须**包含代码片段或带行号的文件引用
- 代码片段长度：5-15 行
- **选择标准**：最能体现设计意图的代码，而非随机选取

### 2. 设计意图

- **必须**回答"为什么做这个改动"
- **禁止**仅描述"做了什么"
- 至少 50 个字符的实质性内容

### 3. 引用格式

**文件引用**：`[file.ts:L42-L58](path/to/file.ts#L42-L58)`

**Commit 引用**：使用 JSON 中的 `short` 字段（如 `a9300e76f`）

### 4. 内容选择原则

Agent 应根据以下优先级选择展示内容：

1. **Breaking changes**：API 变更、接口删除
2. **新功能**：feat 类型的核心实现
3. **重要修复**：影响用户的 bug fix
4. **架构变更**：refactor 涉及多文件的改动

**可以省略**：
- 版本号更新（chore: bump version）
- 纯文档变更
- 自动生成的 CHANGELOG

## 示例

### 好的报告示例

```markdown
### 2.1 Binance 请求间隔优化

**相关提交**：`b285cde59`
**作者**：Siyuan Wang

**设计意图**：
通过动态计算 API 限速参数，自动调整请求间隔，避免触发交易所限速机制。
此前使用固定间隔 500ms，在高频场景下仍会触发限速；现在根据交易所返回的
rateLimits 配置动态计算安全间隔（duration/limit），确保稳定性。

**核心代码**：
[quote.ts:L65-L78](apps/vendor-binance/src/public-data/quote.ts#L65-L78)
```typescript
const getRequestIntervalMs = (rateLimits: IRateLimit[], fallbackMs: number) => {
  const intervals: number[] = [];
  for (const item of rateLimits ?? []) {
    if (item.rateLimitType !== 'REQUEST_WEIGHT') continue;
    const duration = toIntervalMs(item.interval, item.intervalNum);
    const limit = item.limit;
    if (duration == null || limit == null) continue;
    intervals.push(Math.ceil(duration / limit));
  }
  return Math.max(fallbackMs, Math.max(...intervals));
};
````

**影响范围**：

- 影响模块：`vendor-binance`, `vendor-aster`（使用相同模式）
- 期货和现货数据流均受益

````

### 差的报告示例（避免）

```markdown
### 2.1 更新代码

**相关提交**：`1279`, `703`  ❌ 使用了行号而非 commit hash

**设计意图**：
添加了 getRequestIntervalMs 函数。  ❌ 只说了做什么，没说为什么

**核心改动**：优化了请求间隔逻辑  ❌ 没有代码片段
````

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
