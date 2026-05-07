# signal-trader-daily-burn-budget RFC 审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期: 2026-03-22
- 审查方式: 对抗性 RFC review（两轮）

## 已关闭的 blocker

1. **预算模型自洽性**
   - 已将 `effective_vc_budget` 收口为 `sizing_vc_budget = max(released_vc_total, current_reserved_vc)`。
   - 对 `over-reserved` 状态已明确策略：允许维持现状、不允许继续扩张、`available_vc = 0`。
2. **replay / query / dispatch 闭环**
   - RFC 已明确预算补算属于 projection cache refresh，而不是新增 domain event；同一 `events + clock_ms` 下结果必须一致。
3. **`SubscriptionUpdated` 边界**
   - 已补上配置变更语义：先 lazy-evaluate 到 `effective_at`，保留已释放总额并 clamp 到新 `vc_budget`，只有新建 subscription 才发首日 tranche。
4. **paper / live 时钟分叉**
   - 已明确单次请求/单次 worker 执行只采样一次 `now_ms`，并在 query / dispatch / reconcile 全链路复用。

## 保留的 nits

1. 实现时需锁死一条额外规则：query 可以刷新内存视图，但不得单独把 budget refresh 落成新的真相写路径。
2. `sizing_vc_budget`、`released_vc_total` 与 `available_vc` 的 helper 命名在代码里要足够直白，避免后续维护时重新混淆。

## 审查摘要

- 当前 RFC 已达到可编码状态，可以进入实现阶段。
- 实现时优先保证三件事：
  - budget helper 在 core 中单点实现
  - `dispatch` / `query` / `reconcile` 入口都先做同口径 budget refresh
  - app 层任何一次调用都只采样一次 `now_ms`
