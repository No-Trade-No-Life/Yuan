# signal-trader-formal-quote-source 代码审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-23

## 关键结论

1. app/core 边界合理：`bootstrap-from-env` 负责 SQL `QUOTE` 读取，core 只消费注入后的 formal evidence，不再直接依赖 `entry_price` 作为 netting 真相。
2. 外部正式价格伪造入口已被挡住：`RuntimeWorker` 会先清洗外部 `submit_signal`，再由 quote provider 覆盖 `reference_price*`。
3. datasource 歧义与 quote 缺失路径可控：未指定 datasource 且出现多来源时 fail-close，不再偷偷 latest-wins 或回退到 `entry_price`。
4. idempotency 已收口：`reference_price*` 不进入 command fingerprint，同一 `signal_id` 不会因为 quote 时间戳变化被误判为冲突。

## Nits

1. `SubmitSignalCommand` 仍公开暴露 `reference_price*`，虽然运行时会忽略外部值，但类型边界还不够干净；后续可考虑拆外部 DTO 与内部 enriched command。
2. 当前 formal evidence 仍要求 provider 把完整 `datasource_id / quote_updated_at` 显式注入；这让边界清楚，但也意味着后续如接更多价格源，需要再抽统一 helper。
3. `@yuants/app-signal-trader` 的 Jest worker 未优雅退出 warning 仍在，说明测试 teardown 还有尾巴，但不阻断本次交付。
