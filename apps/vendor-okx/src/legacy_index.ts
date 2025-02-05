import {
  IAccountInfo,
  IAccountMoney,
  IOrder,
  IPosition,
  IProduct,
  ITick,
  decodePath,
  encodePath,
  formatTime,
  getDataRecordWrapper,
} from '@yuants/data-model';
import {
  addAccountTransferAddress,
  provideAccountInfo,
  provideTicks,
  writeDataRecords,
} from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import { roundToStep } from '@yuants/utils';
import {
  EMPTY,
  catchError,
  combineLatest,
  defer,
  delayWhen,
  filter,
  firstValueFrom,
  from,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  toArray,
} from 'rxjs';
import { client } from './api';
import { terminal } from './terminal';

const DATASOURCE_ID = 'OKX';

const marketIndexTickerUSDT$ = defer(() => client.getMarketIndexTicker({ quoteCcy: 'USDT' })).pipe(
  map((x) => {
    const mapInstIdToPrice = new Map<string, number>();
    x.data.forEach((inst) => mapInstIdToPrice.set(inst.instId, Number(inst.idxPx)));
    return mapInstIdToPrice;
  }),
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const swapInstruments$ = defer(() => client.getInstruments({ instType: 'SWAP' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const usdtSwapProducts$ = swapInstruments$.pipe(
  mergeMap((x) =>
    from(x.data).pipe(
      filter((x) => x.ctType === 'linear' && x.settleCcy === 'USDT'),
      map(
        (x): IProduct => ({
          datasource_id: DATASOURCE_ID,
          product_id: encodePath(x.instType, x.instId),
          base_currency: x.ctValCcy,
          quote_currency: x.settleCcy,
          value_scale: +x.ctVal,
          volume_step: +x.lotSz,
          price_step: +x.tickSz,
          margin_rate: 1 / +x.lever,
        }),
      ),
      toArray(),
    ),
  ),
  shareReplay(1),
);

const resOfAssetCurrencies = defer(() => client.getAssetCurrencies()).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

resOfAssetCurrencies.subscribe(); // make it hot

const marginInstruments$ = defer(() => client.getInstruments({ instType: 'MARGIN' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const marginProducts$ = marginInstruments$.pipe(
  mergeMap((x) =>
    from(x.data).pipe(
      //
      map(
        (x): IProduct => ({
          datasource_id: DATASOURCE_ID,
          product_id: encodePath(x.instType, x.instId),
          base_currency: x.baseCcy,
          quote_currency: x.quoteCcy,
          value_scale: 1,
          volume_step: +x.lotSz,
          price_step: +x.tickSz,
          margin_rate: 1 / +x.lever,
        }),
      ),
      toArray(),
    ),
  ),
  shareReplay(1),
);

const mapProductIdToMarginProduct$ = marginProducts$.pipe(
  map((x) => new Map(x.map((x) => [x.product_id, x])), shareReplay(1)),
);

usdtSwapProducts$
  .pipe(
    delayWhen((products) => from(writeDataRecords(terminal, products.map(getDataRecordWrapper('product')!)))),
  )
  .subscribe((products) => {
    console.info(formatTime(Date.now()), 'SWAP Products updated', products.length);
  });

marginProducts$
  .pipe(
    delayWhen((products) => from(writeDataRecords(terminal, products.map(getDataRecordWrapper('product')!)))),
  )
  .subscribe((products) => {
    console.info(formatTime(Date.now()), 'MARGIN Products updated', products.length);
  });

const swapMarketTickers$ = defer(() => client.getMarketTickers({ instType: 'SWAP' })).pipe(
  mergeMap((x) =>
    from(x.data).pipe(
      map((x) => [x.instId, x] as const),
      toArray(),
      map((x) => Object.fromEntries(x)),
    ),
  ),
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const spotMarketTickers$ = defer(() => client.getMarketTickers({ instType: 'SPOT' })).pipe(
  mergeMap((x) =>
    from(x.data).pipe(
      map((x) => [x.instId, x] as const),
      toArray(),
      map((x) => Object.fromEntries(x)),
    ),
  ),
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

const fundingRate$ = memoizeMap((product_id: string) =>
  defer(() => client.getFundingRate({ instId: decodePath(product_id)[1] })).pipe(
    mergeMap((x) => x.data),
    repeat({ delay: 5000 }),
    retry({ delay: 5000 }),
    shareReplay(1),
  ),
);

const interestRateLoanQuota$ = defer(() => client.getInterestRateLoanQuota()).pipe(
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

const swapOpenInterest$ = defer(() => client.getOpenInterest({ instType: 'SWAP' })).pipe(
  map((x) => new Map(x.data.map((x) => [x.instId, +x.oi] as const))),

  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

provideTicks(terminal, 'OKX', (product_id) => {
  const [instType, instId] = decodePath(product_id);
  if (instType === 'SWAP') {
    return defer(async () => {
      const products = await firstValueFrom(usdtSwapProducts$);
      const theProduct = products.find((x) => x.product_id === product_id);
      if (!theProduct) throw `No Found ProductID ${product_id}`;
      const theTicker$ = swapMarketTickers$.pipe(
        map((x) => x[instId]),
        shareReplay(1),
      );
      return [of(theProduct), theTicker$, fundingRate$(product_id), swapOpenInterest$] as const;
    }).pipe(
      catchError(() => EMPTY),
      mergeMap((x) =>
        combineLatest(x).pipe(
          map(([theProduct, ticker, fundingRate, swapOpenInterest]): ITick => {
            return {
              datasource_id: DATASOURCE_ID,
              product_id,
              updated_at: Date.now(),
              settlement_scheduled_at: +fundingRate.fundingTime,
              price: +ticker.last,
              ask: +ticker.askPx,
              bid: +ticker.bidPx,
              volume: +ticker.lastSz,
              interest_rate_for_long: -+fundingRate.fundingRate,
              interest_rate_for_short: +fundingRate.fundingRate,
              open_interest: swapOpenInterest.get(instId),
            };
          }),
        ),
      ),
    );
  }
  if (instType === 'MARGIN') {
    return defer(async () => {
      const products = await firstValueFrom(marginProducts$);
      const theProduct = products.find((x) => x.product_id === product_id);
      if (!theProduct) throw `No Found ProductID ${product_id}`;
      const theTicker$ = spotMarketTickers$.pipe(
        map((x) => x[instId]),
        shareReplay(1),
      );
      return [
        of(theProduct),
        theTicker$,
        interestRateByCurrency$(theProduct.base_currency!),
        interestRateByCurrency$(theProduct.quote_currency!),
      ] as const;
    }).pipe(
      catchError(() => EMPTY),
      mergeMap((x) =>
        combineLatest(x).pipe(
          map(
            ([theProduct, ticker, interestRateForBase, interestRateForQuote]): ITick => ({
              datasource_id: DATASOURCE_ID,
              product_id,
              updated_at: Date.now(),
              price: +ticker.last,
              volume: +ticker.lastSz,
              // 在下一个整点扣除利息 See 如何计算利息 https://www.okx.com/zh-hans/help/how-to-calculate-borrowing-interest
              settlement_scheduled_at: new Date().setMinutes(0, 0, 0) + 3600_000,
              interest_rate_for_long: -interestRateForQuote / 24,
              interest_rate_for_short: -interestRateForBase / 24,
            }),
          ),
        ),
      ),
    );
  }
  return EMPTY;
});

const accountPosition$ = defer(() => client.getAccountPositions({})).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const accountConfig$ = defer(() => client.getAccountConfig()).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const subAccountUids$ = defer(() => client.getSubAccountList()).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const accountUid$ = accountConfig$.pipe(
  map((x) => x.data[0].uid),
  filter((x) => !!x),
  shareReplay(1),
);

const accountBalance$ = defer(() => client.getAccountBalance({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const accountUsdtBalance$ = accountBalance$.pipe(
  map((x) => x.data[0]?.details.find((x) => x.ccy === 'USDT')),
  filter((x): x is Exclude<typeof x, undefined> => !!x),
  shareReplay(1),
);

const pendingOrders$ = defer(() => client.getTradeOrdersPending({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

export const mapProductIdToUsdtSwapProduct$ = usdtSwapProducts$.pipe(
  map((x) => new Map(x.map((x) => [x.product_id, x]))),
  shareReplay(1),
);

const tradingAccountInfo$ = combineLatest([
  accountUid$,
  accountBalance$,
  accountPosition$,
  pendingOrders$,
  mapProductIdToUsdtSwapProduct$,
  mapProductIdToMarginProduct$,
  marketIndexTickerUSDT$,
]).pipe(
  map(
    ([
      uid,
      balanceApi,
      positionsApi,
      orders,
      mapProductIdToUsdtSwapProduct,
      mapProductIdToMarginProduct,
      marketIndexTickerUSDT,
    ]): IAccountInfo => {
      const account_id = `okx/${uid}/trading`;
      const money: IAccountMoney = { currency: 'USDT', equity: 0, balance: 0, used: 0, free: 0, profit: 0 };
      const positions: IPosition[] = [];

      balanceApi.data[0]?.details.forEach((detail) => {
        if (detail.ccy === 'USDT') {
          const balance = +(detail.cashBal ?? 0);
          const free = Math.min(
            balance, // free should no more than balance if there is much profits
            +(detail.availEq ?? 0),
          );
          const equity = +(detail.eq ?? 0);
          const used = equity - free;
          const profit = equity - balance;
          money.equity += equity;
          money.balance += balance;
          money.used += used;
          money.free += free;
          money.profit += profit;
        } else {
          const volume = +(detail.cashBal ?? 0);
          const free_volume = Math.min(
            volume, // free should no more than balance if there is much profits
            +(detail.availEq ?? 0),
          );
          const closable_price = marketIndexTickerUSDT.get(detail.ccy + '-USDT') || 0;
          const delta_equity = volume * closable_price || 0;
          const delta_profit = +detail.totalPnl || 0;
          const delta_balance = delta_equity - delta_profit;
          const delta_used = delta_equity; // all used
          const delta_free = 0;

          const product_id = encodePath('SPOT', `${detail.ccy}-USDT`);
          positions.push({
            position_id: product_id,
            datasource_id: DATASOURCE_ID,
            product_id: product_id,
            direction: 'LONG',
            volume: volume,
            free_volume: free_volume,
            position_price: +detail.accAvgPx,
            floating_profit: delta_profit,
            closable_price: closable_price,
            valuation: delta_equity,
          });

          money.equity += delta_equity;
          money.profit += delta_profit;
          money.balance += delta_balance;
          money.used += delta_used;
          money.free += delta_free;
        }
      });
      positionsApi.data.forEach((x) => {
        const direction =
          x.posSide === 'long' ? 'LONG' : x.posSide === 'short' ? 'SHORT' : +x.pos > 0 ? 'LONG' : 'SHORT';
        const volume = Math.abs(+x.pos);
        const product_id = encodePath(x.instType, x.instId);
        const closable_price = +x.last;
        const valuation =
          x.instType === 'SWAP'
            ? (mapProductIdToUsdtSwapProduct.get(product_id)?.value_scale ?? 1) * volume * closable_price
            : x.instType === 'MARGIN'
            ? (mapProductIdToMarginProduct.get(product_id)?.value_scale ?? 1) * volume * closable_price
            : 0;

        positions.push({
          position_id: x.posId,
          datasource_id: DATASOURCE_ID,
          product_id,
          direction,
          volume: volume,
          free_volume: +x.availPos,
          closable_price,
          position_price: +x.avgPx,
          floating_profit: +x.upl,
          valuation,
        });
      });
      return {
        account_id: account_id,
        updated_at: Date.now(),
        money: money,
        currencies: [money],
        positions: positions,
        orders: orders.data.map((x): IOrder => {
          const order_type = x.ordType === 'market' ? 'MARKET' : x.ordType === 'limit' ? 'LIMIT' : 'UNKNOWN';

          const order_direction =
            x.side === 'buy'
              ? x.posSide === 'long'
                ? 'OPEN_LONG'
                : 'CLOSE_SHORT'
              : x.posSide === 'short'
              ? 'OPEN_SHORT'
              : 'CLOSE_LONG';
          return {
            order_id: x.ordId,
            account_id,
            product_id: encodePath(x.instType, x.instId),
            submit_at: +x.cTime,
            filled_at: +x.fillTime,
            order_type,
            order_direction,
            volume: +x.sz,
            traded_volume: +x.accFillSz,
            price: +x.px,
            traded_price: +x.avgPx,
          };
        }),
      };
    },
  ),
  shareReplay(1),
);

provideAccountInfo(terminal, tradingAccountInfo$);

const assetBalance$ = defer(() => client.getAssetBalances({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const fundingAccountInfo$ = combineLatest([accountUid$, assetBalance$, marketIndexTickerUSDT$]).pipe(
  map(([uid, assetBalances, marketIndexTickerUSDT]): IAccountInfo => {
    const money: IAccountMoney = { currency: 'USDT', equity: 0, balance: 0, used: 0, free: 0, profit: 0 };
    const positions: IPosition[] = [];

    assetBalances.data.forEach((x) => {
      if (x.ccy === 'USDT') {
        money.equity += +x.bal;
        money.balance += +x.bal;
        money.free += +x.bal;
      } else {
        const price = marketIndexTickerUSDT.get(x.ccy + '-USDT') || 0;
        const productId = encodePath('SPOT', `${x.ccy}-USDT`);
        const valuation = price * +x.bal || 0;
        positions.push({
          datasource_id: DATASOURCE_ID,
          position_id: productId,
          product_id: productId,
          direction: 'LONG',
          volume: +x.bal,
          free_volume: +x.bal,
          position_price: price,
          floating_profit: 0,
          closable_price: price,
          valuation: valuation,
        });

        money.equity += valuation;
        money.balance += valuation;
        money.used += valuation;
      }
    });

    return {
      account_id: `okx/${uid}/funding/USDT`,
      updated_at: Date.now(),
      money: money,
      currencies: [money],
      positions: positions,
      orders: [],
    };
  }),
  shareReplay(1),
);

provideAccountInfo(terminal, fundingAccountInfo$);

const savingBalance$ = defer(() => client.getFinanceSavingsBalance({})).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const earningAccountInfo$ = combineLatest([accountUid$, savingBalance$]).pipe(
  map(([uid, offers]): IAccountInfo => {
    const equity = offers.data.filter((x) => x.ccy === 'USDT').reduce((acc, x) => acc + +x.amt, 0);
    const balance = equity;
    const free = equity;
    const used = 0;
    const profit = 0;

    const money: IAccountMoney = {
      currency: 'USDT',
      equity,
      balance,
      used,
      free,
      profit,
    };
    return {
      account_id: `okx/${uid}/earning/USDT`,
      updated_at: Date.now(),
      money: money,
      currencies: [money],
      positions: [],
      orders: [],
    };
  }),
  shareReplay(1),
);

provideAccountInfo(terminal, earningAccountInfo$);

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
    if (addresses.length !== 0) {
      await writeDataRecords(terminal, [
        getDataRecordWrapper('transfer_network_info')!({
          network_id: 'TRC20',
          commission: 1,
          currency: 'USDT',
          timeout: 1800_000,
        }),
      ]);
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
  const tradingAccountInfo = await firstValueFrom(tradingAccountInfo$);
  terminal.provideService(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountInfo.account_id },
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
              mapProductIdToMarginProduct$.pipe(map((x) => x.get(order.product_id))),
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
        px: order.order_type === 'LIMIT' ? order.price!.toString() : undefined,
        ccy: instType === 'MARGIN' ? 'USDT' : undefined,
      };
      console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));
      const res = await client.postTradeOrder(params);
      if (res.code !== '0') {
        return { res: { code: +res.code, message: res.msg } };
      }
      return { res: { code: 0, message: 'OK' } };
    },
  );

  terminal.provideService(
    'CancelOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountInfo.account_id },
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
