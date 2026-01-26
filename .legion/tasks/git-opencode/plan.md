# 替换 Git 报告工作流为 OpenCode

## 目标

将 .github/workflows/daily-git-report.yml 中的 Claude Code 替换为 OpenCode，使用 DeepSeek Reasoner 输出报告

## 要点

- 调研现有工作流结构与配置
- 设计 OpenCode 集成方案与配置变更
- 更新 daily-git-report.yml 工作流文件
- 更新 README-daily-git-report.md 文档
- 测试验证与回滚方案设计

## 范围

- .github/workflows/daily-git-report.yml
- .github/workflows/README-daily-git-report.md
- .claude/skills/git-changes-reporter/

## 阶段概览

1. **调研与分析** - 3 个任务
2. **方案设计与文档更新** - 2 个任务
3. **实施与测试** - 3 个任务

---

_创建于: 2026-01-16 | 最后更新: 2026-01-16_
