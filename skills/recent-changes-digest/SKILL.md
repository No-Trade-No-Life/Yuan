---
name: recent-changes-digest
description: 总结指定 git 提交区间的变更，输出含聚焦领域、作者、设计意图与速览的 Markdown 报告。
---

# Recent Changes Digest

## 适用场景

- 用户要求“总结某段提交/近期改动/版本更新”等，并给出 commit 范围或默认使用最新 commit。
- 需要产出结构化 Markdown 文档，让读者快速了解改动聚焦点、贡献者与设计动机。

## 前置检查

1. 确认仓库根目录（通常 `/home/c1/Work/Yuan`）。
2. 明确 commit 区间：
   - 若用户提供 `<old>..<new>`，直接使用。
   - 若只给起点或终点，使用 `git rev-parse` / `git log -1` 补齐。
3. 创建输出目录 `docs/reports/`（若不存在）。

## 工作流

1. **列出提交**
   ```bash
   git log --oneline <old>..<new>
   ```
   - 记录提交顺序、作者与主题，过滤掉起点自身。
   - 可选：运行 `skills/recent-changes-digest/scripts/list-commits-between.sh <old> <new>` 一次性输出 oneline 与 `--stat` 详情，便于快速取数。
2. **逐条调研**
   - 使用 `git show --stat <sha>` 获取触及文件与改动量。
   - 需要深入理解时 `git show <sha> -- <path>` 或 `nl -ba <file>` 阅读关键片段。
   - 重点整理：涉及目录/项目、功能点、作者与潜在意图。
3. **提炼主题**
   - 按项目/目录聚类（如 `apps/vendor-*`, `libraries/cache`, `docs/*`）。
   - 归纳设计动机（例如：引入 open interest、重构 OKX helper、增强 cache swr）。
4. **撰写 Markdown**
   - 推荐放在 `docs/reports/recent-changes-<YYYY-MM-DD>.md`。
   - 报告至少包含：
     1. 概览（时间范围、提交数量、总体趋势）。
     2. 改动聚焦领域（问题 1）。
     3. 贡献者与对应工作（问题 2）。
     4. 设计意图（问题 3）。
     5. 改动速览/表格（问题 4）。
   - 视需要附加：技术影响/风险、测试验证、后续建议。
5. **验证输出**
   - `git status --short docs/reports` 确认新文件可追踪。
   - 快速自检 Markdown 结构，确保四个问题与额外要点覆盖。

## 输出示例骨架

```
# 近期变动摘要（<range>）
## 1. 概览
## 2. 改动聚焦领域
## 3. 贡献者
## 4. 设计意图
## 5. 改动速览
## 6. 技术影响与风险
## 7. 测试与验证
## 8. 后续建议
```

## 补充建议

- 适度引用文件路径（如 `apps/vendor-aster/src/quote.ts:1-40`）以便读者定位。
- 如果提交体量大，可按主题分组多张表格，确保“让人一目了然”。
- 遇到自动版本提交，可简述为“版本号同步，无业务逻辑变动”。
