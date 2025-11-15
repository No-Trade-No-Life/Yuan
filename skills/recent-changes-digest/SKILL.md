---
name: recent-changes-digest
description: 总结指定 git 提交区间的变更，输出含聚焦领域、作者、设计意图与速览的 Markdown 报告。
---

# Recent Changes Digest

## 目标与交付物

- 产出一份结构化 Markdown 文档，概览指定提交区间（`<old>`..`<new>`）的关键改动。
- 报告应至少包含：整体概览、改动聚焦领域、贡献者、设计意图、改动速览表；必要时补充技术影响、测试验证、后续建议。
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

## 用法

- `scripts/list-commits-between.sh`：一次性输出 oneline + `--stat`，方便粗略勘察。使用方式：
  ```bash
  skills/recent-changes-digest/scripts/list-commits-between.sh <old> <new>
  ```

## 工作流（遵循渐进披露理念）

1. **界定范围**

   - 解析用户输入，将 `<old>` `<new>` 映射为合法 commit。
   - 若范围过大（>100 提交），先提醒用户确认或拆分。

2. **列出提交（Level 2 信息）**

   - `git log --oneline <old>..<new>` 获取顺序、作者、主题。
   - 如需统计文件：`git log --stat --reverse <old>..<new>`。
   - 记录显著主题（feature、refactor、chore）。

3. **逐条调研**

   - 对关键 commit 使用 `git show --stat`、必要时 `git show <sha> -- <path>`。
   - 关注：
     - 涉及目录/项目（`apps/`, `libraries/`, `docs/`）。
     - 技术焦点（功能、重构、依赖更新）。
     - 作者与潜在动机（从 commit message / diff 推断）。

4. **主题归纳**

   - 将 commits 按项目或问题域聚类（如“OKX 重构”、“缓存策略”、“Vendor Open Interest”）。
   - 给出每个聚类的设计意图、风险点。

5. **撰写报告（Level 3 资源加载）**

   - 输出文件命名建议：`docs/reports/recent-changes-<YYYY-MM-DD>.md`。
   - 推荐结构：
     ```
     # 近期变动摘要（<range>）
     ## 1. 概览
     ## 2. 改动聚焦领域
     ## 3. 贡献者
     ## 4. 设计意图
     ## 5. 改动速览（表格）
     ## 6. 技术影响与风险
     ## 7. 测试与验证
     ## 8. 后续建议
     ## 9. 参考资料（可选）
     ```
   - 适当引用文件路径（`apps/vendor-aster/src/quote.ts:1-40`）方便跳转。
   - 自动化提交（版本号 bump）可简述为“无业务逻辑改动”。

6. **自检与交付**
   - `git status --short docs/reports`，确认文件生成位置正确。
   - 人检：
     - 四个核心问题是否回答。
     - 是否覆盖关键作者、目录、意图。
     - 表述是否简明、无堆砌。

## 写作风格指南

- **语气**：客观、面向工程同事；突出事实与洞察。
- **结构**：短段落 + 列表优先；表格用于比较提交。
- **引用**：路径 + 行号（如 `apps/vendor-okx/src/account.ts:1-80`）。
- **语言**：保持中文输出，如需引用代码/命令使用英文。

## 质量检查清单

- [ ] 范围无误，起止 commit 正确。
- [ ] 每个主题附带至少一个具体文件或模块引用。
- [ ] 明确列出作者与角色（个人 / bot）。
- [ ] 给出潜在风险或下一步建议。
- [ ] 脚本或命令在仓库根目录可直接执行。

## 常见错误 & 规避

- **仅罗列 commit**：需抽象出主题与意图。
- **忽视自动化提交**：虽无逻辑变更，仍需说明“版本同步”。
- **引用路径不准确**：使用 `rg -n` 或 `nl -ba` 确认行号。
- **上下文缺失**：必要时说明链路（例如“先新增 cache，再在 vendors 引入”）。

> 若需扩展更多自动化（如生成表格、同步到文档系统），可在 `skills/recent-changes-digest/scripts/` 内继续添加脚本，并在上述工作流中引用。
