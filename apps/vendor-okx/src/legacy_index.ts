import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { addAccountTransferAddress } from '@yuants/transfer';
import { decodePath, encodePath, formatTime, roundToStep } from '@yuants/utils';
import { defer, filter, firstValueFrom, from, map, mergeMap, repeat, retry, shareReplay } from 'rxjs';
import { accountConfig$, tradingAccountId$ } from './account';
import { client } from './api';
import { productService } from './product';
import { getFundingRate, getInterestRateLoanQuota } from './public-api';
import { spotMarketTickers$ } from './quote';

const terminal = Terminal.fromNodeEnv();

console.info(formatTime(Date.now()), 'Terminal', terminal.terminalInfo.terminal_id);

const resOfAssetCurrencies = defer(() => client.getAssetCurrencies()).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

resOfAssetCurrencies.subscribe(); // make it hot

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

const fundingRate$ = memoizeMap((product_id: string) =>
  defer(() => getFundingRate({ instId: decodePath(product_id)[1] })).pipe(
    mergeMap((x) => x.data),
    repeat({ delay: 5000 }),
    retry({ delay: 5000 }),
    shareReplay(1),
  ),
);

const interestRateLoanQuota$ = defer(() => getInterestRateLoanQuota()).pipe(
  repeat({ delay: 60_000 }),
  retry({ delay: 60_000 }),
  shareReplay(1),
);

const interestRateByCurrency$ = memoizeMap((currency: string) =>
  interestRateLoanQuota$.pipe(
    mergeMap((x) =>
      from(x.data || []).pipe(
        mergeMap((x) => x.basic),
        filter((x) => x.ccy === currency),
        map((x) => +x.rate),
      ),
    ),
    shareReplay(1),
  ),
);

// provideTicks(terminal, 'OKX', (product_id) => {
//   const [instType, instId] = decodePath(product_id);
//   if (instType === 'SWAP') {
//     return defer(async () => {
//       const products = await firstValueFrom(usdtSwapProducts$);
//       const theProduct = products.find((x) => x.product_id === product_id);
//       if (!theProduct) throw `No Found ProductID ${product_id}`;
//       const theTicker$ = swapMarketTickers$.pipe(
//         map((x) => x[instId]),
//         shareReplay(1),
//       );
//       return [of(theProduct), theTicker$, fundingRate$(product_id), swapOpenInterest$] as const;
//     }).pipe(
//       catchError(() => EMPTY),
//       mergeMap((x) =>
//         combineLatest(x).pipe(
//           map(([theProduct, ticker, fundingRate, swapOpenInterest]): ITick => {
//             return {
//               datasource_id: 'OKX',
//               product_id,
//               updated_at: Date.now(),
//               settlement_scheduled_at: +fundingRate.fundingTime,
//               price: +ticker.last,
//               ask: +ticker.askPx,
//               bid: +ticker.bidPx,
//               volume: +ticker.lastSz,
//               interest_rate_for_long: -+fundingRate.fundingRate,
//               interest_rate_for_short: +fundingRate.fundingRate,
//               open_interest: swapOpenInterest.get(instId),
//             };
//           }),
//         ),
//       ),
//     );
//   }
//   if (instType === 'MARGIN') {
//     return defer(async () => {
//       const products = await firstValueFrom(marginProducts$);
//       const theProduct = products.find((x) => x.product_id === product_id);
//       if (!theProduct) throw `No Found ProductID ${product_id}`;
//       const theTicker$ = spotMarketTickers$.pipe(
//         map((x) => x[instId]),
//         shareReplay(1),
//       );
//       return [
//         of(theProduct),
//         theTicker$,
//         interestRateByCurrency$(theProduct.base_currency!),
//         interestRateByCurrency$(theProduct.quote_currency!),
//       ] as const;
//     }).pipe(
//       catchError(() => EMPTY),
//       mergeMap((x) =>
//         combineLatest(x).pipe(
//           map(
//             ([theProduct, ticker, interestRateForBase, interestRateForQuote]): ITick => ({
//               datasource_id: 'OKX',
//               product_id,
//               updated_at: Date.now(),
//               price: +ticker.last,
//               volume: +ticker.lastSz,
//               // 在下一个整点扣除利息 See 如何计算利息 https://www.okx.com/zh-hans/help/how-to-calculate-borrowing-interest
//               settlement_scheduled_at: new Date().setMinutes(0, 0, 0) + 3600_000,
//               interest_rate_for_long: -interestRateForQuote / 24,
//               interest_rate_for_short: -interestRateForBase / 24,
//             }),
//           ),
//         ),
//       ),
//     );
//   }
//   return EMPTY;
// });

defer(async () => {
  const account_config = await firstValueFrom(accountConfig$);
  console.info(formatTime(Date.now()), 'AccountConfig', JSON.stringify(account_config));
  const { mainUid, uid } = account_config.data[0];
  const isMainAccount = mainUid === uid;

  const TRADING_ACCOUNT_ID = `okx/${uid}/trading`;
  const FUNDING_ACCOUNT_ID = `okx/${uid}/funding/USDT`;
  const EARNING_ACCOUNT_ID = `okx/${uid}/earning/USDT`;

  // BLOCK_CHAIN: only available for main account
  if (isMainAccount) {
    const depositAddressRes = await client.getAssetDepositAddress({ ccy: 'USDT' });
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
            const res = await firstValueFrom(resOfAssetCurrencies);
            const theRes = res.data?.find((x) => x.ccy === 'USDT' && x.chain === 'USDT-TRC20');
            const _fee = theRes?.minFee;
            if (!_fee) return { state: 'ERROR', message: 'Currency Info not found, cannot get fee' };
            const fee = +_fee;
            const amt = Math.floor(order.current_amount - fee);
            const transferResult = await client.postAssetWithdrawal({
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
            const withdrawalHistory = await client.getAssetWithdrawalHistory({ wdId });
            const txId = withdrawalHistory.data?.[0]?.txId;
            if (!txId) {
              return { state: 'AWAIT_TX_ID', context: wdId };
            }
            return { state: 'COMPLETE', transaction_id: txId };
          },
        },
        onEval: async (transferOrder) => {
          const checkResult = await client.getAssetDepositHistory({
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
          const transferResult = await client.postAssetTransfer({
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
          const transferResult = await client.postAssetTransfer({
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
          const transferResult = await client.postFinanceSavingsPurchaseRedempt({
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
          const transferResult = await client.postFinanceSavingsPurchaseRedempt({
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
      const subAcctsRes = await client.getSubAccountList();
      for (const item of subAcctsRes.data || []) {
        addAccountTransferAddress({
          terminal,
          account_id: FUNDING_ACCOUNT_ID,
          network_id: getSubAccountNetworkId(item.uid),
          currency: 'USDT',
          address: 'main',
          onApply: {
            INIT: async (order) => {
              const transferResult = await client.postAssetTransfer({
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
            const transferResult = await client.postAssetTransfer({
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

defer(async () => {
  const tradingAccountId = await firstValueFrom(tradingAccountId$);
  terminal.server.provideService<IOrder, { order_id?: string }>(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    async (msg) => {
      console.info(formatTime(Date.now()), 'SubmitOrder', JSON.stringify(msg));
      const order = msg.req;
      const [instType, instId] = decodePath(order.product_id);

      const mapOrderDirectionToSide = (direction?: string) => {
        switch (direction) {
          case 'OPEN_LONG':
          case 'CLOSE_SHORT':
            return 'buy';
          case 'OPEN_SHORT':
          case 'CLOSE_LONG':
            return 'sell';
        }
        throw new Error(`Unknown direction: ${direction}`);
      };
      const mapOrderDirectionToPosSide = (direction?: string) => {
        switch (direction) {
          case 'OPEN_LONG':
          case 'CLOSE_LONG':
            return 'long';
          case 'CLOSE_SHORT':
          case 'OPEN_SHORT':
            return 'short';
        }
        throw new Error(`Unknown direction: ${direction}`);
      };
      const mapOrderTypeToOrdType = (order_type?: string) => {
        switch (order_type) {
          case 'LIMIT':
            return 'limit';
          case 'MARKET':
            return 'market';
          case 'MAKER':
            return 'post_only';
        }
        throw new Error(`Unknown order type: ${order_type}`);
      };

      // 交易数量，表示要购买或者出售的数量。
      // 当币币/币币杠杆以限价买入和卖出时，指交易货币数量。
      // 当币币杠杆以市价买入时，指计价货币的数量。
      // 当币币杠杆以市价卖出时，指交易货币的数量。
      // 对于币币市价单，单位由 tgtCcy 决定
      // 当交割、永续、期权买入和卖出时，指合约张数。
      const mapOrderVolumeToSz = async (order: IOrder) => {
        if (instType === 'SWAP') {
          return order.volume;
        }
        if (instType === 'MARGIN') {
          if (order.order_type === 'LIMIT') {
            return order.volume;
          }
          if (order.order_type === 'MAKER') {
            return order.volume;
          }
          if (order.order_type === 'MARKET') {
            if (order.order_direction === 'OPEN_SHORT' || order.order_direction === 'CLOSE_LONG') {
              return order.volume;
            }
            //
            const price = await firstValueFrom(
              spotMarketTickers$.pipe(
                map((x) =>
                  mapOrderDirectionToPosSide(order.order_direction) === 'long'
                    ? +x[instId].askPx
                    : +x[instId].bidPx,
                ),
              ),
            );
            if (!price) {
              throw new Error(`invalid tick: ${price}`);
            }
            console.info(formatTime(Date.now()), 'SubmitOrder', 'price', price);
            const theProduct = await firstValueFrom(
              productService.mapProductIdToProduct$.pipe(map((x) => x.get(order.product_id))),
            );
            if (!theProduct) {
              throw new Error(`Unknown product: ${order.position_id}`);
            }
            return roundToStep(order.volume * price, theProduct.volume_step!);
          }

          return 0;
        }

        if (instType === 'SPOT') {
          return order.volume;
        }

        throw new Error(`Unknown instType: ${instType}`);
      };

      const params = {
        instId,
        tdMode: instType === 'SPOT' ? 'cash' : 'cross',
        side: mapOrderDirectionToSide(order.order_direction),
        posSide:
          instType === 'MARGIN' || instType === 'SPOT'
            ? 'net'
            : mapOrderDirectionToPosSide(order.order_direction),
        ordType: mapOrderTypeToOrdType(order.order_type),
        sz: (await mapOrderVolumeToSz(order)).toString(),
        tgtCcy: instType === 'SPOT' && order.order_type === 'MARKET' ? 'base_ccy' : undefined,
        reduceOnly:
          instType === 'MARGIN' && ['CLOSE_LONG', 'CLOSE_SHORT'].includes(order.order_direction ?? '')
            ? 'true'
            : undefined,
        px:
          order.order_type === 'LIMIT' || order.order_type === 'MAKER' ? order.price!.toString() : undefined,
        ccy: instType === 'MARGIN' ? 'USDT' : undefined,
      };
      console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));
      const res = await client.postTradeOrder(params);
      if (res.code === '0' && res.data?.[0]?.ordId) {
        return {
          res: {
            code: 0,
            message: 'OK',
            data: {
              order_id: res.data[0].ordId,
            },
          },
        };
      }
      return { res: { code: +res.code, message: res.msg } };
    },
  );

  terminal.server.provideService<IOrder>(
    'ModifyOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    async (msg) => {
      console.info(formatTime(Date.now()), 'ModifyOrder', JSON.stringify(msg));
      const order = msg.req;
      const [instType, instId] = decodePath(order.product_id);

      const params: any = {
        instId,
        ordId: order.order_id, // 使用现有订单ID
      };

      // 如果需要修改价格
      if (order.price !== undefined) {
        params.newPx = order.price.toString();
      }

      // 如果需要修改数量
      if (order.volume !== undefined) {
        // 处理数量修改，类似于 SubmitOrder 中的逻辑
        if (instType === 'SWAP') {
          params.newSz = order.volume.toString();
        } else if (instType === 'SPOT') {
          params.newSz = order.volume.toString();
        } else if (instType === 'MARGIN') {
          if (order.order_type === 'LIMIT') {
            params.newSz = order.volume.toString();
          }
          if (order.order_type === 'MAKER') {
            params.newSz = order.volume.toString();
          }
          if (order.order_type === 'MARKET') {
            // 对于市价单，可能需要根据当前价格计算新的数量
            const price = await firstValueFrom(
              spotMarketTickers$.pipe(
                map((x) =>
                  order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT'
                    ? +x[instId].askPx
                    : +x[instId].bidPx,
                ),
              ),
            );
            if (!price) {
              throw new Error(`invalid tick: ${price}`);
            }
            console.info(formatTime(Date.now()), 'ModifyOrder', 'price', price);
            const theProduct = await firstValueFrom(
              productService.mapProductIdToProduct$.pipe(map((x) => x.get(order.product_id))),
            );
            if (!theProduct) {
              throw new Error(`Unknown product: ${order.position_id}`);
            }
            params.newSz = roundToStep(order.volume * price, theProduct.volume_step!).toString();
          }
        } else {
          throw new Error(`Unknown instType: ${instType}`);
        }
      }

      console.info(formatTime(Date.now()), 'ModifyOrder', 'params', JSON.stringify(params));

      const res = await client.postTradeAmendOrder(params);
      if (res.code !== '0') {
        return {
          res: {
            code: +res.code,
            message: res.msg,
          },
        };
      }

      return { res: { code: 0, message: 'OK' } };
    },
  );

  terminal.server.provideService<IOrder>(
    'CancelOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    (msg) =>
      defer(async () => {
        const order = msg.req;
        const [instType, instId] = decodePath(order.product_id);
        const res = await client.postTradeCancelOrder({
          instId,
          ordId: order.order_id,
        });
        if (res.code !== '0') {
          return { res: { code: +res.code, message: res.msg } };
        }
        return { res: { code: 0, message: 'OK' } };
      }),
  );
}).subscribe();
