# alert-receiver 修复 resolve/repeat 加急与去重（详细设计）

## 1. 背景与问题定义

`alert-receiver` 的通知链路是：Prometheus firing 快照 → 写 `alert_record` → notifier 读取未 finalized 记录聚合告警组 → 按 `alert_receive_route` 渲染飞书卡片并发送/更新。

当前线上观察到 3 类错误行为（均会导致群聊噪音/误提醒）：

1. **resolve 信息也被加急**：告警已恢复（Resolved）仍触发紧急电话/SMS/App 加急，这是语义错误。
2. **resolve 信息重复发送**：同一条告警组在 resolve 时不应该发新 message，而应对“首次 firing 产生的那条 message”做 Update；但实际会出现多条“已解决”卡片。
3. **repeat 信息重复发送**：repeat 的本意是“更新卡片 + 可能再次加急”，不应重复 SendMessage；实际会反复发新 message。

## 2. 术语与不变量

### 2.1 术语

- **告警实例（alert）**：`alert_record` 的一行（主键 `id` = fingerprint）。
- **告警组（group）**：按 `group_name`/`group_key` 聚合的一组 alerts（notifier 的工作单元）。
- **路由（route）**：`alert_receive_route` 中的一条配置（按 `label_schema` 过滤后决定是否向某 chat 发送）。
- **消息绑定（message binding）**：`message_ids` 中的 `{ route_id(chat_id), message_id }`，用于将“某告警实例/组”绑定到“某群聊里的一条飞书消息”。
- **加急（urgent）**：飞书对消息的额外“紧急触达”能力（app/sms/phone），不是消息发送本身的一部分。

### 2.2 必须满足的不变量（设计约束）

1. **每个 (group_key, chat_id) 在同一生命周期内最多只有 1 条飞书消息**：后续状态变化/重复提醒只能 `UpdateMessage`。
2. **Resolved 语义永不加急**：Resolved/已恢复只做信息同步，不触达“紧急渠道”。
3. **urgent 必须是 best-effort**：无论 urgent 触发成功与否，都不应让“消息发送/更新”失败；否则会破坏 (1) 并引发重复 SendMessage。
4. **message_id 必须可持久化并可恢复**：服务重启后，应尽可能通过 DB 中的 `message_ids` 继续 Update，而不是重新 Send。

## 3. 现状实现速览（便于 review 对齐）

关键实现文件：

- `apps/alert-receiver/src/pipelines/prometheus-alert.ts`：对账写 `alert_record` 的 firing/resolved。
- `apps/alert-receiver/src/pipelines/notifier.ts`：
  - 周期查询 `finalized=false` 的 `alert_record`
  - 聚合成 group
  - 对每个 group×route 渲染卡片并 `Feishu/SendMessage` 或 `Feishu/UpdateMessage`
  - 写回 `message_ids`
  - 对仍未终态的 group 用定时器 repeat（实现 repeat 通知语义）
- `apps/feishu-notifier/src/api.ts`：`FeishuClient.sendMessage/updateMessage`，其中 urgent 通过额外 PATCH endpoint 触发。

当前导致“重复发送”的关键风险点：

- `FeishuClient.sendMessage` 在触发 urgent 失败时会 `throw`，但消息本体**可能已经发送成功**并返回了 `message_id`。
- notifier 捕获错误后不会写回 `message_ids`，下一轮会把该 route 视为“无历史 message”，从而再次 `SendMessage` → 形成重复消息（resolve/repeat/firing 都可能触发）。

## 4. 目标行为（按场景定义，可直接对照写代码）

### 4.1 firing（首次出现）

- 若 DB 中已存在该 route 的 `message_id`：执行 `UpdateMessage`（幂等更新）。
- 否则：执行 `SendMessage`，并**无论 urgent 成功与否**都要拿到 `message_id` 并写回 DB。
- urgent 触发条件：group 非 Resolved 且 severity 达到 route 配置阈值，且未命中冷却。

### 4.2 repeat（周期性重复提醒）

- 必须走 `UpdateMessage`（不发新消息）。
- urgent 行为：在冷却允许时可“再次加急”（本质上就是对同一 `message_id` 再次触发 urgent PATCH）。

### 4.3 resolve（全部恢复）

- 必须走 `UpdateMessage`（不发新消息）。
- **绝不加急**（无论 severity 如何）。

> 待确认的边界：如果 resolve 时 DB 中不存在 `message_id`（极端情况），是否允许补发 1 条“已解决”消息？
>
> - 推荐默认：不补发，只记录日志（避免 resolved 反向制造噪音）。
> - 但为了“状态可见性”，也可以选择补发 1 条（仍然不加急）。
> - 本任务优先解决“重复发送/重复加急”，该策略需要你最终拍板。

## 5. 详细设计（可直接按此落代码）

### 5.1 urgent 判定函数（纯函数，可测）

新增纯函数（建议单独文件）：

```ts
computeWantedUrgentPayload(route, group) => { urgent, userIds } | undefined
```

规则：

1. `group.status === 'Resolved'` → `undefined`
2. `route.urgent_user_list` 为空 → `undefined`
3. `group.severity` 不在已知列表 → `undefined`
4. `group.severity` 严重程度“高于或等于” `route.urgent_on_severity` → 返回 payload，否则 `undefined`

### 5.2 urgent 冷却（限频，避免 repeat 频繁打扰）

沿用现有内存 Map（不改 DB）：

- `URGENT_MIN_INTERVAL_MS = env ALERT_URGENT_MIN_INTERVAL_MS || 10min`
- key：`${group_key}::${chat_id}`
- 行为：距离上次加急不足 `URGENT_MIN_INTERVAL_MS` 则本轮不带 urgent。

### 5.3 notifier 的 send/update 主流程（伪代码）

位置：`apps/alert-receiver/src/pipelines/notifier.ts` 的 `sendOrUpdateMessage`。

```ts
existingMessageId = messageIndex.get(route.chat_id)

wanted = computeWantedUrgentPayload(route, routeGroup)
urgentPayload = wanted && allowUrgentForGroupRoute(routeGroup.group_key, route.chat_id, now)
  ? wanted
  : undefined

payload = existingMessageId
  ? { msg_type:'interactive', content: card, message_id: existingMessageId, ...(urgentPayload?) }
  : { msg_type:'interactive', content: card, receive_id: chat_id, receive_id_type:'chat_id', ...(urgentPayload?) }

serviceName = existingMessageId ? 'Feishu/UpdateMessage' : 'Feishu/SendMessage'
result = requestForResponse(serviceName, payload)

if result.code !== 0 => throw（notifier 层记录错误即可，不应写回错误数据）

messageId = result.data?.message_id ?? existingMessageId
if messageId => messageIndex.set(route.chat_id, messageId)

if urgentPayload => lastUrgentAtByGroupRoute.set(key, now)
```

关键点：

- urgent 决策发生在 notifier；真正触发 urgent 的细节在 feishu-notifier 内部完成。
- 只要 `SendMessage/UpdateMessage` 本体成功，就必须能得到稳定的 `message_id`（见 5.4）。

### 5.4 feishu-notifier：SendMessage 的 urgent 失败必须非致命

位置：`apps/feishu-notifier/src/api.ts` 的 `FeishuClient.sendMessage`。

修改点：

- 发送消息本体成功后拿到 `message_id`，立刻作为返回值的基础。
- urgent PATCH 对每个 userId 单独 try/catch：
  - 失败：`console.error('Feishu/UrgentError', urgent, messageId, userId, err)`，但不 throw
  - 继续处理剩余 userId
- 若 urgent 指定但 `urgent_user_list` 缺失/为空：记录错误并直接返回 `message_id`（不 throw）

这样 notifier 才能稳定写回 `message_ids`，从根源上消除“send 成功但由于 urgent 抛错导致 message_id 丢失”的重复发送。

## 6. 测试设计（最小但覆盖关键回归）

### 6.1 单测：Resolved 不加急

- 输入：`group.status='Resolved'`、severity 任意
- 断言：`computeWantedUrgentPayload(...) === undefined`

### 6.2 单测：urgent 失败不影响 sendMessage 返回

- mock `globalThis.fetch`：
  - 第一次（SendMessage endpoint）返回 `{ code:0, data:{ message_id:'m1' } }`
  - 第二次（urgent endpoint）返回 `{ code:1 }`
- 断言：`sendMessage(...)` resolve `{ message_id:'m1' }`，不 reject

> 若你希望更强的回归覆盖，可以加 1 个 notifier 级别的测试（mock Terminal client）验证：当 SendMessage 的 urgent 失败时，notifier 仍会写回 DB 并在下一轮使用 UpdateMessage 而不是 SendMessage。

## 7. 发布/回滚策略

- 发布风险低：不改 DB schema，不改对外接口，只改变“Resolved 的加急条件”和“urgent 失败的异常传播方式”。
- 可观测性：关注日志 `Feishu/UrgentError` 与 notifier 的 `SendOrUpdateMessageFailed`，确认不再出现“同组重复 SendMessage”。
- 回滚：如发现 urgent 失败后不应吞掉（业务要求强一致），可回滚 sendMessage 的 try/catch；但必须同时补偿“message_id 写回机制”，否则会回到重复发送问题。

## 8. Review 清单（你可以照此逐条打勾）

- [ ] Resolved 组永不携带 urgent 参数（包括 UpdateMessage）
- [ ] repeat 只触发 UpdateMessage（不再出现重复 SendMessage）
- [ ] SendMessage 成功但 urgent 失败时，仍能写回 `message_id`，下一轮必走 UpdateMessage
- [ ] 日志中 urgent 失败只出现 `Feishu/UrgentError`，不再导致 notifier 报 `SendOrUpdateMessageFailed`

---

_创建于: 2025-12-21 | 最后更新: 2025-12-21_
