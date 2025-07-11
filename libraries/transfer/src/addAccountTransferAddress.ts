import { IDataRecordTypes } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { ITransferOrder } from './model/TransferOrder';

type IAccountAddressInfo = IDataRecordTypes['account_address_info'];

type IAccountTransferAddressContext = IAccountAddressInfo & {
  terminal: Terminal;
  onApply: Record<
    string,
    (order: ITransferOrder) => Promise<{
      state: string;
      context?: string;
      message?: string;
      transaction_id?: string;
    }>
  >;
  onEval: (order: ITransferOrder) => Promise<{
    state: string;
    context?: string;
    received_amount?: number;
  } | void>;
};

/**
 * addAccountTransferAddress
 *
 * A helper function to add an account transfer address context.
 *
 * @public
 */
export const addAccountTransferAddress = (ctx: IAccountTransferAddressContext) => {
  console.info(
    formatTime(Date.now()),
    'addAccountTransferAddress',
    ctx.account_id,
    ctx.currency,
    ctx.network_id,
    ctx.address,
  );

  ctx.terminal.provideService(
    'TransferApply',
    {
      type: 'object',
      required: ['current_tx_account_id', 'currency', 'current_network_id', 'current_tx_address'],
      properties: {
        current_tx_account_id: {
          const: ctx.account_id,
        },
        currency: {
          const: ctx.currency,
        },
        current_network_id: {
          const: ctx.network_id,
        },
        current_tx_address: {
          const: ctx.address,
        },
      },
    },
    async (msg) => {
      const order = msg.req;
      const handler = ctx.onApply[order.current_tx_state || 'INIT'];
      console.info(formatTime(Date.now()), 'TransferApply', JSON.stringify(order));
      if (!handler) {
        return { res: { code: 400, message: 'Unknown State', data: { state: 'ERROR' } } };
      }
      const res = await handler(order);
      return { res: { code: 0, message: 'OK', data: res } };
    },
  );
  ctx.terminal.provideService(
    'TransferEval',
    {
      type: 'object',
      required: ['current_rx_account_id', 'currency', 'current_network_id', 'current_rx_address'],
      properties: {
        current_rx_account_id: {
          const: ctx.account_id,
        },
        currency: {
          const: ctx.currency,
        },
        current_network_id: {
          const: ctx.network_id,
        },
        current_rx_address: {
          const: ctx.address,
        },
      },
    },
    async (msg) => {
      const order = msg.req;
      console.info(formatTime(Date.now()), 'TransferEval', JSON.stringify(order));
      const res = await ctx.onEval(order);
      return { res: { code: 0, message: 'OK', data: res } };
    },
  );
};
