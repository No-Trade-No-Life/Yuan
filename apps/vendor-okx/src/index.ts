import {
  IAccountInfo,
  IDataRecord,
  IOrder,
  IPosition,
  IProduct,
  ITick,
  ITransferOrder,
  UUID,
  decodePath,
  encodePath,
  formatTime,
} from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import {
  EMPTY,
  catchError,
  combineLatest,
  concatWith,
  defer,
  delayWhen,
  filter,
  first,
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
  timeout,
  timer,
  toArray,
} from 'rxjs';
import { OkxClient } from './api';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `okx/${UUID()}`,
  name: 'OKX',
});

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
          datasource_id: 'OKX',
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
          datasource_id: 'OKX',
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

usdtSwapProducts$.pipe(delayWhen((products) => terminal.updateProducts(products))).subscribe((products) => {
  console.info(formatTime(Date.now()), 'SWAP Products updated', products.length);
});

marginProducts$.pipe(delayWhen((products) => terminal.updateProducts(products))).subscribe((products) => {
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

terminal.provideTicks('OKX', (product_id) => {
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
      return [of(theProduct), theTicker$, fundingRate$(product_id)] as const;
    }).pipe(
      catchError(() => EMPTY),
      mergeMap((x) =>
        combineLatest(x).pipe(
          map(
            ([theProduct, ticker, fundingRate]): ITick => ({
              datasource_id: 'OKX',
              product_id,
              updated_at: Date.now(),
              settlement_scheduled_at: +fundingRate.fundingTime,
              price: +ticker.last,
              ask: +ticker.askPx,
              bid: +ticker.bidPx,
              volume: +ticker.lastSz,
              interest_rate_for_long: -+fundingRate.fundingRate * theProduct.value_scale! * +ticker.last, // TODO: 结算价
              interest_rate_for_short: +fundingRate.fundingRate * theProduct.value_scale! * +ticker.last, // TODO: 结算价
            }),
          ),
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
              datasource_id: 'OKX',
              product_id,
              updated_at: Date.now(),
              price: +ticker.last,
              volume: +ticker.lastSz,
              // 在下一个整点扣除利息 See 如何计算利息 https://www.okx.com/zh-hans/help/how-to-calculate-borrowing-interest
              settlement_scheduled_at: new Date().setMinutes(0, 0, 0) + 3600_000,
              interest_rate_for_long: (-interestRateForQuote / 24) * +ticker.last, // TODO: 结算价
              interest_rate_for_short: (-interestRateForBase / 24) * +ticker.last, // TODO: 结算价
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
      const free = +(usdtBalance?.availEq ?? 0);
      const used = equity - free;
      // const used = +usdtBalance.frozenBal;
      const profit = equity - balance;

      const account_id = `okx/${uid}/trading`;
      return {
        account_id: account_id,
        timestamp_in_us: Date.now() * 1000,
        updated_at: Date.now(),
        money: {
          currency: 'USDT',
          equity: equity,
          balance: balance,
          used,
          free,
          profit,
        },
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

terminal.provideAccountInfo(tradingAccountInfo$);

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

    return {
      account_id: `okx/${uid}/funding/USDT`,
      timestamp_in_us: Date.now() * 1000,
      updated_at: Date.now(),
      money: {
        currency: 'USDT',
        equity,
        balance,
        used,
        free,
        profit,
      },
      positions: [],
      orders: [],
    };
  }),
  shareReplay(1),
);

terminal.provideAccountInfo(fundingAccountInfo$);

const financeOrders$ = defer(() => client.getFinanceStakingDeFiOrdersActive({})).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const earningAccountInfo$ = combineLatest([accountUid$, financeOrders$]).pipe(
  map(([uid, offers]): IAccountInfo => {
    const equity = offers.data
      .filter((x) => x.ccy === 'USDT')
      .reduce((acc, x) => acc + +x.investData.reduce((acc, x) => acc + +x.amt, 0), 0);
    const balance = equity;
    const free = equity;
    const used = 0;
    const profit = 0;

    return {
      account_id: `okx/${uid}/earning/USDT`,
      timestamp_in_us: Date.now() * 1000,
      updated_at: Date.now(),
      money: {
        currency: 'USDT',
        equity,
        balance,
        used,
        free,
        profit,
      },
      positions: [],
      orders: [],
    };
  }),
  shareReplay(1),
);

terminal.provideAccountInfo(earningAccountInfo$);

defer(async () => {
  const [tradingAccountInfo, fundingAccountInfo, earningAccountInfo] = await firstValueFrom(
    combineLatest([tradingAccountInfo$, fundingAccountInfo$, earningAccountInfo$]),
  );

  terminal.provideService(
    'Transfer',
    {
      oneOf: [
        {
          type: 'object',
          required: ['debit_account_id', 'credit_account_id'],
          properties: {
            debit_account_id: {
              enum: [
                tradingAccountInfo.account_id,
                fundingAccountInfo.account_id,
                earningAccountInfo.account_id,
              ],
            },
            status: {
              const: 'AWAIT_DEBIT',
            },
          },
        },
        {
          type: 'object',
          required: ['debit_account_id', 'credit_account_id'],
          properties: {
            credit_account_id: {
              enum: [
                tradingAccountInfo.account_id,
                fundingAccountInfo.account_id,
                earningAccountInfo.account_id,
              ],
            },
            status: {
              const: 'AWAIT_CREDIT',
            },
          },
        },
      ],
    },
    (msg) =>
      defer(async () => {
        const order = msg.req;

        // Step 1: 我方接收付款，未提供收款方式，等待我方提供收款方式
        if (order.status === 'AWAIT_DEBIT' && !order.debit_methods?.length) {
          console.info(
            formatTime(Date.now()),
            'Transfer',
            order.order_id,
            'Step 1: 我方接收付款，未提供收款方式，等待我方提供收款方式',
          );
          //
          const addressList = await client.getAssetDepositAddress({ ccy: order.currency });
          const routing = addressList.data?.map((x) => encodePath('blockchain', x.chain, x.addr));
          const nextOrder: ITransferOrder = {
            ...order,
            updated_at: Date.now(),
            // default timeout 30 minutes
            timeout_at: order.timeout_at !== undefined ? order.timeout_at : Date.now() + 30 * 60_000,
            debit_methods: routing,
            status: 'AWAIT_CREDIT',
          };
          await updateTransferOrder(nextOrder);
          await firstValueFrom(terminal.requestService('Transfer', nextOrder));
        }

        // Step 2: 对方已经提供若干收款方式，等待我方选择并发起转账
        if (order.status === 'AWAIT_CREDIT' && order.debit_methods?.length) {
          //
          console.info(
            formatTime(Date.now()),
            'Transfer',
            order.order_id,
            'Step 2: 对方已经提供若干收款方式，等待我方选择并发起转账',
            order.debit_methods!.join(';'),
          );

          for (const method of order.debit_methods) {
            const routing = decodePath(method);
            if (order.currency === 'USDT') {
              if (routing[0] === 'blockchain') {
                if (routing[1].match(/USDT/i) && routing[1].match(/TRC20/i)) {
                  // USDT TRC20
                  const address = routing[2];
                  console.info(formatTime(Date.now()), 'Transfer', order.order_id, 'USDT TRC20', address);

                  if (order.credit_account_id === tradingAccountInfo.account_id) {
                    //
                    console.info(
                      formatTime(Date.now()),
                      'Transfer',
                      order.order_id,
                      'from trading account to funding account',
                      address,
                    );
                    const transferResult = await client.postAssetTransfer({
                      type: '0',
                      ccy: 'USDT',
                      amt: `${order.expected_amount + /* 1 as fee */ 1}`,
                      from: '18',
                      to: '6',
                    });

                    if (transferResult.code !== '0') {
                      const nextOrder: ITransferOrder = {
                        ...order,
                        updated_at: Date.now(),
                        status: 'ERROR',
                        error_message: transferResult.msg,
                      };
                      await updateTransferOrder(nextOrder);
                      return { res: { code: +transferResult.code, message: transferResult.msg } };
                    }
                  }

                  const res = await client.postAssetWithdrawal({
                    amt: `${order.expected_amount}`,
                    ccy: order.currency,
                    chain: 'USDT-TRC20',
                    fee: '1',
                    dest: '4',
                    toAddr: address,
                  });
                  if (res.code !== '0') {
                    const nextOrder: ITransferOrder = {
                      ...order,
                      status: 'ERROR',
                      error_message: res.msg,
                      credit_method: method,
                    };
                    await updateTransferOrder(nextOrder);
                    return { res: { code: +res.code, message: res.msg } };
                  }

                  console.info(
                    formatTime(Date.now()),
                    'Transfer',
                    order.order_id,
                    'USDT TRC20',
                    JSON.stringify(res),
                  );

                  if (res.data[0]?.wdId === '') {
                    const nextOrder: ITransferOrder = {
                      ...order,
                      status: 'ERROR',
                      error_message: `No wdId in response`,
                      credit_method: method,
                    };
                    await updateTransferOrder(nextOrder);
                    return { res: { code: 500, message: `${nextOrder.error_message}` } };
                  }

                  // TODO: 查询区块链 Transaction ID
                  const txId = await firstValueFrom(
                    defer(async () => {
                      const wdId = res.data[0]?.wdId;
                      const withdrawalHistory = await client.getAssetWithdrawalHistory({ wdId });
                      return withdrawalHistory.data[0];
                    }).pipe(
                      //
                      tap((v) => {
                        console.info(
                          formatTime(Date.now()),
                          'Transfer',
                          order.order_id,
                          'USDT TRC20',
                          JSON.stringify(v),
                        );
                      }),
                      repeat({ delay: 5000 }),
                      retry({ delay: 5000 }),
                      first((v) => v.txId !== ''),
                      timeout({ each: 120000, meta: `Withdrawal ${res.data[0]?.wdId} Timeout` }),
                      map((v) => v.txId),
                      catchError((err) => of('')),
                      shareReplay(1),
                    ),
                  );

                  if (txId === '') {
                    const nextOrder: ITransferOrder = {
                      ...order,
                      status: 'ERROR',
                      error_message: `No txId found`,
                      credit_method: method,
                    };
                    await updateTransferOrder(nextOrder);
                    return { res: { code: 500, message: `${nextOrder.error_message}` } };
                  }
                  const nextOrder: ITransferOrder = {
                    ...order,
                    status: 'AWAIT_DEBIT',
                    credit_method: method,
                    updated_at: Date.now(),
                    transferred_at: Date.now(),
                    transferred_amount: order.expected_amount,
                    transaction_id: txId,
                  };
                  await updateTransferOrder(nextOrder);
                  await firstValueFrom(terminal.requestService('Transfer', nextOrder));
                  return { res: { code: 0, message: 'OK' } };
                }
              }
            }
          }
        }

        // Step 3: 如果对方已经选择收款方式，已转出，等待我方收款
        if (order.status === 'AWAIT_DEBIT' && order.credit_method) {
          //
          console.info(
            formatTime(Date.now()),
            'Transfer',
            order.order_id,
            'Step 3: 对方已经选择收款方式，已转出，等待我方收款',
          );

          const routing = decodePath(order.credit_method);
          if (order.currency === 'USDT') {
            if (routing[0] === 'blockchain') {
              if (routing[1].match(/USDT/i) && routing[1].match(/TRC20/i)) {
                // NOTE: do we need to query our TRC20 address?
                try {
                  const checkResult = await firstValueFrom(
                    defer(() =>
                      client.getAssetDepositHistory({
                        ccy: 'USDT',
                        txId: order.transaction_id,
                        type: '4',
                      }),
                    ).pipe(
                      mergeMap((v) => {
                        if (v.code !== '0') {
                          throw new Error(v.msg);
                        }
                        return v.data;
                      }),
                      repeat({ delay: 5000 }),
                      retry({ delay: 5000 }),
                      // NOTE: 2: success
                      // FYI: https://www.okx.com/docs-v5/zh/#funding-account-rest-api-get-deposit-history
                      first((v) => v.state === '2'),
                      timeout({
                        each: (order.timeout_at || Date.now() + 600_000) - Date.now(),
                        meta: `Deposit ${order.transaction_id} Timeout`,
                      }),
                    ),
                  );

                  const nextOrder = {
                    ...order,
                    status: 'COMPLETE',
                    received_at: Date.now(),
                    received_amount: +checkResult.amt,
                    updated_at: Date.now(),
                  };
                  await updateTransferOrder(nextOrder);
                  return { res: { code: 0, message: 'OK' } };
                } catch (err) {
                  console.info(`${err}`);
                  const nextOrder: ITransferOrder = {
                    ...order,
                    updated_at: Date.now(),
                    status: 'ERROR',
                    error_message: 'Deposit Checking Timeout',
                  };
                  await updateTransferOrder(nextOrder);
                  return { res: { code: 504, message: `${nextOrder.error_message}` } };
                }
              }
            }
          }
        }

        return { res: { code: 0, message: 'OK' } };
      }),
  );
}).subscribe();

const updateTransferOrder = async (transferOrder: ITransferOrder): Promise<void> => {
  return firstValueFrom(
    terminal
      .updateDataRecords([
        {
          id: transferOrder.order_id,
          type: 'transfer_order',
          created_at: transferOrder.created_at,
          updated_at: transferOrder.updated_at,
          frozen_at: null,
          tags: {
            debit_account_id: transferOrder.debit_account_id,
            credit_account_id: transferOrder.credit_account_id,
            status: transferOrder.status,
          },
          origin: transferOrder,
        },
      ])
      .pipe(concatWith(of(void 0))),
  );
};

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
        console.info('SubmitOrder', JSON.stringify(msg));
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

        const params = {
          instId,
          tdMode: 'cross',
          side: mapOrderDirectionToSide(order.order_direction),
          posSide: instType === 'MARGIN' ? 'net' : mapOrderDirectionToPosSide(order.order_direction),
          ordType: mapOrderTypeToOrdType(order.order_type),
          sz: (instType === 'SWAP'
            ? order.volume
            : instType === 'MARGIN'
            ? order.order_type === 'LIMIT'
              ? order.volume
              : order.order_type === 'MARKET'
              ? 0
              : 0
            : 0
          ).toString(),
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

  interface IFundingRate {
    series_id: string;
    datasource_id: string;
    product_id: string;
    funding_at: number;
    funding_rate: number;
  }

  terminal.provideService(
    'CopyDataRecords',
    {
      required: ['type', 'tags'],
      properties: {
        type: { const: 'funding_rate' },
        tags: {
          type: 'object',
          required: ['series_id'],
          properties: {
            series_id: { type: 'string', pattern: '^okx/.+' },
          },
        },
      },
    },
    (msg, output$) => {
      const sub = interval(5000).subscribe(() => {
        output$.next({});
      });
      return defer(async () => {
        if (msg.req.tags?.series_id === undefined) {
          return { res: { code: 400, message: 'series_id is required' } };
        }
        const [start, end] = msg.req.time_range || [0, Date.now()];
        const [datasource_id, product_id] = decodePath(msg.req.tags.series_id);
        const funding_rate_history = [];
        let current_end = end;
        while (true) {
          const res = await client.getFundingRateHistory({
            instId: product_id,
            after: `${current_end}`,
          });
          if (res.code !== '0') {
            return { res: { code: +res.code, message: res.msg } };
          }
          if (res.data.length === 0) {
            break;
          }
          funding_rate_history.push(...res.data);
          current_end = +res.data[res.data.length - 1].fundingTime;
          if (current_end <= start) {
            break;
          }
          await firstValueFrom(timer(1000));
        }
        funding_rate_history.sort((a, b) => +a.fundingTime - +b.fundingTime);
        // there will be at most 300 records, so we don't need to chunk it by bufferCount
        await lastValueFrom(
          from(funding_rate_history).pipe(
            map(
              (v): IDataRecord<IFundingRate> => ({
                id: encodePath('okx', product_id, v.fundingTime),
                type: 'funding_rate',
                created_at: +v.fundingTime,
                updated_at: +v.fundingTime,
                frozen_at: +v.fundingTime,
                tags: {
                  series_id: msg.req.tags!.series_id,
                  datasource_id,
                  product_id,
                },
                origin: {
                  series_id: msg.req.tags!.series_id,
                  product_id,
                  datasource_id,
                  funding_rate: +v.fundingRate,
                  funding_at: +v.fundingTime,
                },
              }),
            ),
            toArray(),
            mergeMap((v) => terminal.updateDataRecords(v).pipe(concatWith(of(void 0)))),
          ),
        );
        return { res: { code: 0, message: 'OK' } };
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
