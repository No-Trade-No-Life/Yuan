# 提供交易接口

在 Yuan 中，交易接口是指用于与外部系统进行交易操作的接口。所有的交易接口都围绕着 [**订单**](../basics/what-is-order.md) 这一概念进行。

具体而言，交易接口分为三类：

1. 下单接口
2. 改单接口
3. 撤单接口

:::tip[交易接口的注意事项]
实现交易接口的要点在于正确地将 Yuan 的标准订单参数和外部系统的订单参数进行转换。其中可能伴随着一些概念的转换，需要 vendor 的维护者尤为注意。
:::

## 下单接口

```ts
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService(
  'SubmitOrder',
  {
    required: ['account_id'],
    properties: {
      account_id: {
        const: process.env.ACCOUNT_ID,
      },
    },
  },
  async (msg) => {
    console.info(formatTime(Date.now()), `SubmitOrder`, JSON.stringify(msg));
    const order = msg.req;

    /// NOTE: makeParams 需要自行实现，
    ///   用于将 Yuan 标准的订单参数转换为外部系统的订单参数。
    ///   例如，将 direction 字段转换成 buy/sell 以及 long/short 字段。
    const params = makeParams(order);
    console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));
    /// NOTE: Api.submitOrder 需要自行实现。
    const res = await Api.submitOrder(params);
    if (!res.success) {
      return {
        res: {
          code: 400,
          message: res.msg,
        },
      };
    }
    return { res: { code: 0, message: 'OK' } };
  },
);
```

## 改单接口

某些外部系统并不支持改单操作，因此 vendor 的维护者需要根据外部系统的特性，决定是否实现改单接口。

```ts
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService(
  'ModifyOrder',
  {
    required: ['account_id'],
    properties: {
      account_id: {
        const: process.env.ACCOUNT_ID,
      },
    },
  },
  async (msg) => {
    console.info(formatTime(Date.now()), 'ModifyOrder', JSON.stringify(msg));
    /// NOTE: makeParams 需要自行实现，
    ///   用于将 Yuan 标准的订单参数转换为外部系统的订单参数。
    ///   例如，将 direction 字段转换成 buy/sell 以及 long/short 字段。
    const params = makeParams(msg.req);
    /// NOTE: Api.modifyOrder 需要自行实现。
    const res = await Api.modifyOrder(params);
    if (!res.success) {
      return {
        res: {
          code: 400,
          message: res.msg,
        },
      };
    }
    return { res: { code: 0, message: 'OK' } };
  },
);
```

## 撤单接口

```ts
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService(
  'CancelOrder',
  {
    required: ['account_id'],
    properties: {
      account_id: {
        const: process.env.ACCOUNT_ID,
      },
    },
  },
  async (msg) => {
    console.info(formatTime(Date.now()), 'CancelOrder', JSON.stringify(msg));
    /// NOTE: makeParams 需要自行实现，
    ///   一般来说，撤单接口只需要订单 ID 即可。
    const params = makeParams(msg.req);
    /// NOTE: Api.cancelOrder 需要自行实现。
    const res = await Api.cancelOrder(params);
    if (!res.success) {
      return {
        res: {
          code: 400,
          message: res.msg,
        },
      };
    }
    return { res: { code: 0, message: 'OK' } };
  },
);
```
