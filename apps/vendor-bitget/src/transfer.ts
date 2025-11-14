import { Terminal } from '@yuants/protocol';
import { addAccountTransferAddress } from '@yuants/transfer';
import { formatTime } from '@yuants/utils';
import { defer } from 'rxjs';
import {
  getDepositAddress,
  getDepositRecords,
  getDefaultCredential,
  getVirtualSubAccountList,
  getWithdrawalRecords,
  postSubAccountTransfer,
  postTransfer,
  postWithdraw,
} from './api/private-api';
import { getFuturesAccountId, getParentAccountId, getSpotAccountId, getUid, isMainAccount } from './account';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

const TRC20 = 'TRC20';
const currency = 'USDT';

defer(async () => {
  const spotAccountId = await getSpotAccountId();
  const futuresAccountId = await getFuturesAccountId();
  const uid = await getUid();

  // On-chain withdrawals only available on main accounts
  if (await isMainAccount()) {
    const depositAddressRes = await getDepositAddress(credential, { coin: currency, chain: TRC20 });
    console.info(formatTime(Date.now()), 'DepositAddress', depositAddressRes.data);

    addAccountTransferAddress({
      terminal,
      account_id: spotAccountId,
      network_id: TRC20,
      currency,
      address: depositAddressRes.data.address,
      onApply: {
        INIT: async (order) => {
          if (!order.current_amount || order.current_amount < 10) {
            return { state: 'ERROR', message: 'Amount too small' };
          }
          const transferResult = await postWithdraw(credential, {
            coin: currency,
            transferType: 'on_chain',
            address: order.current_rx_address!,
            chain: TRC20,
            size: `${order.current_amount}`,
          });
          if (transferResult.msg !== 'success') {
            return { state: 'ERROR', message: transferResult.msg };
          }
          const wdId = transferResult.data.orderId;
          return { state: 'PENDING', context: wdId };
        },
        PENDING: async (order) => {
          const wdId = order.current_tx_context;
          const withdrawalRecordsResult = await getWithdrawalRecords(credential, {
            orderId: wdId,
            startTime: `${Date.now() - 90 * 86400_000}`,
            endTime: '' + Date.now(),
          });
          if (withdrawalRecordsResult.msg !== 'success') {
            return { state: 'PENDING', context: wdId };
          }
          const txId = withdrawalRecordsResult.data[0]?.tradeId;
          if (!txId || txId === wdId) {
            return { state: 'PENDING', context: wdId };
          }
          return { state: 'COMPLETE', transaction_id: txId };
        },
      },
      onEval: async (order) => {
        const checkResult = await getDepositRecords(credential, {
          coin: currency,
          startTime: `${Date.now() - 90 * 86400_000}`,
          endTime: '' + Date.now(),
          limit: '100',
        });
        if (checkResult.msg !== 'success') {
          return { state: 'PENDING' };
        }
        const deposit = checkResult.data.find((v: any) => v.tradeId === order.current_transaction_id);
        if (!deposit) {
          return { state: 'PENDING' };
        }
        return { state: 'COMPLETE', received_amount: +deposit.size };
      },
    });
  }

  // Internal transfer between spot and USDT futures
  const internalNetworkId = `Bitget/${uid}/ACCOUNT_INTERNAL_NETWORK_ID`;
  addAccountTransferAddress({
    terminal,
    account_id: spotAccountId,
    network_id: internalNetworkId,
    currency,
    address: 'SPOT',
    onApply: {
      INIT: async (order) => {
        const transferResult = await postTransfer(credential, {
          fromType: 'spot',
          toType: 'usdt_futures',
          amount: `${order.current_amount}`,
          coin: currency,
        });
        if (transferResult.msg !== 'success') {
          return { state: 'INIT', message: transferResult.msg };
        }
        return { state: 'COMPLETE' };
      },
    },
    onEval: async (order) => ({ state: 'COMPLETE', received_amount: order.current_amount }),
  });

  addAccountTransferAddress({
    terminal,
    account_id: futuresAccountId,
    network_id: internalNetworkId,
    currency,
    address: 'USDT_FUTURE',
    onApply: {
      INIT: async (order) => {
        const transferResult = await postTransfer(credential, {
          fromType: 'usdt_futures',
          toType: 'spot',
          amount: `${order.current_amount}`,
          coin: currency,
        });
        if (transferResult.msg !== 'success') {
          return { state: 'INIT', message: transferResult.msg };
        }
        return { state: 'COMPLETE' };
      },
    },
    onEval: async (order) => ({ state: 'COMPLETE', received_amount: order.current_amount }),
  });

  if (await isMainAccount()) {
    const parentId = await getParentAccountId();
    const subAccountInfoRes = await getVirtualSubAccountList(credential);
    console.info(formatTime(Date.now()), 'SubAccountInfo', subAccountInfoRes);
    for (const item of subAccountInfoRes.data?.subAccountList || []) {
      const networkId = `Bitget/${parentId}/SubAccount/${item.subAccountUid}`;
      addAccountTransferAddress({
        terminal,
        account_id: spotAccountId,
        network_id: networkId,
        currency,
        address: 'parent',
        onApply: {
          INIT: async (order) => {
            const transferResult = await postSubAccountTransfer(credential, {
              fromType: 'spot',
              toType: 'spot',
              amount: `${order.current_amount}`,
              coin: currency,
              fromUserId: parentId,
              toUserId: item.subAccountUid,
            });
            if (transferResult.msg !== 'success') {
              return { state: 'INIT', message: transferResult.msg };
            }
            return { state: 'COMPLETE', transaction_id: transferResult.data.transferId };
          },
        },
        onEval: async (order) => ({ state: 'COMPLETE', received_amount: order.current_amount }),
      });

      addAccountTransferAddress({
        terminal,
        account_id: `bitget/${item.subAccountUid}/spot/USDT`,
        network_id: networkId,
        currency,
        address: 'sub',
        onApply: {
          INIT: async (order) => {
            const transferResult = await postSubAccountTransfer(credential, {
              fromType: 'spot',
              toType: 'spot',
              amount: `${order.current_amount}`,
              coin: currency,
              fromUserId: item.subAccountUid,
              toUserId: parentId,
            });
            if (transferResult.msg !== 'success') {
              return { state: 'INIT', message: transferResult.msg };
            }
            return { state: 'COMPLETE', transaction_id: transferResult.data.transferId };
          },
        },
        onEval: async (order) => ({ state: 'COMPLETE', received_amount: order.current_amount }),
      });
    }
  }
}).subscribe();
