# signal-trader-paper-time-control 代码审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-23

## 关键结论

1. paper-only clock 与 live 主路径隔离基本成立：`PaperClockController.now(executionMode)` 只对 paper 叠加 offset，live 继续走真实时钟。
2. manager / worker / queryProjection / submitSignal 现在挂在同一个 `PaperClockController` 上，运行中的 paper 业务时间源已经统一。
3. service / CLI 语义清楚：`Get/Advance/SetOffset/Reset` 覆盖了本地联调最小需要，且脚本能直接给人类使用。

## Nits

1. `queryEventStream` 虽已复用 paper clock 取时，但事件流本身当前并不依赖时间过滤；后续若扩展时间相关 query，应继续保持这条一致性约束。
2. 纸面附属记录（如 paper adapter 某些辅助时间戳）仍有少量真实时钟使用，当前不影响核心预算/投影，但以后可继续统一。
3. CLI 当前控制的是“单进程全局 paper clock”，不是 runtime 级时钟；文档和命名已说明，但后续若场景变复杂仍需升级设计。
