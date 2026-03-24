# signal-trader-formal-quote-source 安全审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-23

## 关键结论

1. datasource 歧义污染问题已基本收敛：未显式指定 `datasource_id` 且出现多来源时直接 fail-close，不再 latest-wins 混真相。
2. 外部无法直接伪造正式价格证据：worker 会先清洗外部 `reference_price*`，而 core 又要求 `reference_price/source/datasource_id/updated_at` 全量满足才允许 internal netting。
3. quote 缺失不会再静默回退到 `entry_price`：formal evidence 不完整时不会生成 `MidPriceCaptured` / `InternalNettingSettled`，并留下 runtime audit log。
4. 本次改动没有引入新的高风险写路径；新增面主要是按 `product_id`/`datasource_id` 的只读 SQL quote 查询。

## Nits

1. 仍然没有 freshness/staleness gate；旧但合法的 quote 仍可能成为正式证据。
2. quote miss 的可观测性目前主要落在 audit log，尚未提升为 health/metric/submit response 级信号。
3. 如果部署侧未来允许更多 quote datasource 配置方式，仍需继续收口 datasource allowlist / venue 绑定策略。
