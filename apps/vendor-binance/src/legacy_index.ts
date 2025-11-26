// import { Terminal } from '@yuants/protocol';
// import { addAccountTransferAddress } from '@yuants/transfer';
// import { getDefaultCredential, isApiError } from './api/client';
// import {
//   getDepositAddress,
//   getDepositHistory,
//   getSpotAccountInfo,
//   getSubAccountList,
//   getWithdrawHistory,
//   postAssetTransfer,
//   postWithdraw,
// } from './api/private-api';

// const terminal = Terminal.fromNodeEnv();

// const isPublicOnly = process.env.PUBLIC_ONLY === 'true';

// // provideTicks(terminal, 'binance', (product_id) => {
// //   const [instType, symbol] = decodePath(product_id);
// //   if (instType === 'usdt-future') {
// //     return combineLatest([mapSymbolToFuturePremiumIndex$, mapSymbolToFutureBookTicker$]).pipe(
// //       combineLatestWith(defer(() => getOpenInterest(symbol))),
// //       map(([[mapSymbolToFuturePremiumIndex, mapSymbolToFutureBookTicker], openInterestVolume]): ITick => {
// //         const premiumIndex = mapSymbolToFuturePremiumIndex.get(symbol);
// //         const bookTicker = mapSymbolToFutureBookTicker.get(symbol);
// //         if (!premiumIndex) {
// //           throw new Error(`Premium Index Not Found: ${symbol}`);
// //         }
// //         if (!bookTicker) {
// //           throw new Error(`Book Ticker Not Found: ${symbol}`);
// //         }
// //         return {
// //           datasource_id: 'binance',
// //           product_id,
// //           updated_at: Date.now(),
// //           price: +premiumIndex.markPrice,
// //           ask: +bookTicker.askPrice,
// //           bid: +bookTicker.bidPrice,
// //           interest_rate_for_long: -+premiumIndex.lastFundingRate,
// //           interest_rate_for_short: +premiumIndex.lastFundingRate,
// //           settlement_scheduled_at: premiumIndex.nextFundingTime,
// //           open_interest: openInterestVolume,
// //         };
// //       }),
// //     );
// //   }
// //   return EMPTY;
// // });

// if (isPublicOnly) {
//   console.info('PUBLIC_ONLY=1, skip Binance legacy services');
// } else {
//   const credential = getDefaultCredential();
//   (async () => {
//     const spotAccountInfo = await getSpotAccountInfo(credential);
//     if (isApiError(spotAccountInfo)) {
//       throw new Error(spotAccountInfo.msg);
//     }
//     const uid = spotAccountInfo.uid;

//     const SPOT_ACCOUNT_ID = `binance/${uid}/spot/usdt`;
//     const UNIFIED_ACCOUNT_ID = `binance/${uid}/unified/usdt`;

//     // transfer
//     {
//       // spot -> unified
//       const SPOT_UNIFIED_NETWORK_ID = `binance/${uid}/spot/unified`;
//       addAccountTransferAddress({
//         terminal,
//         account_id: SPOT_ACCOUNT_ID,
//         network_id: SPOT_UNIFIED_NETWORK_ID,
//         currency: 'USDT',
//         address: `unified`,
//         onApply: {
//           INIT: async (order) => {
//             const transferResult = await postAssetTransfer(credential, {
//               type: 'MAIN_PORTFOLIO_MARGIN',
//               asset: 'USDT',
//               amount: order.current_amount!,
//             });
//             if (isApiError(transferResult)) {
//               return { state: 'INIT', message: transferResult.msg };
//             }
//             return { state: 'COMPLETE', transaction_id: '' + transferResult.tranId };
//           },
//         },
//         onEval: async (order) => {
//           return { state: 'COMPLETE', received_amount: order.current_amount };
//         },
//       });

//       // unified -> spot
//       addAccountTransferAddress({
//         terminal,
//         account_id: UNIFIED_ACCOUNT_ID,
//         network_id: SPOT_UNIFIED_NETWORK_ID,
//         currency: 'USDT',
//         address: `spot`,
//         onApply: {
//           INIT: async (order) => {
//             const transferResult = await postAssetTransfer(credential, {
//               type: 'PORTFOLIO_MARGIN_MAIN',
//               asset: 'USDT',
//               amount: order.current_amount!,
//             });
//             if (isApiError(transferResult)) {
//               return { state: 'INIT', message: transferResult.msg };
//             }
//             return { state: 'COMPLETE', transaction_id: '' + transferResult.tranId };
//           },
//         },
//         onEval: async (order) => {
//           return { state: 'COMPLETE', received_amount: order.current_amount };
//         },
//       });

//       const subAccountsResult = await getSubAccountList(credential);
//       const isMain = !isApiError(subAccountsResult);
//       // main -> sub
//       // TODO...

//       // blockchain
//       if (isMain) {
//         const depositAddressResult = await getDepositAddress(credential, { coin: 'USDT', network: 'TRX' });
//         addAccountTransferAddress({
//           terminal,
//           account_id: SPOT_ACCOUNT_ID,
//           network_id: 'TRC20',
//           currency: 'USDT',
//           address: depositAddressResult.address,
//           onApply: {
//             INIT: async (order) => {
//               const transferResult = await postWithdraw(credential, {
//                 coin: 'USDT',
//                 network: 'TRX',
//                 address: order.current_rx_address!,
//                 amount: order.current_amount!,
//               });
//               if (isApiError(transferResult)) {
//                 return { state: 'ERROR', message: transferResult.msg };
//               }
//               const wdId = transferResult.id;
//               return { state: 'PENDING', context: wdId };
//             },
//             PENDING: async (order) => {
//               const wdId = order.current_tx_context;
//               const withdrawResult = await getWithdrawHistory(credential, { coin: 'USDT' });
//               const record = withdrawResult?.find((v) => v.id === wdId);
//               const txId = record?.txId;
//               if (!txId) {
//                 return { state: 'PENDING', context: wdId };
//               }
//               return { state: 'COMPLETE', transaction_id: txId };
//             },
//           },
//           onEval: async (order) => {
//             const checkResult = await getDepositHistory(credential, {
//               coin: 'USDT',
//               txId: order.current_transaction_id,
//             });
//             if (checkResult?.[0]?.status !== 1) {
//               return { state: 'PENDING' };
//             }
//             const received_amount = +checkResult[0].amount;
//             return { state: 'COMPLETE', received_amount };
//           },
//         });
//       }
//     }
//   })();
// }
