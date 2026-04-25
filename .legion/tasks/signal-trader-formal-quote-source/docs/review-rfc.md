# signal-trader-formal-quote-source RFC 审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期: 2026-03-23
- 审查方式: 对抗性 RFC review（两轮）

## 已关闭的 blocker

1. **正式价格源伪造入口**
   - RFC 已明确：service 不信任外部 `reference_price*`，worker 会清洗外部 submit payload，再由 quote provider 覆盖正式价格证据。
2. **latest-wins 隐式 datasource 仲裁**
   - RFC 已禁止隐式 latest-wins；未配置 datasource 且存在多 datasource 时，改为 fail-close `QUOTE_AMBIGUOUS_DATASOURCE`。
3. **app/core 边界过宽**
   - 已明确 `RuntimeManager` 只传依赖，`RuntimeWorker` 是唯一执行点，core 继续不触 SQL。
4. **幂等冲突**
   - 已明确 `reference_price*` 不进入 idempotency fingerprint，同一 `signal_id` 重试不会因为 quote 时间戳变化被误判冲突。
5. **quote 缺失静默失败**
   - 已把 runtime audit log 可观测性写成硬要求，至少记录 `runtime_id`、`signal_id`、`product_id`、`reason`。

## 保留的 nits

1. `QuoteProvider` 接口在 RFC 中需要继续与实现保持一致：建议固定返回 `{ evidence } | { reason }` 结构，避免后续又退回 `undefined` 语义。
2. 首版仍然不做 quote freshness gate；这是有意收 scope 的结果，不是遗漏。

## 审查摘要

- 当前 RFC 已达到可编码状态，可以进入实现阶段。
- 实现时优先保证三件事：
  - 正式价格证据只能来自 quote provider
  - datasource 歧义必须 fail-close
  - quote 缺失必须留下审计痕迹
