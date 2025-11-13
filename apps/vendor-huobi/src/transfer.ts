import { Terminal } from '@yuants/protocol';
import { addAccountTransferAddress } from '@yuants/transfer';
import {
  getDepositWithdrawHistory,
  getSpotAccountDepositAddresses,
  getV2ReferenceCurrencies,
  ICredential,
  postSpotAccountTransfer,
  postSubUserTransfer,
  postSuperMarginAccountTransferIn,
  postSuperMarginAccountTransferOut,
  postWithdraw,
} from './api/private-api';

/**
 * 设置 TRC20 USDT 提现地址
 */
export const setupTrc20WithdrawalAddresses = async (
  terminal: Terminal,
  spotAccountId: string,
  credential: ICredential,
  isMainAccount: boolean,
) => {
  if (!isMainAccount) {
    return;
  }

  const res = await getSpotAccountDepositAddresses(credential, { currency: 'usdt' });
  const addresses = res.data.filter((v) => v.chain === 'trc20usdt').map((v) => v.address);

  for (const address of addresses) {
    addAccountTransferAddress({
      terminal,
      account_id: spotAccountId,
      currency: 'USDT',
      address: address,
      network_id: 'TRC20',
      onApply: {
        INIT: async (order) => {
          const res0 = await getV2ReferenceCurrencies(credential, { currency: 'usdt' });
          const fee = res0.data
            .find((v) => v.currency === 'usdt')
            ?.chains.find((v) => v.chain === 'trc20usdt')?.transactFeeWithdraw;
          if (!fee) {
            return { state: 'ERROR', message: 'MISSING FEE' };
          }
          const res = await postWithdraw(credential, {
            address: order.current_rx_address!,
            amount: '' + (order.expected_amount - +fee),
            currency: 'usdt',
            fee: fee,
            chain: 'trc20usdt',
          });
          if (res.status != 'ok') {
            return { state: 'INIT', message: `${res.status}` };
          }
          return { state: 'PENDING', context: `${res.data}` };
        },
        PENDING: async (order) => {
          if (!order.current_tx_context) {
            return { state: 'ERROR', message: 'MISSING CONTEXT' };
          }
          const wdId = +order.current_tx_context;
          const res = await getDepositWithdrawHistory(credential, {
            currency: 'usdt',
            type: 'withdraw',
            from: `${wdId}`,
          });
          const txId = res.data.find((v) => v.id === wdId)?.['tx-hash'];
          if (!txId) {
            return { state: 'PENDING', context: `${wdId}` };
          }
          return {
            state: 'COMPLETE',
            transaction_id: txId,
          };
        },
      },
      onEval: async (order) => {
        const res = await getDepositWithdrawHistory(credential, {
          currency: 'usdt',
          type: 'deposit',
          direct: 'next',
        });

        const theItem = res.data.find(
          (v) => v['tx-hash'] === order.current_transaction_id && v.state === 'safe',
        );
        if (!theItem) {
          return { state: 'PENDING' };
        }
        return { received_amount: +theItem.amount, state: 'COMPLETE' };
      },
    });
  }
};

/**
 * 设置 SPOT 和 SUPER_MARGIN 账户之间的内部转账
 */
export const setupSpotSuperMarginTransfer = (
  terminal: Terminal,
  spotAccountId: string,
  superMarginAccountId: string,
  credential: ICredential,
  huobiUid: number,
) => {
  const networkId = `Huobi/${huobiUid}/SPOT-SUPER_MARGIN`;

  // SPOT -> SUPER_MARGIN
  addAccountTransferAddress({
    terminal,
    account_id: spotAccountId,
    currency: 'USDT',
    network_id: networkId,
    address: 'SPOT',
    onApply: {
      INIT: async (order) => {
        const transferInResult = await postSuperMarginAccountTransferIn(credential, {
          currency: 'usdt',
          amount: '' + (order.current_amount || order.expected_amount),
        });
        if (transferInResult.status !== 'ok') {
          return { state: 'INIT' };
        }
        return { state: 'COMPLETE' };
      },
    },
    onEval: async (order) => {
      return { received_amount: order.current_amount || order.expected_amount, state: 'COMPLETE' };
    },
  });

  // SUPER_MARGIN -> SPOT
  addAccountTransferAddress({
    terminal,
    account_id: superMarginAccountId,
    currency: 'USDT',
    network_id: networkId,
    address: 'SUPER_MARGIN',
    onApply: {
      INIT: async (order) => {
        const transferOutResult = await postSuperMarginAccountTransferOut(credential, {
          currency: 'usdt',
          amount: '' + (order.current_amount || order.expected_amount),
        });
        if (transferOutResult.status !== 'ok') {
          return { state: 'INIT' };
        }
        return { state: 'COMPLETE' };
      },
    },
    onEval: async (order) => {
      return { received_amount: order.current_amount || order.expected_amount, state: 'COMPLETE' };
    },
  });
};

/**
 * 设置 SPOT 和 SWAP 账户之间的内部转账
 */
export const setupSpotSwapTransfer = (
  terminal: Terminal,
  spotAccountId: string,
  swapAccountId: string,
  credential: ICredential,
  huobiUid: number,
) => {
  const networkId = `Huobi/${huobiUid}/SPOT-SWAP`;

  // SPOT -> SWAP
  addAccountTransferAddress({
    terminal,
    account_id: spotAccountId,
    currency: 'USDT',
    network_id: networkId,
    address: 'SPOT',
    onApply: {
      INIT: async (order) => {
        const transferResult = await postSpotAccountTransfer(credential, {
          from: 'spot',
          to: 'linear-swap',
          currency: 'usdt',
          amount: order.current_amount || order.expected_amount,
          'margin-account': 'USDT',
        });
        if (!transferResult.success) {
          return { state: 'INIT' };
        }
        return { state: 'COMPLETE' };
      },
    },
    onEval: async (order) => {
      return { received_amount: order.current_amount || order.expected_amount, state: 'COMPLETE' };
    },
  });

  // SWAP -> SPOT
  addAccountTransferAddress({
    terminal,
    account_id: swapAccountId,
    currency: 'USDT',
    network_id: networkId,
    address: 'SWAP',
    onApply: {
      INIT: async (order) => {
        const transferResult = await postSpotAccountTransfer(credential, {
          from: 'linear-swap',
          to: 'spot',
          currency: 'usdt',
          amount: order.current_amount || order.expected_amount,
          'margin-account': 'USDT',
        });
        if (!transferResult.success) {
          return { state: 'INIT' };
        }
        return { state: 'COMPLETE' };
      },
    },
    onEval: async (order) => {
      return { received_amount: order.current_amount || order.expected_amount, state: 'COMPLETE' };
    },
  });
};

/**
 * 设置子账户转账
 */
export const setupSubAccountTransfers = (
  terminal: Terminal,
  spotAccountId: string,
  credential: ICredential,
  huobiUid: number,
  subAccounts: any[],
  isMainAccount: boolean,
) => {
  if (!isMainAccount) {
    return;
  }

  for (const subAccount of subAccounts) {
    const spotSubAccountId = `huobi/${subAccount.uid}/spot/usdt`;
    const subAccountNetworkId = `Huobi/${huobiUid}/SubAccount/${subAccount.uid}`;

    // 主账户 -> 子账户
    addAccountTransferAddress({
      terminal,
      account_id: spotAccountId,
      currency: 'USDT',
      network_id: subAccountNetworkId,
      address: '#main',
      onApply: {
        INIT: async (order) => {
          const transferResult = await postSubUserTransfer(credential, {
            'sub-uid': +order.current_rx_address!,
            currency: 'usdt',
            amount: order.current_amount || order.expected_amount,
            type: 'master-transfer-out',
          });
          if (transferResult.status !== 'ok') {
            return { state: 'INIT' };
          }
          return { state: 'COMPLETE' };
        },
      },
      onEval: async (order) => {
        return { received_amount: order.current_amount || order.expected_amount, state: 'COMPLETE' };
      },
    });

    // 子账户 -> 主账户
    addAccountTransferAddress({
      terminal,
      account_id: spotSubAccountId,
      currency: 'USDT',
      network_id: subAccountNetworkId,
      address: `${subAccount.uid}`,
      onApply: {
        INIT: async (order) => {
          const transferResult = await postSubUserTransfer(credential, {
            'sub-uid': +order.current_tx_address!,
            currency: 'usdt',
            amount: order.current_amount || order.expected_amount,
            type: 'master-transfer-in',
          });
          if (transferResult.status !== 'ok') {
            return { state: 'INIT' };
          }
          return { state: 'COMPLETE' };
        },
      },
      onEval: async (order) => {
        return { received_amount: order.current_amount || order.expected_amount, state: 'COMPLETE' };
      },
    });
  }
};
