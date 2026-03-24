# Summary

- 为 `signal-trader` 的 paper/mock 路径补齐最小 `IAccountInfo` 账本，mock 成交价不再固定为 `1`，优先使用提交信号中的 `entry_price`，并保留 `reference_price` 与最近价 fallback。
- 新增 app 层 mock account 发布链路：按派生 `mock account_id` 注册标准 `QueryAccountInfo` / `AccountInfo`，同时提供 `SignalTrader/GetMockAccountInfo(runtime_id)` 供独立前端读取。
- `ui/signal-trader-web` 新增 mock account card，在 `paper + paper_simulated` runtime 下展示账户摘要、持仓明细、原始 `runtime.account_id` 与派生 `mock account_id`。
- 已将 mock account 复用约定沉淀到 `/.legion/playbook.md`：前端优先复用标准 `AccountInfo`，并统一使用派生 `mock account_id` 与显式读门禁。
- 边界保持在 mock-only：不改 live 账户协议、不新增数据库 schema、不把 mock 账本上推到 `libraries/signal-trader` domain。

# Testing

- 详情见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/test-report.md`
- PASS：`apps/signal-trader` / `ui/signal-trader-web` TypeScript `--noEmit`
- PASS：`apps/signal-trader` `heft test --clean`，57/57 用例通过，覆盖 mock 盈利 +10、fallback 定价、transfer free clamp、runtime account_id 变更、标准 mock 读面注册/清理与匿名关闭负向测试
- PASS：`ui/signal-trader-web` `npm run build`
- PASS：Playwright `tests/signal-trader.spec.ts --grep @mock`，验证 mock runtime 下的 account card 展示

# Risk/Notes

- 代码评审结论：`PASS`，见 `./.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-code.md`
- 安全评审结论：`PASS`，见 `./.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-security.md`
- 已补匿名读关闭时不注册标准 mock 读面的负向回归测试；当前标准 mock 读面仅在 `allowAnonymousRead === true` 时注册。
- 若未来要支持 authenticated-only 标准读面，需要补齐与 `authorizeRead` 一致的细粒度授权模型。
- 回滚可直接移除 paper ledger、publisher registry、`SignalTrader/GetMockAccountInfo` 与独立前端 mock account card；不涉及数据迁移。

# Links

- Plan：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/plan.md`
- RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/rfc.md`
- RFC Review：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-rfc.md`
- Walkthrough：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/report-walkthrough.md`
- Playbook：`/Users/c1/Work/signal-trader/.legion/playbook.md`
