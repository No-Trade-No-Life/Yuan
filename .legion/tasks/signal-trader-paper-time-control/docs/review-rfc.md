# signal-trader-paper-time-control RFC 审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期: 2026-03-23
- 审查方式: 对抗性 RFC review

## 已关闭的 blocker

1. `paper-only` 隔离已明确到接口面：只有显式开启 `enablePaperClockServices` 的 paper bootstrap 才注册 clock services。
2. manager / worker 接线已收口为统一 `PaperClockController` + `this.now()`，budget/query/submit/replay/freshness gate 共用该时间源。
3. CLI 语义已从模糊的 `set` 收口为 `set-offset`，并明确这是“真实时间 + 偏移”，不是冻结时间。
4. 验证计划已增加“同一 manager 内 paper shifted / live real time”的检查，不再只做口头承诺。

## 保留的 nits

1. 当前仍有少量与业务时间无关的真实时间戳未统一成 paper clock，这属于后续一致性优化，而非 blocker。
2. 全局 offset 仍是单进程共享模型，若未来需要多个 paper runtime 独立时钟，需要另开任务升级。
