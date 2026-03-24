# signal-trader-formal-process-tests 交付报告

## 目标与范围

- 目标：补强 `signal-trader` 正式流程测试，把 VC 按天释放、daily allocation、paper/live 运行态与关键边界行为固化为回归护栏。
- 绑定范围：`libraries/signal-trader/**`、`apps/signal-trader/**`、`.legion/playbook.md`。
- 本轮实际交付聚焦测试资产与交付文档，不涉及业务协议或运行态实现改造。

## 设计摘要

- 设计依据见 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/rfc.md`。
- 核心思路是优先断言资金语义，而不是只校验事件条数或 mock 后的局部行为。
- library 层重点锁定 `VC` 的按天释放、同日幂等与 `vc_budget` 封顶；app 层重点锁定 paper/live 的 daily allocation 与 observer snapshot 节奏。
- RFC 审查结论为 `PASS-WITH-NITS`，认为测试矩阵已覆盖 formal process 主线，范围控制合理：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/review-rfc.md`。

## 改动清单

### `libraries/signal-trader/**`

- 新增 formal-process 测试，覆盖同一天重复 query 不会双重释放 VC。
- 新增多天推进场景，验证释放额度最终封顶在 `vc_budget`。
- 保持既有 formal reference evidence / internal netting 主路径回归能力不被削弱。

### `apps/signal-trader/**`

- 新增 paper 运行态测试，覆盖不下单时按日拨资、同日不重复补资、达到 cap 后停止继续拨资。
- 新增 live observer 测试，覆盖同一 snapshot 不重复补资，只有跨天且出现新 snapshot 时才继续按日拨资。
- 延续真实主调用链验证方式，避免通过把 observer / transfer / balance 主链 mock 空来获得表面 coverage。

### `.legion/playbook.md`

- 本次交付未见需要同步修改的流程约束；scope 保持受控，文档产物集中在任务 docs 目录。

## 如何验证

- 详细结果见测试报告：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/test-report.md`。
- 在 `libraries/signal-trader` 执行 `npm run build`，预期通过；Jest `27/27` 通过，新增 library formal-process 用例通过。
- 在 `apps/signal-trader` 执行 `npm run build`，预期通过；Jest `51/51` 通过，新增 paper/live formal-process 用例通过。
- 在仓库根目录执行 `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`，预期 targeted Rush build 成功。
- 当前 warning 主要来自工具链/环境提示，不是新增 formal-process 用例引入的问题。

## 风险与回滚

- 风险等级整体为 Low：本轮只补测试，不改生产逻辑。
- 主要风险是 app/live 用例仍有一部分依赖 fake timers 与轮询推进，后续若轮询节奏调整，测试需要同步维护。
- 安全视角未发现新的写接口或权限放松，observer / transfer / balance 主链仍在真实调用路径上被验证：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/review-security.md`。
- 如需回滚，应仅回退新增测试资产，不回退业务代码；优先保留已证明有效的 formal-process 护栏。

## 未决项与下一步

- 可选增强 1：补更多 audit/trace 字段级断言，进一步锁定 formal process 的可观测语义：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/docs/review-code.md`。
- 可选增强 2：若后续 live 轮询机制调整，同步整理测试推进方式，降低节奏耦合。
- 本轮交付已满足 plan 中对 library 与 app 两侧正式流程测试补强的验收方向：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-process-tests/plan.md`。
