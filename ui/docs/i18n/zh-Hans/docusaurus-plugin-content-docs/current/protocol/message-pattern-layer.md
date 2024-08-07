---
sidebar_position: 3
---

# 消息模式层

总的来说，我们希望终端之间有序地、礼貌地进行交互，因此在划分职责的时候，目标是**最小化整个主机内的总沟通成本**。

有两种类型的消息模式：客户端/服务器和发布者/订阅者。

1. 客户端/服务器模式: 客户端向服务器发送请求，服务器向客户端发送响应。
2. 发布/订阅模式：发布者向订阅者推送消息。

## 客户端/服务器模式

我们使用这种模式来实现请求/响应服务。

客户端向服务器发送请求，服务器向客户端发送响应。
客户端和服务器是同一主机中的两个终端。
请求和响应是终端消息。

服务由方法名称标识。

核心过程是：

1. 定义一个方法来标识请求和响应的格式和行为。
1. 服务器应在终端信息中声明它提供该服务。
1. 客户端应发现服务器并向服务器发送请求。
1. 服务器应处理请求并向客户端发送响应。

更多细节：

- 服务器可以在发送响应之前发送多条消息。
- 会话是从请求到响应的过程，由消息中的 `trace_id` 字段标识。
- 服务器应声明它支持的方法。鉴别器是方法名称和 JSON Schema。
- 客户端应在发送请求之前检查服务器是否支持该方法并通过 JSON Schema 验证请求。
- 如果存在多个有效候选服务器，客户端应选择一个服务器发送请求。建议使用负载均衡算法选择服务器。
- 服务器应在收到请求后 30 秒内发送第一条消息。如果服务器在 30 秒内未发送响应，客户端应抛出超时错误。
- 服务器在发送响应后不应继续向客户端发送消息。如果有，客户端应忽略它们。

如何使用此模式：

**服务器侧**：

```ts
terminal.provideService(
  'SubmitOrder',
  {
    type: 'object',
    properties: {
      account_id: { const: 'MyAccountId' },
    },
  },
  (msg) => {
    // 返回一个 RxJS Observable / Promise / AsyncIterable / Iterable
  },
);
```

**客户端侧**：

```ts
// message$ 是由服务器返回的消息流 (AsyncIterable)
const message$ = terminal.requestService('SubmitOrder', {
  account_id: 'MyAccountId',
  // ... 其他字段省略
});
```

## 发布/订阅模式

我们使用这种模式来实现实时消息推送。

订阅者订阅某些通道，然后发布者需要实时向订阅者推送消息。
订阅者和发布者是同一主机中的两个终端。
同一主机中有很多发布者和订阅者。

订阅是一个三元关系：（`channel_id`，`provider_terminal_id`，`consumer_terminal_id`）。

通道由一个字符串 `channel_id` 标识，其格式由业务层定义。
例如，`"AccountInfo/Some-Account-ID"` 用于传输实时账户信息。

核心过程是：

1. 定义一个通道来标识通道及其载荷消息。
1. 发布者应在终端信息中声明它提供通道的数据。
1. 订阅者应在终端信息中声明它从发布者订阅通道。
1. 发布者应发现订阅者并向订阅者发送载荷消息。

更多详细规则：

- 订阅者应在订阅之前检查发布者是否支持通道。
- 发布者应收集所有订阅通道的订阅者并向他们发送消息。
- 发布者应在订阅者离线后停止向订阅者发送消息。
- 如果存在多个有效候选发布者，订阅者应决定订阅哪个发布者。建议使用负载均衡算法选择发布者。
- 如果从多个发布者订阅相同的通道，订阅者应处理冲突。
- 发布者应自行向所有订阅者多播消息。
- 如果难以枚举所有通道，发布者可以定义匹配模式来匹配通道。
- 如果当前发布者在 60 秒内未发送消息，订阅者应切换到另一个候选发布者。

如何使用此模式：

**发布者端**：

```ts
terminal.provideChannel<IAccountInfo>({ const: 'AccountInfo/MyAccountID' }, () => {
  // 返回一个 RxJS Observable / Promise / AsyncIterable / Iterable
});
```

**订阅者端**：

```ts
const message$ = terminal.consumeChannel<IAccountInfo>('AccountInfo/MyAccountID');
```

1. `message$` 是一个异步消息流，是一个 AsyncIterable 对象。您可以消费它以接收载荷消息。
2. 订阅者根据需要订阅的 `channel_id` 匹配候选发布者。
3. 订阅者选择一个发布者并声明订阅。如果存在多个发布者，通过负载均衡选择其中一个。
4. 发布者根据订阅关系，向订阅者发送载荷消息。
5. 订阅者取消订阅时，应当及时删除订阅的声明。
6. 如果当前发布者在 60 秒内未发送消息，则切换到另一个候选发布者。

**定义匹配模式**

如果难以枚举所有通道，发布者可以定义匹配正则表达式字符串来匹配通道。

唯一的区别是发布者应声明匹配模式而不是常量 `channel_id`。

```ts
// JSON Schema
terminal.provideChannel(
  {
    pattern: '^Period/Y/',
  },
  (channel_id) => {
    // 返回一个 RxJS Observable / Promise / AsyncIterable / Iterable
  },
);
```
