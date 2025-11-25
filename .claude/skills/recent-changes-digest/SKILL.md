---
name: recent-changes-digest
description: 总结指定 git 提交区间的变更，输出含聚焦领域、作者、设计意图与速览的 Markdown 报告。
---

# Recent Changes Digest

## 目标与交付物

- 先生成结构化 JSON（含每个文件的 patch），再据此撰写结构化 Markdown 文档，概览提交区间（`<old>`..`<new>`）的关键改动。
- 报告应至少包含：整体概览、改动聚焦领域、贡献者、设计意图、改动速览表；必要时补充技术影响、测试验证、后续建议，并按语义模块聚类（如“错误处理/观测性/Vendor/前端/工具”等）。
- 改动聚焦领域需写足细节并显式关联涉及的 commit 短 hash，方便读者对照。
- 需基于 JSON 生成每个 commit 的摘要（可用于正文或附录），每条使用 Markdown 标题+正文的格式（非单行），确保读者单条即可理解改动。
- 确保读者“开卷即得”，能快速定位目录与重点文件。

## 触发条件（When to load this Skill）

- 用户提及“近期改动 / commit 摘要 / release note”等需求。
- 用户提供具体 commit、tag、分支或默认最新提交，需要在仓库上下文内梳理变更。
- 需要跨多个目录梳理主题、作者与动机，而不仅仅是列出 `git log`。

## 输入预期

- 一个可访问的 Git 仓库（默认 `/home/c1/Work/Yuan`）。
- 至少一个提交范围：
  - `old..new`（标准范围）；
  - 单一起点或终点时，可用 `git rev-parse` 补齐；
  - 若完全缺省，可提示用户或默认使用 `HEAD~10..HEAD`。

## 前置检查

1. `git status --short`，确认无必要的未提交文件影响判断。
2. `git rev-parse --show-toplevel`，确保在仓库根目录执行命令。
3. 创建输出目录：`docs/reports/`；若无权限需提示用户。

## 用法（先跑脚本，再用 JSON 写摘要）

1. 生成结构化 JSON（含每个文件的 patch）：
   ```bash
   .claude/skills/recent-changes-digest/scripts/generate-digest.js <old> <new> [output_path]
   # 默认输出 docs/reports/recent-changes-YYYY-MM-DD.json
   ```
2. 基于生成的 JSON 写 Markdown 摘要，建议用 `jq` 快速查看：
   ```bash
   jq '.range, .contributors, .topDirs | .commits[0]' docs/reports/recent-changes-YYYY-MM-DD.json
   ```
   输出数据结构示例：

```json
{
  "range": {
    "old": "<old>",
    "new": "<new>",
    "label": "old..new",
    "startDate": "2025-11-22",
    "endDate": "2025-11-25",
    "commitCount": 36,
    "generatedAt": "2025-11-25T07:00:00Z"
  },
  "contributors": [{ "name": "CZ", "email": "zheng.chen@...", "commits": 20 }],
  "topDirs": [{ "dir": "apps", "fileCount": 176 }],
  "commits": [
    {
      "hash": "03a48cfc40aa113fb47a6458a1f9619b7c005614",
      "short": "03a48cfc4",
      "author": "CZ",
      "email": "zheng.chen@...",
      "authoredAt": "2025-11-22T01:07:13+08:00",
      "subject": "feat: ...",
      "files": [
        {
          "path": "libraries/protocol/src/terminal.ts",
          "additions": 6,
          "deletions": 3,
          "patch": "diff --git a/... b/...\n@@ ..."
        }
      ]
    }
  ]
}
```

## 工作流（遵循渐进披露理念）

1. **生成原始数据**

   - 运行脚本生成 JSON：`.claude/skills/recent-changes-digest/scripts/generate-digest.js <old> <new>`.
   - 确认输出文件存在，路径默认 `docs/reports/recent-changes-YYYY-MM-DD.json`。

2. **快速审阅（Level 2 信息）**

   - 查看范围与作者：`jq '.range, .contributors' <json>`.
   - 查看顶层目录热度：`jq '.topDirs' <json>`.
   - 抽样首尾 commit：`jq '.commits[0], .commits[-1]' <json>`.

3. **逐条调研（基于 JSON）**

   - 按需查看关键提交的文件与 patch：`jq '.commits[] | {subject, files}' <json>`.
   - 关注：
     - 涉及目录/项目（`apps/`, `libraries/`, `docs/`, `tools/`）。
     - 技术焦点（功能/重构/依赖/安全/运维）。
     - 作者与潜在意图（从 subject 与 patch 推断）。

4. **语义聚类**

   - 将 commits 按问题域聚类并命名模块（示例：“错误处理与观测”、“终端安全与鉴权”、“Vendor 接入与行情”、“前端体验与工具”、“运维与监控”）。
   - 每个模块包含：涉及目录/文件、主要提交（短 hash）、意图与风险。

5. **撰写报告（Level 3 输出，必须基于 JSON 数据）**

   - 先加载 JSON（不可跳过脚本生成步骤），用其中的 commits/files/patch 聚合后写 Markdown，输出文件命名建议：`docs/reports/recent-changes-<YYYY-MM-DD>.md`。
   - 推荐结构：
     ```
     # 近期变动摘要（<range>）
     ## 1. 概览
     ## 2. 改动聚焦领域（按语义模块分组）
     ## 3. 贡献者
     ## 4. 设计意图
     ## 5. 改动速览（表格）
     ## 6. 技术影响与风险
     ## 7. 测试与验证
     ## 8. 单 commit 摘要（可放附录，正文可引用关键条目）
     ## 9. 后续建议
     ## 10. 参考资料（可选）
     ```
   - 语义模块建议：错误处理与观测、安全鉴权、Vendor 与交易所、前端体验与工具、运维与部署/监控、依赖/发布同步；每个模块要列出涉及目录/文件、关键提交（短 hash + 主题）、核心意图与风险，并在描述中挂上对应 commit 短 hash。
   - 速览表用 JSON 的 commit 列表生成：短 hash / 作者 / 主题 / 核心目录。
   - 引用文件路径并可附行号（`apps/vendor-aster/src/quote.ts:1-40`）方便跳转；补充 patch 中体现的关键行为（新增接口、移除字段、校验/指标调整等）。
   - 自动化提交（版本号 bump）可简述为“无业务逻辑改动”。
   - 在正文或附录附上“单 commit 摘要”列表，格式见下文，确保每条可独立理解变更内容；正文可挑选关键 commit 的摘要作为模块内证据，其余放入附录。

6. **自检与交付**
   - `git status --short docs/reports`，确认文件生成位置正确。
   - 人检：
     - 四个核心问题是否回答。
     - 是否覆盖关键作者、目录、意图与风险。
     - 语义模块划分是否清晰，摘要是否简明。

### 单 commit 摘要格式（基于 JSON 自动生成）

- 生成流程：
  1. 运行脚本产出 JSON。
  2. 对 JSON 中每个 commit 生成独立摘要，供全文速览或附录引用。
  3. 写总览时可择要抽取关键 commit。
- 输出格式（每条）：
  - `hash(short)` 作者 | 日期 | 模块标签（1~2 个，如「安全」「错误处理」「Vendor」「前端」「运维」）
  - 主题：原 commit subject
  - 变更要点（3~5 条，覆盖文件/行为/接口/校验/观测）：
    - 文件/目录：具体路径（可含行号），描述改动动作（新增/移除/重构）与目的。
    - 接口/协议/校验：指出新增参数、字段来源变化、校验逻辑变更。
    - 行为/数据流：运行时行为或数据来源的变化。
    - 观测/指标：新增或变更的指标、日志、错误计数等。
  - 风险/影响（1~2 条）：兼容性/配置/依赖/运维影响。
  - 测试：列出新增/修改的测试文件；若无，标注“未见测试记录”。
- 示例（说明用）：
  - `03a48cfc4` CZ | 2025-11-22 | 安全
  - 主题：feat: enforce terminal_id to be derived from public_key in Terminal...
  - 变更要点：
    - `libraries/protocol/src/terminal.ts:138`：连接 URL 中强制用公钥派生 `terminal_id`，保证 ID 与密钥绑定。
    - `libraries/protocol/src/terminal.ts:140-143`：对 `host_token` 进行签名并随连接参数发送，用于身份校验。
    - `common/changes/@yuants/protocol/2025-11-21-16-55.json`：同步记录协议变更。
  - 风险/影响：依赖自定义 `terminal_id` 的客户端需改为公钥派生，否则连接可能被拒。
  - 测试：未见测试记录。

## 写作风格指南

- **语气**：客观、面向工程同事；突出事实与洞察。
- **结构**：短段落 + 列表优先；表格用于比较提交。
- **引用**：路径 + 行号（如 `apps/vendor-okx/src/account.ts:1-80`）。
- **语言**：保持中文输出，如需引用代码/命令使用英文。
- **单 commit 摘要**：保持简洁但覆盖关键点（文件、接口、行为、风险、测试），可直接复制至附录或正文。

## 质量检查清单

- [ ] 范围无误，起止 commit 正确。
- [ ] 每个主题附带至少一个具体文件或模块引用。
- [ ] 明确列出作者与角色（个人 / bot）。
- [ ] 给出潜在风险或下一步建议。
- [ ] 脚本或命令在仓库根目录可直接执行。
- [ ] 为每个 commit 生成独立摘要（含文件/行为/风险/测试），正文或附录可直接使用。

## 常见错误 & 规避

- **仅罗列 commit**：需抽象出主题与意图。
- **忽视自动化提交**：虽无逻辑变更，仍需说明“版本同步”。
- **引用路径不准确**：使用 `rg -n` 或 `nl -ba` 确认行号。
- **上下文缺失**：必要时说明链路（例如“先新增 cache，再在 vendors 引入”）。

> 若需扩展更多自动化（如生成表格、同步到文档系统），可在 `skills/recent-changes-digest/scripts/` 内继续添加脚本，并在上述工作流中引用。
