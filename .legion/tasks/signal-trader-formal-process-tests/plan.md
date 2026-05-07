# signal-trader-formal-process-tests

## 目标

补强 signal-trader 的正式流程测试用例，重点覆盖 VC 按天释放、daily allocation、paper/live 运行态与关键边界行为。

## 问题定义

- 现有测试已经覆盖不少核心语义，但仍偏“功能点回归”，对正式流程的连续性覆盖不够密。
- 用户明确要求多写一些正式流程用例，尤其是“正常的 VC 按天释放”等主路径。
- 如果这类流程不被固化成回归测试，后续 daily allocation、paper clock、observer transfer 与前端展示语义都容易再次漂移。

## 验收标准

- `libraries/signal-trader` 至少新增 1 组正式流程测试，覆盖：
  - 同一天重复 query 不会双重释放 VC
  - 多天推进后释放额度封顶在 `vc_budget`
- `apps/signal-trader` 至少新增 2 组正式流程测试，覆盖：
  - paper 不下单时按日拨资、同日不重复补资、到达 cap 后不再继续拨资
  - live observer 同 snapshot 不重复补资，跨新 snapshot 才按新日拨逻辑继续
- 所有新增测试都通过，并体现在 build 输出里。

## 假设

- 本轮只补测试，不改业务协议和运行态实现。
- 测试重点放在 library/app 两层；前端 E2E 不强制扩新断言，只确保现有主路径不被新用例影响。

## 约束

- 文档语言使用中文；代码默认 ASCII。
- Scope 限制在：
  - `.legion/tasks/signal-trader-formal-process-tests/**`
  - `libraries/signal-trader/**`
  - `apps/signal-trader/**`
  - `.legion/playbook.md`
- 不通过跳过测试、弱化断言或 mock 掉关键流程来“凑 coverage”。

## 风险分级

- **等级**：Low
- **标签**：`continue` `test` `formal-process`
- **理由**：本轮只增加测试，不改业务逻辑；主要风险是测试过于脆弱或假设不清，因此需要把验收边界写明。

## 要点

- 补正式流程，不补装饰性断言
- 优先覆盖按天释放、同日幂等、封顶、observer 周期行为
- 让测试成为 capital 语义的回归护栏

## 范围

- `.legion/tasks/signal-trader-formal-process-tests/**`
- `libraries/signal-trader/**`
- `apps/signal-trader/**`
- `.legion/playbook.md`

## Design Index

- capital 日拨任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/plan.md`
- 本任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/rfc.md`

## 最小实现边界

- 包含：新增 library/app 正式流程测试、build 验证、任务文档。
- 暂不包含：新的业务实现、前端新交互、测试框架重构。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-24 | 最后更新: 2026-03-24 16:25_
