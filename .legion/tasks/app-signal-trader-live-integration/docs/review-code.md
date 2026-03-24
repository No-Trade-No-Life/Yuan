# 代码审查报告

## 结论

PASS

## 阻塞问题

- [ ] (none)

## 建议（非阻塞）

- `apps/signal-trader/dev/dummy-live-backend.js:189` - `SubmitOrder` / `CancelOrder` 先写 `state.json`，再写 SQL `"order"`，最后才 append `requests.ndjson`。因此一旦 SQL 证据链暂时不可用，请求可能已经到达 dummy backend，但 `requests.ndjson` 不会留下记录；这会让“文件是否落单”与“SQL 是否健康”耦合在一起，联调时容易误判成请求根本没发出去。
- `apps/signal-trader/dev/dummy-live-backend.js:209` - `CancelOrder` 对未知 `order_id` 也会伪造一条订单并返回成功，最终写出一条 `CANCELLED` 历史。这会掩盖 signal-trader 是否真的使用了先前 submit 返回的 external id，作为“请求流验证桩”有一定误导性。
- `apps/signal-trader/README.md:180` - 文档已说明 dummy backend 只提供最小 `VEX/ListCredentials` marker 以通过 route proof，这一点是正确的；但建议再明确一句“它不验证真实 credential 语义，只验证当前默认 route proof + account-bound 服务发现契约”，避免读者把它当成更强的 VEX 仿真。

## 修复指导

1. 保持当前 route proof 设计不变即可：`dummy-live-backend` 已同时暴露 `VEX/ListCredentials` 与带 `account_id.const` 的 `SubmitOrder` / `CancelOrder` / `QueryPendingOrders` / `QueryAccountInfo`，能满足默认 `resolveVerifiedAccountBoundTargets(...)` 与持久化 route proof 的最小契约。
2. 若希望“请求确实落文件”更稳妥，可把 `appendRequestLog(...)` 提前到 mutating handler 的成功接收点，或在 SQL 失败分支单独追加一条 `failed_to_persist_order_history` 记录，避免文件日志完全依赖 SQL 成功。
3. 若希望 dummy 栈更适合抓 cancel 回归，可让 `CancelOrder` 在未知 `order_id` 时返回显式错误，或至少把响应里标注 `synthetic_cancel=true`，避免把错误 external id 误看成通过。
4. README / GUIDE 可补一句：dummy live compose 的目标是验证当前默认 account-bound 路由、请求载荷与文件落单，不覆盖真实 VEX credential/register 语义。

[Handoff]
summary:

- 已复审当前最新 `apps/signal-trader/**` 中 dummy live 相关改动，并覆盖写入 review-code.md。
- 结论 PASS：dummy backend 已最小满足当前默认 route proof 与 account-bound 服务发现契约。
- 已确认 `SubmitOrder` / `CancelOrder` 在健康路径下会写 `${DUMMY_LIVE_OUTPUT_DIR}/requests.ndjson`，同时维护 `state.json` 与 SQL `"order"`。
- 识别到 2 个非阻塞陷阱：文件日志依赖 SQL 成功、未知 cancel 会被当作成功处理。
  decisions:
- (none)
  risks:
- SQL `"order"` 暂时不可用时，mutating 请求可能已到达 backend，但 `requests.ndjson` 不会留痕。
- dummy backend 会接受未知 `order_id` 的撤单，可能掩盖 external id 路由错误。
  files_touched:
- path: /Users/c1/Work/signal-trader/.legion/tasks/app-signal-trader-live-integration/docs/review-code.md
  commands:
- (none)
  next:
- 如需把 dummy 栈变成更严格的回归桩，优先收紧未知 cancel 行为，并让请求日志与 SQL 持久化解耦。
  open_questions:
- (none)
