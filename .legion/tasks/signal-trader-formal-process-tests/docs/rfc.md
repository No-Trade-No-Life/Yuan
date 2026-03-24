# RFC：signal-trader 正式流程测试补强

## 背景 / 问题

当前 signal-trader 已经实现了 daily allocation、paper/live transfer、formal quote source 等关键能力，但测试覆盖仍偏“功能点回归”，对正式流程的连续业务语义覆盖不够密。尤其是：

- `VC` 按天释放 / 封顶 / 同日幂等
- paper 不下单时的日拨资
- live observer 在同一 snapshot 与跨天新 snapshot 下的分配行为

如果这些流程不被固定成更正式的回归测试，后续业务语义很容易再次漂移。

## 目标

- 增加 library/app 两侧的正式流程测试，强化 daily allocation / observer / capital flow 语义的回归护栏。
- 用例尽量直接落在真实 `dispatchCommand` / `queryProjection` / `RuntimeManager` / `PaperExecutionAdapter` / `LiveExecutionAdapter` 路径上，而不是大量 mock 核心状态机。

## 非目标

- 不修改业务协议。
- 不新做前端交互。
- 不做测试框架重构。

## 测试矩阵

### Library

1. `VC` 按天释放：D0 / D1 / 多天封顶到 `vc_budget`
2. 同一天重复 query 不双释放
3. 现有 formal reference evidence / internal netting 正反路径继续保留

### App - Paper

1. 不下单时按日把固定 tranche 划入 `trading_account`
2. 同日重复 query 不重复补资
3. 达到 `vc_budget` 后不再继续日拨
4. 平仓后不 sweep 已分配本金

### App - Live

1. boot 后先完成首个 allocation，再允许后续正式流程继续
2. 同一 snapshot 不重复补资
3. 只有跨天 + 新 snapshot 才继续按日拨资
4. 既有 submit / observer transfer / mismatch 等正式流程用例继续保持

## 设计原则

- 优先断言资本语义（`released_vc_total` / `funding_account` / `trading_account` / `available_vc`），其次才是事件条数。
- 能用 fake timers 的场景优先用 fake timers，减少对真实 `setTimeout` 的依赖。
- 对 live formal-process 测试允许保留最小手写 stub，但不能把 observer / transfer / balance 主链完全 mock 空。

## 风险

- 测试更强后，未来改语义时会更容易撞测试，需要接受这正是目标的一部分。
- 少数 app 层用例仍依赖轮询节奏，后续若轮询策略再改，需要同步维护测试。

## 验证计划

- `npm run build`（`libraries/signal-trader`）
- `npm run build`（`apps/signal-trader`）
- `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`

## 回滚

- 若测试过于脆弱，只回退新增测试，不回退业务代码。
- 回退时保留那些已经证明有效的 formal process 用例，避免把护栏全拆掉。
