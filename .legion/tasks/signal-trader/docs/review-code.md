# 代码审查报告

## 结论

PASS

## 阻塞问题

- [ ] (none)

## 建议（非阻塞）

- `libraries/signal-trader/src/engine/query-event-stream.ts:11-13,22` - `order_id` 查询仍然只匹配 payload 直字段，无法通过 attribution 关联更复杂事件；如果这是有意收敛，建议在注释或文档里明确边界。
- `libraries/signal-trader/src/engine/dispatch-command.ts:405-407` - 非新增风险且未带 `entry_price/stop_loss_price` 时仍然静默跳过，长期建议补显式审计结论，方便解释某些订阅为何只记录 `SignalReceived`。
- `libraries/signal-trader/src/index.test.ts:446-504` - 已补上多活跃订单的关键回归测试，主风险面已经覆盖；后续可再增加“保留一张单并 modify，其余 cancel”的非零 `desired_delta` 场景，进一步巩固补偿算法。

## 修复指导

1. 本轮重点复核的“多活跃订单补偿”问题已修复：
   - 现在先按 `product_id` 聚合受影响活跃订单；
   - `desired_delta === 0` 时会取消该产品下全部活跃订单；
   - `desired_delta !== 0` 时只保留一张 keeper 订单做 `modify_order`，其余订单统一 `cancel_order`，避免重复套用同一个目标 delta。
2. 回归测试也已补到位：`index.test.ts:446-504` 明确覆盖了同产品多张活跃订单在暂停订阅后需要全部取消的场景。
3. 目前未发现新的 blocking；可以进入后续交付流程。

[Handoff]
summary:

- 本轮最终复审结论为 PASS。
- 已确认多活跃订单补偿问题修复完成，当前未发现 blocking。
- 报告已覆盖写入指定 review 文档。
  decisions:
- (none)
  risks:
- `queryEventStream` 的查询边界仍偏保守，后续若被当成完整审计检索接口使用，需补文档说明。
  files_touched:
- path: /Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/review-code.md
  commands:
- (none)
  next:
- 可进入交付或 PR 阶段；若继续增强，可补非零 desired delta 的多订单补偿测试。
  open_questions:
- (none)
