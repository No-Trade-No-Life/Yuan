# Providing Trading Interface

In Yuan, the trading interface refers to the interface used for trading operations with external systems. All trading interfaces revolve around the concept of [**Order**](../basics/what-is-order.md).

Specifically, trading interfaces are categorized into three types:

1. Order Submission Interface
2. Order Modification Interface
3. Order Cancellation Interface

:::tip[Considerations for Trading Interfaces]
The key to implementing trading interfaces is to correctly convert the standard order parameters of Yuan into the order parameters of the external system. This may involve some concept conversions, which require special attention from the vendor maintainers.
:::

## Order Submission Interface

```ts
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';

const terminal = new Terminal(process.env.HOST_URL!, {});

terminal.provideService(
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

    /// NOTE: makeParams needs to be implemented by yourself,
    ///   used to convert the standard order parameters of Yuan into the order parameters of the external system.
    ///   For example, convert the direction field into buy/sell and long/short fields.
    const params = makeParams(order);
    console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));
    /// NOTE: Api.submitOrder needs to be implemented by yourself.
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

## Order Modification Interface

Some external systems do not support order modification operations, so the vendor maintainers need to decide whether to implement the order modification interface based on the characteristics of the external system.

```ts
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';

const terminal = new Terminal(process.env.HOST_URL!, {});

terminal.provideService(
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
    /// NOTE: makeParams needs to be implemented by yourself,
    ///   used to convert the standard order parameters of Yuan into the order parameters of the external system.
    ///   For example, convert the direction field into buy/sell and long/short fields.
    const params = makeParams(msg.req);
    /// NOTE: Api.modifyOrder needs to be implemented by yourself.
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

## Order Cancellation Interface

```ts
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';

const terminal = new Terminal(process.env.HOST_URL!, {});

terminal.provideService(
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
    /// NOTE: makeParams needs to be implemented by yourself,
    ///   Generally, the order cancellation interface only needs the order ID.
    const params = makeParams(msg.req);
    /// NOTE: Api.cancelOrder needs to be implemented by yourself.
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
