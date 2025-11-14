import { Terminal } from '@yuants/protocol';
import { addAccountTransferAddress } from '@yuants/transfer';
import { formatTime } from '@yuants/utils';
import { defer } from 'rxjs';
import { getDefaultCredential } from './api/client';
import {
  getDepositAddress,
  getDepositHistory,
  getWithdrawalHistory,
  postWalletTransfer,
  postWithdrawals,
} from './api/private-api';
import { getFutureAccountId, getSpotAccountId, getUid } from './account';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();
const currency = 'USDT';
const TRC20 = 'TRC20';

const isTransferDisabled = () =>
  process.env.DISABLE_TRANSFER === 'true' || process.env.DISABLE_TRANSFER === '1';

if (!isTransferDisabled()) {
  defer(async () => {
    const [spotAccountId, futureAccountId, uid] = await Promise.all([
      getSpotAccountId(),
      getFutureAccountId(),
      getUid(),
    ]);

    const ACCOUNT_INTERNAL_NETWORK_ID = `Gate/${uid}/ACCOUNT_INTERNAL`;

    addAccountTransferAddress({
      terminal,
      account_id: spotAccountId,
      network_id: ACCOUNT_INTERNAL_NETWORK_ID,
      currency,
      address: 'SPOT',
      onApply: {
        INIT: async (order) => {
          const transferResult = await postWalletTransfer(credential, {
            currency,
            from: 'spot',
            to: 'futures',
            amount: `${order.current_amount}`,
            settle: 'usdt',
          });
          if (transferResult?.tx_id !== undefined) {
            return { state: 'COMPLETE', transaction_id: transferResult.tx_id };
          }
          return { state: 'INIT', message: `${transferResult}` };
        },
      },
      onEval: async (order) => ({ state: 'COMPLETE', received_amount: order.current_amount }),
    });

    addAccountTransferAddress({
      terminal,
      account_id: futureAccountId,
      network_id: ACCOUNT_INTERNAL_NETWORK_ID,
      currency,
      address: 'USDT_FUTURE',
      onApply: {
        INIT: async (order) => {
          const transferResult = await postWalletTransfer(credential, {
            currency,
            from: 'futures',
            to: 'spot',
            amount: `${order.current_amount}`,
            settle: 'usdt',
          });
          if (transferResult?.tx_id !== undefined) {
            return { state: 'COMPLETE', transaction_id: transferResult.tx_id };
          }
          return { state: 'INIT', message: `${transferResult}` };
        },
      },
      onEval: async (order) => ({ state: 'COMPLETE', received_amount: order.current_amount }),
    });

    const depositAddressRes = await getDepositAddress(credential, { currency });
    console.info(formatTime(Date.now()), 'DepositAddress', JSON.stringify(depositAddressRes));
    const addresses = depositAddressRes?.multichain_addresses?.filter((v: any) => v.chain === 'TRX') ?? [];
    for (const address of addresses) {
      addAccountTransferAddress({
        terminal,
        account_id: spotAccountId,
        network_id: TRC20,
        currency,
        address: address.address,
        onApply: {
          INIT: async (order) => {
            if (!order.current_rx_address) {
              return { state: 'ERROR', message: 'current_rx_address is required' };
            }
            const transferResult = await postWithdrawals(credential, {
              amount: `${order.current_amount}`,
              currency,
              address: order.current_rx_address,
              chain: 'TRX',
            });
            const { txid, withdraw_order_id } = transferResult;
            if (txid) {
              return { state: 'COMPLETE', transaction_id: txid };
            }
            return { state: 'PENDING', context: withdraw_order_id };
          },
          PENDING: async (order) => {
            const wdId = order.current_tx_context;
            const withdrawalRecords = await getWithdrawalHistory(credential, { currency });
            const record = (withdrawalRecords ?? []).find((v: any) => v.withdraw_order_id === wdId);
            if (record?.txid) {
              return { state: 'COMPLETE', transaction_id: record.txid };
            }
            return { state: 'PENDING', context: wdId };
          },
        },
        onEval: async (order) => {
          const records = await getDepositHistory(credential, { currency });
          const deposit = (records ?? []).find((v: any) => v.txid === order.current_transaction_id);
          if (deposit && deposit.status === 'DONE') {
            return { state: 'COMPLETE', received_amount: Number(deposit.amount) };
          }
          return { state: 'PENDING' };
        },
      });
    }
  }).subscribe();
} else {
  console.info(formatTime(Date.now()), 'GateTransfer', 'DISABLE_TRANSFER is enabled');
}
