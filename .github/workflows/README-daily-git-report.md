# 每日 Git 变更报告工作流

## 概述

这个 GitHub Actions 工作流每天东八区早上 8 点自动运行，生成前一天的 Git 变更报告并创建 Pull Request。

## 功能

1. **自动时间范围计算**：提取昨日 8 点到今日 8 点的 commit 范围
2. **结构化数据生成**：生成 JSON 格式的详细提交数据
3. **语义化报告生成**：使用 OpenCode 生成专业报告
4. **自动 PR 创建**：创建包含报告文件的 Pull Request
5. **制品上传**：将报告文件上传为工作流制品

## 设置步骤

### 1. 设置 DeepSeek API Key

1. 获取 DeepSeek API Key：

   - 访问 https://platform.deepseek.com/api_keys
   - 创建新的 API Key 或使用现有 Key

2. 在 GitHub 仓库中设置 Secret：
   - 进入仓库 Settings > Secrets and variables > Actions
   - 点击 "New repository secret"
   - Name: `DEEPSEEK_API_KEY`
   - Value: 你的 DeepSeek API Key

### 2. 启用工作流

工作流文件位于 `.github/workflows/daily-git-report.yml`，默认已启用。

### 3. 手动测试

可以在 GitHub 仓库的 Actions 页面手动触发工作流：

1. 进入 "Actions" 标签页
2. 选择 "Daily Git Change Report"
3. 点击 "Run workflow"
4. 可选：输入时区偏移（默认 +8）

## 工作流步骤详解

### 1. 获取每日提交范围

- 使用 `get-daily-commit-range.sh` 脚本计算时间范围
- 支持自定义时区偏移
- 输出起始和结束 commit hash

### 2. 生成 JSON 数据

- 使用 `generate-json.js` 脚本生成结构化数据
- 包含提交统计、作者信息、文件变更等
- 保存为 `docs/reports/git-changes-YYYY-MM-DD.json`

### 3. 通过 OpenCode 生成报告

- 使用 `anomalyco/opencode/github` Action
- 通过 DeepSeek 提供商直接调用 `deepseek-reasoner` 模型
- 严格按照 git-changes-reporter skill 的规则和要求生成语义化报告
- 保存为 `docs/reports/git-changes-report-YYYY-MM-DD.md`

### 4. 创建 Pull Request

- 创建新分支 `daily-report-YYYY-MM-DD`
- 提交报告文件
- 创建 PR 到 main 分支
- 添加标签：`automated`, `report`, `daily`

### 5. 上传制品

- 将 JSON 和 Markdown 文件上传为工作流制品
- 保留 7 天

## 输出文件

### JSON 数据文件

```
docs/reports/git-changes-2025-12-02.json
```

包含：

- 提交范围信息
- 作者贡献统计
- 热点目录
- 详细提交数据

### Markdown 报告文件

```
docs/reports/git-changes-report-2025-12-02.md
```

包含：

- 技术领域分析
- 贡献者分析
- 风险评估和建议
- 具体文件引用
- 单提交摘要

## 自定义配置

### 修改时区

默认使用东八区（+8）。可以在手动触发时指定其他时区，或修改工作流中的默认值。

### 修改运行时间

修改工作流中的 cron 表达式：

```yaml
schedule:
  - cron: '0 0 * * *' # UTC 0点（东八区8点）
```

### 修改报告模板

编辑 `.claude/skills/git-changes-reporter/references/report-template.md`

## 故障排除

### 1. DEEPSEEK_API_KEY 错误

确保已在 GitHub Secrets 中正确设置 DeepSeek API Key。

### 2. 没有新提交

如果当天没有新提交，工作流会跳过 PR 创建。

### 3. PR 创建失败

检查是否有同名分支已存在。

### 4. 时间范围计算错误

检查系统时区设置，或手动指定时区偏移。

## 相关技能

- [git-changes-reporter](../.claude/skills/git-changes-reporter/SKILL.md)：生成结构化 Git 变更报告
- [recent-changes-digest](../.claude/skills/recent-changes-digest/SKILL.md)：生成变更摘要

## 技术支持

如有问题，请参考：

- [OpenCode GitHub Actions 文档](https://opencode.ai/docs/github)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
