# 实盘交易库 heavy RFC 设计

## 目标

为新 library 交付端到端可评审成果：在 heavy RFC 收敛基础上实现单一 core lib（无副作用）并完成测试、评审与 PR 文案。

## 要点

- 输入信号采用外部 push（0 平仓 / 1 做多 / -1 做空），支持异质来源（模型/人工/Agent）
- 仓位按 VC（风险资金）与历史最大浮亏比例计算，止损线与止盈线可参数化
- 投资者状态独立记录，不采用统一份额模式，支持随时加入
- 模块化 API 设计，核心能力可用 mock 交易所做单元测试
- 交易账户与资金账户分离，止盈后资金回流资金账户，保留最小基本手
- 设计与命名对齐 Yuan 现有库风格：snake_case 字段、`query*` 模式、`newError/scopeError` 错误风格
- 当前只交付单一 core lib：不在库内实现任何特定场景副作用（网络/数据库/消息/进程）

## 范围

- libraries/live-trading/\*\*
- libraries/live-trading/src/\*\*
- .legion/tasks/heavy-rfc/docs/task-brief.md
- .legion/tasks/heavy-rfc/docs/research.md
- .legion/tasks/heavy-rfc/docs/rfc.md
- .legion/tasks/heavy-rfc/docs/review-rfc.md
- .legion/tasks/heavy-rfc/docs/report-walkthrough.md
- .legion/tasks/heavy-rfc/docs/pr-body.md

## 阶段概览

1. **任务定义与边界收敛** - 2 个任务
2. **Heavy 研究与 RFC** - 2 个任务
3. **RFC 对抗审查** - 1 个任务
4. **RFC-only Draft PR 产物** - 1 个任务
5. **Core Lib 实现** - 1 个任务
6. **测试与验证** - 1 个任务
7. **代码与安全评审** - 2 个任务
8. **报告与 PR 产物** - 1 个任务

---

_创建于: 2026-03-05 | 最后更新: 2026-03-05_
