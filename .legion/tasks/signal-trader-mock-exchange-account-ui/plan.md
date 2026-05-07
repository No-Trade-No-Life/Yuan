# signal-trader-mock-exchange-account-ui

## 目标

在 signal-trader mock exchange 中实现最小仓位/账户管理、订单任意成交后的账户净值更新，并同步主前端与独立前端展示账户状况。

## 问题定义

- 当前 `PaperExecutionAdapter` 只模拟“订单 accepted + 立刻 filled”，但成交价被硬编码为 `1`，也不会维护真实 mock `IAccountInfo`/持仓账本。
- 结果是 mock 路径虽然能走完 signal-trader 的事件与 effect 闭环，但用户既不能用不同价格验证盈亏，也无法在前端直接看到 mock 账户余额、权益和持仓变化。
- 用户明确希望 mock 成交价格可控，并且账户语义至少满足 `IAccountInfo` 的最小闭环：例如 10 买入、20 卖出 1 volume 后，账户净值应增加 10。
- 本轮继续发现两个追加缺口：
  - `signal=0` 平仓后，mock 账户账本已经清仓，但 `QueryProjection(product)` 的 `current_net_qty` 可能停在旧值，说明 close attribution / fill 回流仍有分叉点。
  - `profit_target_value` 目前只是 advisory alert；用户要求命中目标后立刻平仓，并把该 profile 视为完成退出，终结后续交易生命周期。

## 验收标准

- mock 下单不再固定按 `1` 成交；至少支持优先使用提交信号时的 `entry_price` 作为 mock fill price，并保留合理 fallback。
- mock runtime 能维护最小 `IAccountInfo` 账本：
  - 可查询 `balance` / `equity` / `profit` / `free` / `used`
  - 可展示当前持仓方向、volume、position_price、current_price、floating_profit
  - 平仓后已实现盈亏会计入账户余额/净值
- mock 账户状态会通过标准 `AccountInfo` 流发布，现有前端账户视图无需新增专用协议即可消费。
- 独立前端 `ui/signal-trader-web` 新增 mock account 读面，至少展示账户摘要与持仓明细。
- 至少补齐 app 测试与独立前端 mock 冒烟验证，覆盖“任意成交价 -> 账户净值变化”主链。
- `signal=0` 平仓后，domain product projection 与 mock 账户账本必须一致收敛到空仓，不允许再出现“账户已平、projection 未平”的分叉。
- `profit_target_value` 命中后，系统必须自动提交平仓，并在仓位真正归零后把 profile 生命周期标记为结束，不再接受后续交易信号。
- 生成并落盘：`docs/rfc.md`、`docs/review-rfc.md`、`docs/test-report.md`、`docs/review-code.md`、`report-walkthrough.md`、`pr-body.md`；若评审认为需要，再补 `docs/review-security.md`。

## 假设

- 这是 mock-only 能力，不追求和真实交易所逐笔结算完全一致；首版优先交付可解释、可联调的最小账户闭环。
- mock 账户状态先保存在进程内存中；重启后可重置，不在本轮引入新的持久化或 SQL schema。
- 现有 `queryTradingBalance` 继续服务于 paper capital allocation 语义，不直接等同于 mock `IAccountInfo.money.balance`。
- 主前端复用已有 `AccountInfo` 标准读面；本轮只为独立前端新增 signal-trader 专用 mock account 卡片。
- profile 生命周期终结优先落在现有 subscription/runtime 语义上，不在本轮新增独立 profile state machine。

## 约束

- 文档语言使用中文；代码默认 ASCII。
- Scope 限制在：
  - `.legion/tasks/signal-trader-mock-exchange-account-ui/**`
  - `apps/signal-trader/**`
  - `libraries/signal-trader/**`
  - `ui/signal-trader-web/**`
  - `.legion/playbook.md`
- 不改 live 路径的账户快照/observer 协议，不新增数据库表；允许在 `libraries/signal-trader` 内修复平仓 attribution 与维持 `profit_target_value` / forced-flat 语义所必需的 domain 行为。
- 独立前端继续沿用现有控制台风格与 `/request` 代理，不新增浏览器直连 host token 的路径。

## 风险分级

- **等级**：Medium
- **标签**：`continue` `mock` `capital` `ui` `lifecycle`
- **理由**：本轮不再只是 mock/UI；还要修 `signal=0` 的 domain attribution 分叉，并把 `profit_target_value` 从 advisory 升级成自动平仓 + 生命周期终结动作，涉及 core command/event、runtime orchestration 与回归测试，因此仍按 Medium 持续推进。

## 要点

- mock exchange 需要支持按成交更新 position/account，而不是只回报订单状态
- 账户变化要符合 IAccountInfo 语义，至少能体现余额、权益/净值与持仓影响
- 订单应允许任意成交价格，成交后账户变化需可解释，例如 10 买入后 20 卖出 1 手净值增加 10
- 同步更新 signal-trader 前端与独立前端，让 mock 账户状态可见并可联调验证

## 范围

- .legion/tasks/signal-trader-mock-exchange-account-ui/\*\*
- apps/signal-trader/\*\*
- ui/signal-trader-web/\*\*
- .legion/playbook.md

## Design Index

- mock 执行入口：`/Users/c1/Work/signal-trader/apps/signal-trader/src/execution/paper-execution-adapter.ts`
- runtime 编排：`/Users/c1/Work/signal-trader/apps/signal-trader/src/runtime/runtime-worker.ts`
- core dispatch/reducer：`/Users/c1/Work/signal-trader/libraries/signal-trader/src/engine/dispatch-command.ts` / `domain/reducer.ts`
- signal-trader 服务注册：`/Users/c1/Work/signal-trader/apps/signal-trader/src/services/signal-trader-services.ts`
- 独立前端主界面：`/Users/c1/Work/signal-trader/ui/signal-trader-web/src/app.tsx`
- 本任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/rfc.md`

## 最小实现边界

- 包含：mock fill price 可控、mock `IAccountInfo` 账本、标准 `AccountInfo` 发布、独立前端 mock account 卡片、`signal=0` 平仓 attribution 修复、`profit_target_value` 命中后的 auto-flat + 生命周期终结、相关测试与交付文档。
- 暂不包含：live 账户面统一、mock 账户持久化、复杂多币种/多账户撮合、完整保证金模型、交易所原生止盈委托簿管理、`ui/web` 新 signal-trader 专用页面。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-24 | 最后更新: 2026-03-24_
