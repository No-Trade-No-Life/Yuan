# 提供账户信息

对接交易所时，供应商需要将在交易所开立的账户，转换成 Yuan 的标准[账户信息](../basics/what-is-account.md)。

```ts
import { Terminal, provideAccountInfo } from '@vendor/protocol';
import { combineLatest, defer, map, shareReplay } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

// 假设供应商的名字为 VENDOR_NAME，用户 ID 为 USER_ID，AccountId 要求全局唯一
const ACCOUNT_ID = `${VENDOR_NAME}/${USER_ID}`;

// 创建一个 Observable，用于提供账户信息
const accountInfo$ = combineLatest([
  defer(() => Api.getAccountWallet()), // 获取账户钱包余额
  defer(() => Api.getAccountPositions()), // 获取账户持仓
  defer(() => Api.getAccountOrders()), // 获取账户进行中的订单
]).pipe(
  //
  map(([wallet, positions, orders]) => {
    // 将供应商的账户信息转换为 Yuan 的账户信息
    return {
      updated_at: Date.now(),
      account_id: ACCOUNT_ID,
      // ...
    };
  }),
  shareReplay(1),
);

// 通过终端，向主机声明自己提供账户信息
provideAccountInfo(terminal, accountInfo$);
```

成功接入供应商的账户信息后，主机中的其他终端可以通过订阅此频道，实时获取账户信息。

例如，在 GUI 中，可以打开【账户列表】，找到对应的账户，点击【详情】，即可打开账户详情页，实时查看供应商的账户信息。

其他注意事项：

1. 一个终端可以提供多个账户信息。在整个主机中，账户信息的 `account_id` 必须是全局唯一的。如果存在多个账户声明了相同的 `account_id`，订阅方视之为等效的发布方的多个备份数据源，会自行选择其中之一进行订阅。详情参考[技术协议 - 消息模式层 - 发布/订阅模式](../protocol/message-pattern-layer.md#发布订阅模式)
2. 外部系统通常不会直接提供与 Yuan 的标准账户信息完全一致的接口，而是会 RESTful 地提供账户余额、持仓、订单等信息。供应商需要将这些信息转换、整合为 Yuan 的标准账户信息。
3. 自动推送账户信息，可以通过轮询外部系统的 RESTful 接口，也可以连接 WebSocket 等推送接口。推荐使用推送接口，因为效率高。
4. 推送账户信息的频率由供应商自行决定，原则上，在不对外部系统造成压力的情况下，尽量频繁地推送数据。不应该过于稀疏，以免 Yuan 系统中的账户信息过时。对于高频交易的账户，推送频率应该更高。
