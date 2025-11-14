import { Terminal } from '@yuants/protocol';
import { addAccountTransferAddress } from '@yuants/transfer';
import { getDefaultCredential } from './api/client';
import {
  getDepositAddress,
  getDepositHistory,
  getSubAccountList,
  getWithdrawHistory,
  postAssetTransfer,
  postWithdraw,
} from './api/private-api';
import { isBinanceErrorResponse } from './api/types';
import { getSpotAccountId, getUid, getUnifiedAccountId } from './account';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

(async () => {
  const [spotAccountId, unifiedAccountId, uid] = await Promise.all([
    getSpotAccountId(),
    getUnifiedAccountId(),
    getUid(),
  ]);

  const SPOT_UNIFIED_NETWORK_ID = `binance/${uid}/spot/unified`;

  addAccountTransferAddress({
    terminal,
    account_id: spotAccountId,
    network_id: SPOT_UNIFIED_NETWORK_ID,
    currency: 'USDT',
    address: 'unified',
    onApply: {
      INIT: async (order) => {
        const transferResult = await postAssetTransfer(credential, {
          type: 'MAIN_PORTFOLIO_MARGIN',
          asset: 'USDT',
          amount: order.current_amount!,
        });
        if (isBinanceErrorResponse(transferResult)) {
          return { state: 'INIT', message: transferResult.msg };
        }
        return { state: 'COMPLETE', transaction_id: '' + transferResult.tranId };
      },
    },
    onEval: async (order) => ({ state: 'COMPLETE', received_amount: order.current_amount }),
  });

  addAccountTransferAddress({
    terminal,
    account_id: unifiedAccountId,
    network_id: SPOT_UNIFIED_NETWORK_ID,
    currency: 'USDT',
    address: 'spot',
    onApply: {
      INIT: async (order) => {
        const transferResult = await postAssetTransfer(credential, {
          type: 'PORTFOLIO_MARGIN_MAIN',
          asset: 'USDT',
          amount: order.current_amount!,
        });
        if (isBinanceErrorResponse(transferResult)) {
          return { state: 'INIT', message: transferResult.msg };
        }
        return { state: 'COMPLETE', transaction_id: '' + transferResult.tranId };
      },
    },
    onEval: async (order) => ({ state: 'COMPLETE', received_amount: order.current_amount }),
  });

  const subAccountsResult = await getSubAccountList(credential);
  const isMain = !isBinanceErrorResponse(subAccountsResult);

  if (isMain) {
    const depositAddressResult = await getDepositAddress(credential, { coin: 'USDT', network: 'TRX' });
    addAccountTransferAddress({
      terminal,
      account_id: spotAccountId,
      network_id: 'TRC20',
      currency: 'USDT',
      address: depositAddressResult.address,
      onApply: {
        INIT: async (order) => {
          const transferResult = await postWithdraw(credential, {
            coin: 'USDT',
            network: 'TRX',
            address: order.current_rx_address!,
            amount: order.current_amount!,
          });
          if (isBinanceErrorResponse(transferResult)) {
            return { state: 'ERROR', message: transferResult.msg };
          }
          const wdId = transferResult.id;
          return { state: 'PENDING', context: wdId };
        },
        PENDING: async (order) => {
          const wdId = order.current_tx_context;
          const withdrawResult = await getWithdrawHistory(credential, { coin: 'USDT' });
          const record = withdrawResult?.find((v) => v.id === wdId);
          const txId = record?.txId;
          if (!txId) {
            return { state: 'PENDING', context: wdId };
          }
          return { state: 'COMPLETE', transaction_id: txId };
        },
      },
      onEval: async (order) => {
        const checkResult = await getDepositHistory(credential, {
          coin: 'USDT',
          txId: order.current_transaction_id,
        });
        if (checkResult?.[0]?.status !== 1) {
          return { state: 'PENDING' };
        }
        const received_amount = +checkResult[0].amount;
        return { state: 'COMPLETE', received_amount };
      },
    });
  }
})();
