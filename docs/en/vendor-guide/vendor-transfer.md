# Providing Transfer Interface

:::info
You may need to read [Basics / Transfer](../basics/what-is-transfer-order.md) to deeply understand the basic concepts of transfers in Yuan.
:::

Vendors are responsible for implementing the transfer interface, which is used for transferring funds between accounts.

Implementing the transfer interface is straightforward; simply use the `addAccountTransferAddress` method to register the account's transfer and account checking functions.

Specifically, the transfer route is uniquely determined by the quadruple (`account ID`, `transfer network ID`, `currency`, `address`), which is known as [Account Address Information](../basics/what-is-transfer-order.md#account-address-information).

A single running vendor instance may provide multiple ways of transferring and checking accounts. Suppose you want to implement a vendor that provides two sets of transfers, namely (`account_id_1`, `USDT`, `AccountInternal/1/SubAccount/1`, `main`) and (`account_id_2`, `USDT`, `TRC20`, `0x1234567890`). You can implement it as follows:

```ts
import { ITerminal, addAccountTransferAddress } from '@yuants/protocol';
import { ITransferOrder } from '@yuants/transfer';

const terminal = new ITerminal(process.env.HOST_URL!, {});

addAccountTransferAddress({
  terminal,
  account_id: 'account_id_1', // Account ID
  currency: 'USDT', // Currency
  network_id: 'AccountInternal/1/SubAccount/1', // Transfer network ID, here we are describing a main account-subaccount transfer.
  address: 'main', // Address, for AccountInternal/1/SubAccount/1, this can be 'main' or the main account ID, as long as it is distinct from the subaccount's address
  onApply: {
    INIT: async (order: ITransferOrder) => {
      /// NOTE: makeSubAccountParams and Api.transferSubAccount need to be implemented by yourself
      const params = makeSubAccountParams(order);
      const transferResult = await Api.transferSubAccount(params);
      if (!transferResult.success) {
        /// NOTE: All states other than COMPLETE/ERROR will be sent back to the current step executor by the transfer controller, such as returning INIT here, the transfer controller will set the transfer order state to INIT and resend it to the current vendor's step for execution, until success or transfer timeout.
        return { state: 'INIT', message: transferResult.message };
      }
      return { state: 'COMPLETE' };
    },
  },
  /// NOTE: For such transfers, we assume they will be completed immediately, so we directly return COMPLETE
  onEval: async (order: ITransferOrder) => {
    return { state: 'COMPLETE' };
  },
});

addAccountTransferAddress({
  terminal,
  account_id: 'account_id_2',
  currency: 'USDT',
  network_id: 'TRC20', // Here we describe a TRC20 transfer
  address: '0x123456789', // The TRC20 address of the account must be provided here
  onApply: {
    INIT: async (order: ITransferOrder) => {
      /// NOTE: makeTRC20Params and Api.transferTRC20 need to be implemented by yourself
      const params = makeCheckTRC20Params(order);
      const transferResult = await Api.transferTRC20(params);
      if (!transferResult.success) {
        return { state: 'INIT', message: transferResult.message };
      }
      const withdrawId = transferResult.withdrawId;
      /// NOTE: Sometimes transfers cannot be completed immediately, such as TRC20 transfers needing to wait for chain confirmation,
      ///   until the chain Transaction ID is obtained, we consider the transfer step to be over,
      ///   at which point we need to let the current transfer step enter a new state (any name, here we call it AWAIT_TX_ID) and return a context information,
      ///   then the transfer controller will save this context information in the current_tx_context field of the transfer order and resend it to the corresponding step of the current vendor for execution.
      return { state: 'AWAIT_TX_ID', context: withdrawId };
    },
    AWAIT_TX_ID: async (order: ITransferOrder) => {
      const withdrawId = order.current_tx_context;
      /// NOTE: Api.getWithdrawHistory needs to be implemented by yourself
      const withdrawHistoryResult = await Api.getWithdrawHistory(withdrawId);
      const transaction_id = withdrawHistoryResult?.transactionId;
      if (!transaction_id) {
        return { state: 'AWAIT_TX_ID', context: withdrawId };
      }
      return { state: 'COMPLETE', transaction_id };
    },
  },
  onEval: async (order: ITransferOrder) => {
    /// NOTE: makeCheckTRC20Params and Api.checkTRC20 need to be implemented by yourself
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

The above example provides a simple implementation of the transfer interface. For a real-world example, please see: [OKX Transfer](https://github.com/No-Trade-No-Life/Yuan/blob/4dc37b9c30292a2fd87a311cca3d06f9e53e4f2d/apps/vendor-okx/src/index.ts#L521).

# Appendix: Underlying Implementation of the Transfer Interface

:::info You may not need to read this section
The following example is only used to demonstrate what the actual transfer interface looks like behind the `addAccountTransferAddress` method.

You may not need to read this section unless you need to deeply understand the underlying implementation of transfers in Yuan.
:::

The transfer interface is defined through Yuan's [Client/Server Mode](../protocol/message-pattern-layer.md#client-server-mode) and consists of two APIs: transfer request and transfer query.

Vendors need to implement the transfer request and transfer query for the current transfer step based on the execution fields in the transfer order.

```ts
interface IService {
  // Initiate transfer
  TransferApply: {
    req: ITransferOrder;
    res: IResponse<{ state: string; context?: string; transaction_id?: string; message?: string }>;
    frame: void;
  };
  // Verify transfer (account checking)
  TransferEval: {
    req: ITransferOrder;
    res: IResponse<{ state: string; context?: string; received_amount?: number } | void>;
    frame: void;
  };
}
```

The maintainer of the vendor needs to register the implementation of these two APIs in the Terminal.

As in the example in the [Guide](./vendor-transfer.md#providing-transfer-interface), a vendor may need to provide multiple account address information transfer interfaces, so it is necessary to determine which logical branch the current transfer should go to based on the execution fields in the specific transfer order.

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

terminal.server.provideService(
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
        /// NOTE: makeSubAccountParams and Api.transferSubAccount need to be implemented by yourself
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
          /// NOTE: makeTRC20Params and Api.transferTRC20 need to be implemented by yourself
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

terminal.server.provideService(
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
      /// NOTE: makeCheckTRC20Params and Api.checkTRC20 need to be implemented by yourself
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
