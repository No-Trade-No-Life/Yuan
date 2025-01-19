import {
  IAccountInfo,
  IAccountMoney,
  IDataRecordTypes,
  IOrder,
  IPeriod,
  IPosition,
  IProduct,
  ITick,
  UUID,
  decodePath,
  encodePath,
  formatTime,
  getDataRecordWrapper,
} from '@yuants/data-model';
import {
  Terminal,
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
  interval,
  lastValueFrom,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  tap,
  timer,
  toArray,
} from 'rxjs';
import { OkxClient } from './api';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `okx/${UUID()}`,
  name: 'OKX',
});

const DATASOURCE_ID = 'OKX';

const client = new OkxClient({
  auth: process.env.PUBLIC_ONLY
    ? undefined
    : {
        public_key: process.env.ACCESS_KEY!,
        secret_key: process.env.SECRET_KEY!,
        passphrase: process.env.PASSPHRASE!,
      },
});

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
          product_id: encodePath(DATASOURCE_ID, x.instType, x.instId),
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
          product_id: encodePath(DATASOURCE_ID, x.instType, x.instId),
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

const mapProductIdToUsdtSwapProduct$ = usdtSwapProducts$.pipe(
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
]).pipe(
  map(
    ([
      uid,
      balanceApi,
      positions,
      orders,
      mapProductIdToUsdtSwapProduct,
      mapProductIdToMarginProduct,
    ]): IAccountInfo => {
      const usdtBalance = balanceApi.data[0]?.details.find((x) => x.ccy === 'USDT');
      const equity = +(usdtBalance?.eq ?? 0);
      const balance = +(usdtBalance?.cashBal ?? 0);
      const free = Math.min(
        balance, // free should no more than balance if there is much profits
        +(usdtBalance?.availEq ?? 0),
      );
      const used = equity - free;
      // const used = +usdtBalance.frozenBal;
      const profit = equity - balance;

      const account_id = `okx/${uid}/trading`;
      const money: IAccountMoney = {
        currency: 'USDT',
        equity: equity,
        balance: balance,
        used,
        free,
        profit,
      };
      return {
        account_id: account_id,
        updated_at: Date.now(),
        money: money,
        currencies: [money],
        positions: positions.data.map((x): IPosition => {
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

          return {
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
            // margin: +x.posCcy,
            // liquidation_price: +x.liqPx,
            // leverage: +x.lever,
            // margin_rate: 1 / +x.lever,
          };
        }),
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

const fundingAccountInfo$ = combineLatest([accountUid$, assetBalance$]).pipe(
  map(([uid, assetBalances]): IAccountInfo => {
    const equity = +(assetBalances.data.find((x) => x.ccy === 'USDT')?.bal ?? '') || 0;
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
      account_id: `okx/${uid}/funding/USDT`,
      updated_at: Date.now(),
      money: money,
      currencies: [money],
      positions: [],
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
    (msg) =>
      defer(async () => {
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
          throw new Error(`Unknown instType: ${instType}`);
        };

        const params = {
          instId,
          tdMode: 'cross',
          side: mapOrderDirectionToSide(order.order_direction),
          posSide: instType === 'MARGIN' ? 'net' : mapOrderDirectionToPosSide(order.order_direction),
          ordType: mapOrderTypeToOrdType(order.order_type),
          sz: (await mapOrderVolumeToSz(order)).toString(),
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
      }),
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

  terminal.provideService(
    'CopyDataRecords',
    {
      anyOf: [
        {
          required: ['type', 'tags'],
          properties: {
            type: { const: 'funding_rate' },
            tags: {
              type: 'object',
              required: ['series_id'],
              properties: {
                series_id: { type: 'string', pattern: '^OKX/' },
              },
            },
          },
        },
        {
          required: ['type', 'tags'],
          properties: {
            type: { const: 'period' },
            tags: {
              type: 'object',
              required: ['datasource_id'],
              properties: {
                datasource_id: {
                  const: DATASOURCE_ID,
                },
              },
            },
          },
        },
      ],
    },
    (msg, output$) => {
      const sub = interval(5000).subscribe(() => {
        output$.next({});
      });
      return defer(async () => {
        if (msg.req.type === 'funding_rate') {
          if (msg.req.tags?.series_id === undefined) {
            return { res: { code: 400, message: 'series_id is required' } };
          }
          const [start, end] = msg.req.time_range || [0, Date.now()];
          const [datasource_id, product_id] = decodePath(msg.req.tags.series_id);
          const mapProductIdToUsdtSwapProduct = await firstValueFrom(mapProductIdToUsdtSwapProduct$);
          const theProduct = mapProductIdToUsdtSwapProduct.get(product_id);
          if (!theProduct) {
            return { res: { code: 404, message: `product_id ${product_id} not found` } };
          }
          const { base_currency, quote_currency } = theProduct;
          const [instType, instId] = decodePath(product_id);
          if (!base_currency || !quote_currency) {
            return { res: { code: 400, message: `base_currency or quote_currency is required` } };
          }
          const funding_rate_history: IDataRecordTypes['funding_rate'][] = [];
          let current_end = end;
          while (true) {
            client.getFundingRateHistory;
            const res = await client.getFundingRateHistory({
              instId: instId,
              after: `${current_end}`,
            });
            if (res.code !== '0') {
              return { res: { code: +res.code, message: res.msg } };
            }
            if (res.data.length === 0) {
              break;
            }
            for (const v of res.data) {
              funding_rate_history.push({
                series_id: msg.req.tags.series_id,
                product_id,
                datasource_id,
                base_currency,
                quote_currency,
                funding_rate: +v.fundingRate,
                funding_at: +v.fundingTime,
              });
            }
            current_end = +res.data[res.data.length - 1].fundingTime;
            if (current_end <= start) {
              break;
            }
            await firstValueFrom(timer(1000));
          }
          funding_rate_history.sort((a, b) => +a.funding_at - +b.funding_at);
          // there will be at most 300 records, so we don't need to chunk it by bufferCount
          await writeDataRecords(terminal, funding_rate_history.map(getDataRecordWrapper('funding_rate')!));
          return { res: { code: 0, message: 'OK' } };
        }

        if (msg.req.type === 'period') {
          const { period_in_sec, product_id = '', datasource_id } = msg.req.tags || {};
          if (!product_id) {
            return { res: { code: 400, message: 'product_id is required' } };
          }
          if (!period_in_sec) {
            return { res: { code: 400, message: 'period_in_sec is required' } };
          }
          if (!datasource_id) {
            return { res: { code: 400, message: 'datasource_id is required' } };
          }
          const [instType, instId] = decodePath(product_id);
          if (!instId) {
            console.error(formatTime(Date.now()));
            return { res: { code: 400, message: `invalid product_id: ${product_id}` } };
          }
          // 时间粒度，默认值1m
          // 如 [1m/3m/5m/15m/30m/1H/2H/4H]
          // 香港时间开盘价k线：[6H/12H/1D/1W/1M]
          // UTC时间开盘价k线：[6Hutc/12Hutc/1Dutc/1Wutc/1Mutc]
          const bar = {
            60: '1m',
            180: '3m',
            300: '5m',
            900: '15m',
            1800: '30m',
            3600: '1H',
            7200: '2H',
            14400: '4H',
            21600: '6H',
            43200: '12H',
            86400: '1D',
            604800: '1W',
            2592000: '1M',
          }[period_in_sec];
          if (!bar) {
            return { res: { code: 400, message: 'unsupported period_in_sec' } };
          }
          const [startTime, endTime] = msg.req.time_range || [0, Date.now()];
          const before = `${Math.max(0, startTime - 1)}`;
          const after = `${Math.min(endTime, startTime + 100 * (+period_in_sec * 1000))}`;

          const res = await client.getHistoryMarkPriceCandles({ instId, bar, before, after, limit: '100' });
          const mapResDataToIPeriod = (
            x: [ts: string, o: string, h: string, l: string, c: string, confirm: string],
          ): IPeriod => ({
            product_id,
            datasource_id,
            duration: {
              60: 'PT1M',
              180: 'PT3M',
              300: 'PT5M',
              900: 'PT15M',
              1800: 'PT30M',
              3600: 'PT1H',
              7200: 'PT2H',
              14400: 'PT4H',
              21600: 'PT6H',
              43200: 'PT12H',
              86400: 'P1D',
              604800: 'P1W',
              2592000: 'P1M',
            }[period_in_sec],
            period_in_sec: +period_in_sec,
            timestamp_in_us: +x[0] * 1000,
            open: +x[1],
            high: +x[2],
            low: +x[3],
            close: +x[4],
            //
            volume: 0,
          });
          if (res.data.length > 0 && res.data.length < 100) {
            // data is complete
            const dataRecords = res.data.map(mapResDataToIPeriod).map(getDataRecordWrapper('period')!);
            await writeDataRecords(terminal, dataRecords);
            return { res: { code: 0, message: 'OK' } };
          }

          let currentStartTime: number;
          if (res.data.length === 0) {
            // startTime too early
            // binary search
            const findActualStartTimeRange = async (startTime: number, endTime: number): Promise<number> => {
              if (endTime - startTime <= +period_in_sec * 1000) {
                // cannot find anyway.
                return startTime;
              }
              const middle = Math.floor((startTime + endTime) / 2);
              const before = `${Math.max(0, middle - 1)}`;
              const after = `${Math.min(endTime, middle + 100 * (+period_in_sec * 1000))}`;
              const res = await client.getHistoryMarkPriceCandles({
                instId,
                bar,
                before,
                after,
                limit: '100',
              });
              console.info(formatTime(Date.now()), startTime, middle, endTime, res.data.length);
              if (res.data.length === 0) {
                // startTime too early
                return findActualStartTimeRange(middle, endTime);
              }
              if (res.data.length === 100) {
                // startTime too late
                return findActualStartTimeRange(startTime, middle);
              }
              // hit!
              return middle;
            };
            currentStartTime = await findActualStartTimeRange(startTime, endTime);
          } else {
            // need load more
            currentStartTime = startTime;
          }

          while (true) {
            const before = `${Math.max(0, currentStartTime - 1)}`;
            const after = `${Math.min(endTime, currentStartTime + 100 * (+period_in_sec * 1000))}`;
            const res = await client.getHistoryMarkPriceCandles({ instId, bar, before, after, limit: '100' });
            if (res.code !== '0') {
              return { res: { code: +res.code, message: res.msg } };
            }
            if (res.data.length === 0) {
              break;
            }
            currentStartTime = +after;
            if (currentStartTime >= endTime) {
              break;
            }
            const data = res.data.map(mapResDataToIPeriod).map(getDataRecordWrapper('period')!);
            await writeDataRecords(terminal, data);
            await firstValueFrom(timer(1000));
          }
          return { res: { code: 0, message: 'OK' } };
        }

        return { res: { code: 400, message: 'unreached code routine' } };
      }).pipe(
        //
        tap({
          finalize: () => {
            console.info(
              formatTime(Date.now()),
              `CopyDataRecords`,
              `series_id=${msg.req.tags?.series_id} finalized`,
            );
            sub.unsubscribe();
          },
        }),
      );
    },
    { concurrent: 10 },
  );
}).subscribe();
