// import { Terminal } from '@yuants/protocol';
// import { addAccountTransferAddress } from '@yuants/transfer';
// import { formatTime } from '@yuants/utils';
// import {
//   getDepositAddress,
//   getDepositHistory,
//   getSubAccountList,
//   getWithdrawalHistory,
//   ICredential,
//   postWalletTransfer,
//   postWithdrawals,
// } from '../api/private-api';
// import { resolveAccountProfile } from './accounts/profile';
// import { getDefaultCredential } from './default-credential';

// const credential = getDefaultCredential();

// const registerInternalTransfer = (
//   terminal: Terminal,
//   credential: ICredential,
//   accountId: string,
//   direction: 'spot_to_future' | 'future_to_spot',
//   network_id: string,
// ) => {
//   const params =
//     direction === 'spot_to_future'
//       ? {
//           account_id: accountId,
//           from: 'spot',
//           to: 'futures',
//           address: 'SPOT',
//         }
//       : {
//           account_id: accountId,
//           from: 'futures',
//           to: 'spot',
//           address: 'USDT_FUTURE',
//         };

//   addAccountTransferAddress({
//     terminal,
//     account_id: params.account_id,
//     network_id,
//     currency: 'USDT',
//     address: params.address,
//     onApply: {
//       INIT: async (order) => {
//         const transferResult = await postWalletTransfer(credential, {
//           currency: 'USDT',
//           from: params.from,
//           to: params.to,
//           amount: `${order.current_amount}`,
//           settle: 'usdt',
//         });
//         if (transferResult.tx_id !== undefined) {
//           return { state: 'COMPLETE', transaction_id: transferResult.tx_id };
//         }
//         return { state: 'INIT', message: JSON.stringify(transferResult) };
//       },
//     },
//     onEval: async (transferOrder) => ({
//       state: 'COMPLETE',
//       received_amount: transferOrder.current_amount,
//     }),
//   });
// };

// if (credential) {
//   (async () => {
//     const terminal = Terminal.fromNodeEnv();
//     const accountIds = await resolveAccountProfile(credential);
//     const ACCOUNT_INTERNAL_NETWORK_ID = `Gate/${accountIds.uid}/ACCOUNT_INTERNAL`;

//     registerInternalTransfer(
//       terminal,
//       credential,
//       accountIds.future,
//       'future_to_spot',
//       ACCOUNT_INTERNAL_NETWORK_ID,
//     );

//     const subAccountsResult = await getSubAccountList(credential, { type: '0' });
//     const isMainAccount = Array.isArray(subAccountsResult);
//     if (isMainAccount) {
//       const depositAddressRes = await getDepositAddress(credential, { currency: 'USDT' });
//       console.info(formatTime(Date.now()), 'DepositAddress', JSON.stringify(depositAddressRes));
//       const addresses = depositAddressRes.multichain_addresses.filter((item) => item.chain === 'TRX');
//       for (const address of addresses) {
//         addAccountTransferAddress({
//           terminal,
//           account_id: accountIds.spot,
//           network_id: 'TRC20',
//           currency: 'USDT',
//           address: address.address,
//           onApply: {
//             INIT: async (transferOrder) => {
//               const transferResult = await postWithdrawals(credential, {
//                 amount: `${transferOrder.current_amount}`,
//                 currency: 'USDT',
//                 address: transferOrder.current_rx_address!,
//                 chain: 'TRX',
//               });
//               const { txid, withdraw_order_id } = transferResult;
//               if (txid && txid.length > 0) {
//                 return { state: 'COMPLETE', transaction_id: txid };
//               }
//               return { state: 'PENDING', context: withdraw_order_id };
//             },
//             PENDING: async (transferOrder) => {
//               const wdId = transferOrder.current_tx_context;
//               const withdrawalRecordsResult = await getWithdrawalHistory(credential, {});
//               const withdrawalRecord = withdrawalRecordsResult.find(
//                 (item) => item.withdraw_order_id === wdId,
//               );
//               if (withdrawalRecord && withdrawalRecord.txid && withdrawalRecord.txid.length > 0) {
//                 return { state: 'COMPLETE', transaction_id: withdrawalRecord.txid };
//               }
//               return { state: 'PENDING', context: wdId };
//             },
//           },
//           onEval: async (transferOrder) => {
//             const checkResult = await getDepositHistory(credential, { currency: 'USDT' });
//             const depositRecord = checkResult.find(
//               (item) => item.txid === transferOrder.current_transaction_id,
//             );
//             if (depositRecord && depositRecord.status === 'DONE') {
//               return { state: 'COMPLETE', received_amount: Number(depositRecord.amount) };
//             }
//             return { state: 'PENDING' };
//           },
//         });
//       }
//     }
//   })().catch((error) => {
//     console.error(formatTime(Date.now()), 'GateTransferInitFailed', error);
//   });
// }
