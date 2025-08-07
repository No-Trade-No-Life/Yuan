# 提供转账接口

:::info
您可能需要阅读 [基础概念 / 转账](../basics/what-is-transfer-order.md) 来深入理解 Yuan 中转账的基本概念。
:::

供应商负责实现转账接口，用于账户之间的转账操作。

实现转账接口非常简单，只要使用 `addAccountTransferAddress` 方法注册账户对应的转账以及查账函数即可。

具体来说，转账路由是由 (`账户 ID`, `转账网络 ID`, `货币`, `地址`) 四元组作为来唯一确定的，即[账户地址信息](../basics/what-is-transfer-order.md#账户地址信息)。

同一个运行中的 vendor 实例可能提供多个转账、查账的方式。假设你要实现一个提供两组的供应商，分别是 (`account_id_1`, `USDT`, `AccountInternal/1/SubAccount/1`, `main`) 和 (`account_id_2`, `USDT`, `TRC20`, `0x1234567890`)，那么你可以这样实现：

```ts
import { ITerminal, addAccountTransferAddress } from '@yuants/protocol';
import { ITransferOrder } from '@yuants/transfer';

const terminal = new ITerminal(process.env.HOST_URL!, {});

addAccountTransferAddress({
  terminal,
  account_id: 'account_id_1', // 账户 ID
  currency: 'USDT', // 货币
  network_id: 'AccountInternal/1/SubAccount/1', // 转账网络 ID，这里我们在描述一个主账户-子账户的转账。
  address: 'main', // 地址，对于 AccountInternal/1/SubAccount/1 来说，这里可以是 main 或者是主账户 ID，只要与子账户的地址区分开即可
  onApply: {
    INIT: async (order: ITransferOrder) => {
      /// NOTE: makeSubAccountParams 和 Api.transferSubAccount 需要自行实现
      const params = makeSubAccountParams(order);
      const transferResult = await Api.transferSubAccount(params);
      if (!transferResult.success) {
        /// NOTE: 所有非 COMPLETE/ERROR 的状态都会被转账控制器发回给当前步骤的执行方，比如这里返回 INIT，转账控制器会将转账订单的状态设置为 INIT 并重新发给当前 vendor 的这一步来执行，直到成功或者转账超时。
        return { state: 'INIT', message: transferResult.message };
      }
      return { state: 'COMPLETE' };
    },
  },
  /// NOTE: 对于这类转账我们认为会立即完成，所以这里直接返回 COMPLETE
  onEval: async (order: ITransferOrder) => {
    return { state: 'COMPLETE' };
  },
});

addAccountTransferAddress({
  terminal,
  account_id: 'account_id_2',
  currency: 'USDT',
  network_id: 'TRC20', // 这里描述了一个 TRC20 转账
  address: '0x123456789', // 此处必须给定账户的 TRC20 地址
  onApply: {
    INIT: async (order: ITransferOrder) => {
      /// NOTE: makeTRC20Params 和 Api.transferTRC20 需要自行实现
      const params = makeCheckTRC20Params(order);
      const transferResult = await Api.transferTRC20(params);
      if (!transferResult.success) {
        return { state: 'INIT', message: transferResult.message };
      }
      const withdrawId = transferResult.withdrawId;
      /// NOTE: 有时候转账无法立即完成，比如 TRC20 转账需要等待链上确认，
      ///   直到拿到链上 Transaction ID 为止，我们才认为转账步骤结束了，
      ///   这时候需要让当前转账步骤进入一个新的状态（任意名字，这里我们取名 AWAIT_TX_ID）并且返回一个上下文信息，
      ///   之后转账控制器会将这个上下文信息保存在转账订单的 current_tx_context 字段中，然后再次发给当前 vendor 的对应步骤来执行。
      return { state: 'AWAIT_TX_ID', context: withdrawId };
    },
    AWAIT_TX_ID: async (order: ITransferOrder) => {
      const withdrawId = order.current_tx_context;
      /// NOTE: Api.getWithdrawHistory 需要自行实现
      const withdrawHistoryResult = await Api.getWithdrawHistory(withdrawId);
      const transaction_id = withdrawHistoryResult?.transactionId;
      if (!transaction_id) {
        return { state: 'AWAIT_TX_ID', context: withdrawId };
      }
      return { state: 'COMPLETE', transaction_id };
    },
  },
  onEval: async (order: ITransferOrder) => {
    /// NOTE: makeCheckTRC20Params 和 Api.checkTRC20 需要自行实现
    const params = makeCheckTRC20Params(order);
    const checkResult = await Api.checkTRC20(params);
    if (!checkResult.success) {
      return { state: 'INIT', message: checkResult.message };
    }
    const received_amount = checkResult.receivedAmount;
    return { state: 'COMPLETE', received_amount };
  },
});
```

上面的例子提供了一个简单的转账接口实现，真实世界中的例子请见：[OKX Transfer](https://github.com/No-Trade-No-Life/Yuan/blob/4dc37b9c30292a2fd87a311cca3d06f9e53e4f2d/apps/vendor-okx/src/index.ts#L521)。

# 附录：转账接口的底层实现

:::info 或许您不需要阅读一节
下面的例子仅仅用来演示 `addAccountTransferAddress` 方法的背后，转账接口实际的样子是什么样的。

您可能不需要阅读这一节，除非您需要深入了解 Yuan 中转账的底层实现。
:::

转账接口通过 Yuan 的 [客户端/服务器模式](../protocol/message-pattern-layer.md#客户端服务器模式) 定义，由两个 API 组成，分别是转账请求和转账查询。

供应商需要根据转账订单中的执行字段，来实现当前转账步骤的转账请求和转账查询。

```ts
interface IService {
  // 发起转账
  TransferApply: {
    req: ITransferOrder;
    res: IResponse<{ state: string; context?: string; transaction_id?: string; message?: string }>;
    frame: void;
  };
  // 核验转账 (对账)
  TransferEval: {
    req: ITransferOrder;
    res: IResponse<{ state: string; context?: string; received_amount?: number } | void>;
    frame: void;
  };
}
```

而 vendor 的维护者需要在 Terminal 中注册这两个 API 的实现。

如同 [指南](./vendor-transfer.md#提供转账接口) 中的例子，一个 vendor 可能需要提供多个账户地址信息的转账接口，因此需要根据具体的转账订单中的执行字段来判断当前转账该走向哪个逻辑分支。

```ts
import { ITerminal } from '@yuants/protocol';

const terminal = new ITerminal(process.env.HOST_URL!, {});

const contextList = {
  {
    account_id: 'account_id_1',
    currency: 'USDT',
    network_id: 'AccountInternal/1/SubAccount/1',
    address: 'main',
  },
  {
    account_id: 'account_id_2',
    currency: 'USDT',
    network_id: 'TRC20',
    address: '0x1234567890',
  },
};

terminal.provideService(
  'TransferApply',
  {
    type: 'object',
    required: ['current_tx_account_id', 'currency', 'current_network_id', 'current_tx_address'],
    oneOf: contextList.map((x) => ({
      properties: {
        current_tx_account_id: {
          const: x.account_id,
        },
        currency: {
          const: x.currency,
        },
        current_network_id: {
          const: x.network_id,
        },
        current_tx_address: {
          const: x.address,
        },
      },
    })),
  },
  async (req) => {
    const { current_tx_account_id, currency, current_network_id, current_tx_address, current_tx_state } = req;
    if (current_tx_account_id === 'account_id_1' && currency === 'USDT' && current_network_id === 'AccountInternal/1/SubAccount/1' && current_tx_address === 'main') {
      if (current_tx_state === 'INIT') {
        /// NOTE: makeSubAccountParams 和 Api.transferSubAccount 需要自行实现
        const params = makeSubAccountParams(order);
        const transferResult = await Api.transferSubAccount(params);
        if (!transferResult.success) {
          return { state: 'INIT', message: transferResult.message };
        }
        return { state: 'COMPLETE' };
      }
      return { res: { code: 400, message: 'Unknown State', data: { state: 'ERROR' } } };
    } else if (current_tx_account_id === 'account_id_2' && currency === 'USDT' && current_network_id === 'TRC20' && current_tx_address === '0x1234567890') {
        if (current_tx_state === 'INIT') {
          /// NOTE: makeTRC20Params 和 Api.transferTRC20 需要自行实现
          const params = makeTRC20Params(order);
          const transferResult = await Api.transferTRC20(params);
          if (!transferResult.success) {
            return { state: 'INIT', message: transferResult.message };
          }
          const withdrawId = transferResult.withdrawId;
          return { state: 'AWAIT_TX_ID', context: withdrawId };
        }
        if (current_tx_state === 'AWAIT_TX_ID') {
          const withdrawId = order.current_tx_context;
          const withdrawHistoryResult = await Api.getWithdrawHistory(withdrawId);
          const transactionId = withdrawHistoryResult?.transactionId;
          if (!transactionId) {
              return { state: 'AWAIT_TX_ID', context: withdrawId };
          }
          return { state: 'COMPLETE', transaction_id: transactionId };
        }
      return { res: { code: 400, message: 'Unknown State', data: { state: 'ERROR' } } };
    }
    return { state: 'COMPLETE' };
  },
);

terminal.provideService(
  'TransferEval',
  {
    type: 'object',
    required: ['current_rx_account_id', 'currency', 'current_network_id', 'current_rx_address'],
    oneOf: contextList.map((x) => ({
      properties: {
        current_rx_account_id: {
          const: x.account_id,
        },
        currency: {
          const: x.currency,
        },
        current_network_id: {
          const: x.network_id,
        },
        current_rx_address: {
          const: x.address,
        },
      },
    })),
  },
  async (req) => {
    const { current_rx_account_id, currency, current_network_id, current_rx_address, current_rx_state } = req;
    if (current_rx_account_id === '1' && currency === 'USDT' && current_network_id === 'AccountInternal/1/SubAccount/1' && current_rx_address === 'main') {
      return { state: 'COMPLETE' };
    }
    if (current_rx_account_id === '2' && currency === 'USDT' && current_network_id === 'TRC20' && current_rx_address === '0x1234567890') {
      /// NOTE: makeCheckTRC20Params 和 Api.checkTRC20 需要自行实现
      const params = makeCheckTRC20Params(order);
      const checkResult = await Api.checkTRC20(params);
      if (!checkResult.success) {
        return { state: 'INIT', message: checkResult.message };
      }
      const received_amount = checkResult.receivedAmount;
      return { state: 'COMPLETE', received_amount };
    }
    return { state: 'COMPLETE' };
  },
);

```
