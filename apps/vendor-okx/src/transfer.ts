import { createCache } from '@yuants/cache';
import { Terminal } from '@yuants/protocol';
import { addAccountTransferAddress } from '@yuants/transfer';
import { formatTime } from '@yuants/utils';
import { defer } from 'rxjs';
import { accountConfigCache } from './account';
import {
  getAssetCurrencies,
  getAssetDepositAddress,
  getAssetDepositHistory,
  getAssetWithdrawalHistory,
  getDefaultCredential,
  getSubAccountList,
  postAssetTransfer,
  postAssetWithdrawal,
  postFinanceSavingsPurchaseRedempt,
} from './api/private-api';

const terminal = Terminal.fromNodeEnv();

const credential = getDefaultCredential();

const cacheOfAssetCurrencies = createCache(() => getAssetCurrencies(credential), { expire: 3600_000 });

defer(async () => {
  const account_config = await accountConfigCache.query('');
  if (!account_config) throw new Error('Failed to get account config');
  console.info(formatTime(Date.now()), 'AccountConfig', JSON.stringify(account_config));
  const { mainUid, uid } = account_config.data[0];
  const isMainAccount = mainUid === uid;

  const TRADING_ACCOUNT_ID = `okx/${uid}/trading`;
  const FUNDING_ACCOUNT_ID = `okx/${uid}/funding/USDT`;
  const EARNING_ACCOUNT_ID = `okx/${uid}/earning/USDT`;

  // BLOCK_CHAIN: only available for main account
  if (isMainAccount) {
    const depositAddressRes = await getAssetDepositAddress(credential, { ccy: 'USDT' });
    console.info(formatTime(Date.now()), 'DepositAddress', JSON.stringify(depositAddressRes.data));
    const addresses = depositAddressRes.data.filter((v) => v.chain === 'USDT-TRC20' && v.to === '6');
    for (const address of addresses) {
      addAccountTransferAddress({
        terminal,
        account_id: FUNDING_ACCOUNT_ID,
        network_id: 'TRC20',
        currency: 'USDT',
        address: address.addr,
        onApply: {
          INIT: async (order) => {
            if (
              !order.current_amount ||
              order.current_amount < 3 // 最小提币额度
            ) {
              return { state: 'ERROR', message: 'Amount too small' };
            }
            const res = await cacheOfAssetCurrencies.query('');
            const theRes = res?.data?.find((x) => x.ccy === 'USDT' && x.chain === 'USDT-TRC20');
            const _fee = theRes?.minFee;
            if (!_fee) return { state: 'ERROR', message: 'Currency Info not found, cannot get fee' };
            const fee = +_fee;
            const amt = Math.floor(order.current_amount - fee);
            const transferResult = await postAssetWithdrawal(credential, {
              amt: `${amt}`,
              ccy: 'USDT',
              chain: 'USDT-TRC20',
              fee: `${fee}`,
              dest: '4', // 链上提币
              toAddr: order.current_rx_address!,
            });
            if (transferResult.code !== '0') {
              return { state: 'INIT', message: transferResult.msg };
            }
            const wdId = transferResult.data[0]?.wdId;
            return { state: 'AWAIT_TX_ID', context: wdId };
          },
          AWAIT_TX_ID: async (transferOrder) => {
            const wdId = transferOrder.current_tx_context;
            const withdrawalHistory = await getAssetWithdrawalHistory(credential, { wdId });
            const txId = withdrawalHistory.data?.[0]?.txId;
            if (!txId) {
              return { state: 'AWAIT_TX_ID', context: wdId };
            }
            return { state: 'COMPLETE', transaction_id: txId };
          },
        },
        onEval: async (transferOrder) => {
          const checkResult = await getAssetDepositHistory(credential, {
            ccy: 'USDT',
            txId: transferOrder.current_transaction_id,
            type: '4',
          });

          if (checkResult.code !== '0') {
            return {
              state: 'INIT',
            };
          }

          if (checkResult.data[0].state !== '2') {
            return { state: 'PENDING' };
          }
          const received_amount = +checkResult.data[0].amt;
          return { state: 'COMPLETE', received_amount };
        },
      });
    }
  }

  // Funding-Trading
  {
    const FUNDING_TRADING_NETWORK_ID = `OKX/${uid}/Funding-Trading`;
    addAccountTransferAddress({
      terminal,
      account_id: FUNDING_ACCOUNT_ID,
      network_id: FUNDING_TRADING_NETWORK_ID,
      currency: 'USDT',
      address: 'funding',
      onApply: {
        INIT: async (order) => {
          const transferResult = await postAssetTransfer(credential, {
            type: '0',
            ccy: 'USDT',
            amt: `${order.current_amount}`,
            from: '6',
            to: '18',
          });
          if (transferResult.code !== '0') {
            return { state: 'INIT', message: transferResult.msg };
          }
          const transaction_id = transferResult.data[0].transId;
          return { state: 'COMPLETE', transaction_id };
        },
      },
      onEval: async (transferOrder) => {
        return { state: 'COMPLETE', received_amount: transferOrder.current_amount };
      },
    });
    addAccountTransferAddress({
      terminal,
      account_id: TRADING_ACCOUNT_ID,
      network_id: FUNDING_TRADING_NETWORK_ID,
      currency: 'USDT',
      address: 'trading',
      onApply: {
        INIT: async (order) => {
          const transferResult = await postAssetTransfer(credential, {
            type: '0',
            ccy: order.currency,
            amt: `${order.current_amount}`,
            from: '18',
            to: '6',
          });
          if (transferResult.code !== '0') {
            return { state: 'INIT', message: transferResult.msg };
          }
          const transaction_id = transferResult.data[0].transId;
          return { state: 'COMPLETE', transaction_id };
        },
      },
      onEval: async (transferOrder) => {
        return { state: 'COMPLETE', received_amount: transferOrder.current_amount };
      },
    });
  }
  // Funding-Earning
  {
    const FUNDING_EARNING_NETWORK_ID = `OKX/${uid}/Funding-Earning`;
    addAccountTransferAddress({
      terminal,
      account_id: FUNDING_ACCOUNT_ID,
      network_id: FUNDING_EARNING_NETWORK_ID,
      currency: 'USDT',
      address: 'funding',
      onApply: {
        INIT: async (order) => {
          const transferResult = await postFinanceSavingsPurchaseRedempt(credential, {
            ccy: 'USDT',
            amt: `${order.current_amount}`,
            side: 'purchase',
            rate: '0.01',
          });
          if (transferResult.code !== '0') {
            return { state: 'INIT', message: transferResult.msg };
          }
          return { state: 'COMPLETE', transaction_id: 'ok' };
        },
      },
      onEval: async (transferOrder) => {
        return { state: 'COMPLETE', received_amount: transferOrder.current_amount };
      },
    });
    addAccountTransferAddress({
      terminal,
      account_id: EARNING_ACCOUNT_ID,
      network_id: FUNDING_EARNING_NETWORK_ID,
      currency: 'USDT',
      address: 'earning',
      onApply: {
        INIT: async (order) => {
          const transferResult = await postFinanceSavingsPurchaseRedempt(credential, {
            ccy: 'USDT',
            amt: `${order.current_amount}`,
            side: 'redempt',
            rate: '0.01',
          });
          if (transferResult.code !== '0') {
            return { state: 'INIT', message: transferResult.msg };
          }
          return { state: 'COMPLETE', transaction_id: 'ok' };
        },
      },
      onEval: async (transferOrder) => {
        return { state: 'COMPLETE', received_amount: transferOrder.current_amount };
      },
    });
  }

  // SubAccount
  {
    const getSubAccountNetworkId = (subUid: string) => `OKX/${mainUid}/SubAccount/${subUid}`;
    if (isMainAccount) {
      const subAcctsRes = await getSubAccountList(credential);
      for (const item of subAcctsRes.data || []) {
        addAccountTransferAddress({
          terminal,
          account_id: FUNDING_ACCOUNT_ID,
          network_id: getSubAccountNetworkId(item.uid),
          currency: 'USDT',
          address: 'main',
          onApply: {
            INIT: async (order) => {
              const transferResult = await postAssetTransfer(credential, {
                type: '1',
                ccy: 'USDT',
                amt: `${order.current_amount}`,
                from: '6',
                to: '6',
                subAcct: item.subAcct,
              });
              if (transferResult.code !== '0') {
                return { state: 'INIT', message: transferResult.msg };
              }
              const transaction_id = transferResult.data[0].transId;
              return { state: 'COMPLETE', transaction_id };
            },
          },
          onEval: async (order) => {
            // ISSUE: OKX API Issue: transId is incorrect or transId does not match with ‘ type’
            // const checkResult = await client.getAssetTransferState({ transId: order.current_transaction_id });
            // const received_amount = checkResult?.data?.[0]?.amt;
            // if (!received_amount) {
            //   return { state: 'INIT', message: checkResult.msg };
            // }
            // return { state: 'COMPLETE', received_amount: +received_amount };

            return { state: 'COMPLETE', received_amount: order.current_amount };
          },
        });
      }
    }
    // SubAccount API
    else {
      addAccountTransferAddress({
        terminal,
        account_id: FUNDING_ACCOUNT_ID,
        network_id: getSubAccountNetworkId(uid),
        currency: 'USDT',
        address: 'sub',
        onApply: {
          INIT: async (order) => {
            const transferResult = await postAssetTransfer(credential, {
              type: '3',
              ccy: 'USDT',
              amt: `${order.current_amount}`,
              from: '6',
              to: '6',
            });
            if (transferResult.code !== '0') {
              return { state: 'INIT', message: transferResult.msg };
            }
            const transaction_id = transferResult.data[0].transId;
            return { state: 'COMPLETE', transaction_id };
          },
        },
        onEval: async (order) => {
          // ISSUE: OKX API Issue: transId is incorrect or transId does not match with ‘ type’
          // const checkResult = await client.getAssetTransferState({ transId: order.current_transaction_id });
          // const received_amount = checkResult?.data?.[0]?.amt;
          // if (!received_amount) {
          //   return { state: 'INIT', message: checkResult.msg };
          // }
          // return { state: 'COMPLETE', received_amount: +received_amount };
          return { state: 'COMPLETE', received_amount: order.current_amount };
        },
      });
    }
  }
}).subscribe();
