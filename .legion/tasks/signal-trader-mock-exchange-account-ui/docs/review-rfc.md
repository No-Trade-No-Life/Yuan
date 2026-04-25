# RFC 审查报告

## 结论

PASS-WITH-NITS

本次版本已经把之前 4 个阻塞项基本关掉了：

- 主键冲突：已通过派生 `mock account_id` 收敛，对外 `QueryAccountInfo` / `AccountInfo` 都只认唯一 mock key，内部继续按 `runtime_id` 管理状态，边界清楚。
- transfer 与 mock money 边界：已明确 transfer-out 受 `free` clamp 保护，不再让 allocation sweep 直接把 mock money 拉到明显不自洽状态。
- paper-only 定价上下文：已收敛成 `setMockFillContext(runtime, { signal_id, product_id, entry_price?, reference_price? })` 这类最小输入，没有继续污染共享 `ExecutionAdapter` 契约。
- publisher registry 生命周期：已明确由 app 启动层单点维护，并覆盖 `start / upsert / disable / restart` 这些关键节点，方向是对的。

整体上，RFC 现在已经满足“可实现、可验证、可回滚”的最低门槛，可以进入实现。

## 阻塞问题

- [ ] 无

## 非阻塞建议

- 建议把 `registry.sync()` 的收敛语义再写死一句：以“当前启用的 paper runtime 集合”为准做全量对账，自动删除缺失 key，避免实现时退化成只增不减。
- `replayRuntime` 仍未单独点名。虽然文中已覆盖 worker/restart 类生命周期，但最好补一句：replay 不新增 registry key，只复用既有 `mock account_id` 并重新推送最新快照，避免实现时出现重复发布或静默失联。
- 独立前端走 `SignalTrader/GetMockAccountInfo(runtime_id)` 是更小的方案，这点没问题；但建议顺手写明“不接 `AccountInfo` 实时订阅，只做查询/刷新”，避免后续实现者顺手再铺一条订阅链路。
- fallback 到 `1` 已要求保留证据，建议把证据最小字段也固定下来，例如至少包含 `signal_id`、`product_id`、`price_source`、候选价格缺失原因，便于排障。

## 修复指导

进入实现前，只需补齐 3 个小口子即可：

1. 在 registry 小节补一条“`sync()` 采用全量对账、删除陈旧注册项”的明确约束。
2. 在生命周期或验证计划里补一条 `replayRuntime` 的预期行为。
3. 在独立前端小节补一条“只走查询，不做标准账户订阅复刻”。

补完后，这份 RFC 就足够干净，可以直接作为实现依据。
