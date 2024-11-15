import {
  IAccountInfo,
  IAccountMoney,
  IDataRecordTypes,
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
import {
  EMPTY,
  combineLatest,
  defer,
  delayWhen,
  expand,
  filter,
  firstValueFrom,
  from,
  interval,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  skip,
  tap,
  timer,
} from 'rxjs';
import { BitgetClient } from './api';

const DATASOURCE_ID = 'Bitget';

const client = new BitgetClient({
  auth: process.env.PUBLIC_ONLY
    ? undefined
    : {
        access_key: process.env.ACCESS_KEY!,
        secret_key: process.env.SECRET_KEY!,
        passphrase: process.env.PASSPHRASE!,
      },
});

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

const fundingTime$ = memoizeMap((product_id: string) =>
  // KNOWN ISSUE: the next funding time may be incorrect
  of({ expire: 0 }).pipe(
    //
    expand((v) =>
      timer(v.expire).pipe(
        //
        mergeMap(async () => {
          const [instType, instId] = decodePath(product_id);
          const res = await client.getNextFundingTime({
            symbol: instId,
            productType: instType,
          });
          if (res.msg !== 'success') {
            throw new Error(res.msg);
          }
          console.info(formatTime(Date.now()), 'FundingTime', product_id, res.data[0].nextFundingTime);
          return { ...res.data[0], expire: +res.data[0].nextFundingTime - Date.now() };
        }),
        retry({ delay: 5000 }),
      ),
    ),
    skip(1),
    shareReplay(1),
  ),
);

(async () => {
  const accountInfoRes = await client.getAccountInfo();
  const uid = accountInfoRes.data.userId;
  const parentId = '' + accountInfoRes.data.parentId;
  const isMainAccount = uid === parentId;

  const terminal = new Terminal(process.env.HOST_URL!, {
    terminal_id: process.env.TERMINAL_ID || `bitget/${uid}/${UUID()}`,
    name: 'Bitget',
  });

  const USDT_FUTURE_ACCOUNT_ID = `bitget/${uid}/futures/USDT`;
  const SPOT_ACCOUNT_ID = `bitget/${uid}/spot/USDT`;

  // product
  const futureProducts$ = defer(async () => {
    // usdt-m swap
    const usdtFuturesProductRes = await client.getMarketContracts({ productType: 'USDT-FUTURES' });
    if (usdtFuturesProductRes.msg !== 'success') {
      throw new Error(usdtFuturesProductRes.msg);
    }
    // mixed-coin swap, (including coin-m and coin-f)
    const coinFuturesProductRes = await client.getMarketContracts({ productType: 'COIN-FUTURES' });
    if (coinFuturesProductRes.msg !== 'success') {
      throw new Error(coinFuturesProductRes.msg);
    }
    const usdtFutures = usdtFuturesProductRes.data.map(
      (product): IProduct => ({
        product_id: encodePath(`USDT-FUTURES`, product.symbol),
        datasource_id: DATASOURCE_ID,
        quote_currency: product.quoteCoin,
        base_currency: product.baseCoin,
        price_step: Number(`1e-${product.pricePlace}`),
        volume_step: +product.sizeMultiplier,
      }),
    );
    const coinFutures = coinFuturesProductRes.data.map(
      (product): IProduct => ({
        product_id: encodePath(`COIN-FUTURES`, product.symbol),
        datasource_id: DATASOURCE_ID,
        quote_currency: product.quoteCoin,
        base_currency: product.baseCoin,
        price_step: Number(`1e-${product.pricePlace}`),
        volume_step: +product.sizeMultiplier,
      }),
    );

    return [...usdtFutures, ...coinFutures];
  }).pipe(
    tap({
      error: (e) => {
        console.error(formatTime(Date.now()), 'FuturesProducts', e);
      },
    }),
    retry({ delay: 5000 }),
    repeat({ delay: 86400_000 }),
    shareReplay(1),
  );

  futureProducts$
    .pipe(
      delayWhen((products) =>
        from(writeDataRecords(terminal, products.map(getDataRecordWrapper('product')!))),
      ),
    )
    .subscribe((products) => {
      console.info(formatTime(Date.now()), 'FUTUREProductsUpdated', products.length);
    });

  const mapProductIdToFuturesProduct$ = futureProducts$.pipe(
    //
    map((products) => new Map(products.map((v) => [v.product_id, v]))),
    shareReplay(1),
  );

  // TODO: margin products

  // ticks
  {
    const futureTickers$ = defer(async () => {
      const usdtFuturesTickersRes = await client.getFutureMarketTickers({
        productType: 'USDT-FUTURES',
      });
      if (usdtFuturesTickersRes.msg !== 'success') {
        throw new Error(usdtFuturesTickersRes.msg);
      }
      const coinFuturesTickersRes = await client.getFutureMarketTickers({
        productType: 'COIN-FUTURES',
      });
      if (coinFuturesTickersRes.msg !== 'success') {
        throw new Error(coinFuturesTickersRes.msg);
      }

      const usdtFuturesTickers = usdtFuturesTickersRes.data.map((v) => [
        encodePath('USDT-FUTURES', v.symbol),
        v,
      ]);
      const coinFuturesTickers = coinFuturesTickersRes.data.map((v) => [
        encodePath('COIN-FUTURES', v.symbol),
        v,
      ]);

      return Object.fromEntries([...usdtFuturesTickers, ...coinFuturesTickers]);
    }).pipe(
      //
      tap({
        error: (e) => {
          console.error(formatTime(Date.now()), 'FuturesTickers', e);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 5000 }),
      shareReplay(1),
    );

    provideTicks(terminal, DATASOURCE_ID, (product_id: string) => {
      const [instType] = decodePath(product_id);
      if (!['USDT-FUTURES', 'COIN-FUTURES'].includes(instType)) {
        // TODO: margin
        return EMPTY;
      }
      return defer(async () => {
        const theTicker$ = futureTickers$.pipe(
          //
          map((v) => v[product_id]),
          filter((v) => v !== undefined),
          shareReplay(1),
        );
        return [theTicker$, fundingTime$(product_id)] as const;
      }).pipe(
        //
        mergeMap((v) =>
          combineLatest(v).pipe(
            map(([ticker, fundingTime]): ITick => {
              return {
                datasource_id: DATASOURCE_ID,
                product_id,
                updated_at: Date.now(),
                price: +ticker.lastPr,
                volume: +ticker.baseVolume,
                open_interest: +ticker.holdingAmount,
                ask: +ticker.askPr,
                bid: +ticker.bidPr,
                settlement_scheduled_at: new Date(+fundingTime.nextFundingTime).getTime(),
                interest_rate_for_long: -+ticker.fundingRate,
                interest_rate_for_short: +ticker.fundingRate,
              };
            }),
          ),
        ),
      );
    });
  }

  // swap account info
  {
    const swapAccountInfo$ = defer(async (): Promise<IAccountInfo> => {
      const balanceRes = await client.getFutureAccounts({ productType: 'USDT-FUTURES' });
      if (balanceRes.msg !== 'success') {
        throw new Error(balanceRes.msg);
      }
      const positionsRes = await client.getAllPositions({ productType: 'USDT-FUTURES', marginCoin: 'USDT' });
      if (positionsRes.msg !== 'success') {
        throw new Error(positionsRes.msg);
      }

      const money: IAccountMoney = {
        currency: 'USDT',
        equity: +balanceRes.data[0].accountEquity,
        profit: +balanceRes.data[0].unrealizedPL,
        free: +balanceRes.data[0].maxTransferOut,
        used: +balanceRes.data[0].accountEquity - +balanceRes.data[0].maxTransferOut,
        balance: +balanceRes.data[0].available,
      };
      return {
        account_id: USDT_FUTURE_ACCOUNT_ID,
        money: money,
        currencies: [money],
        positions: positionsRes.data.map(
          (position): IPosition => ({
            position_id: `${position.symbol}-${position.holdSide}`,
            datasource_id: DATASOURCE_ID,
            product_id: encodePath('USDT-FUTURES', position.symbol),
            direction: position.holdSide === 'long' ? 'LONG' : 'SHORT',
            volume: +position.total,
            free_volume: +position.available,
            position_price: +position.openPriceAvg,
            closable_price: +position.markPrice,
            floating_profit: +position.unrealizedPL,
            valuation: +position.total * +position.markPrice,
          }),
        ),
        orders: [],
        updated_at: Date.now(),
      };
    }).pipe(
      //
      tap({
        error: (e) => {
          console.error(formatTime(Date.now()), 'SwapAccountInfo', e);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 1000 }),
      shareReplay(1),
    );
    provideAccountInfo(terminal, swapAccountInfo$);
  }

  // spot account info
  {
    const spotAccountInfo$ = defer(async (): Promise<IAccountInfo> => {
      const res = await client.getSpotAssets();
      if (res.msg !== 'success') {
        throw new Error(res.msg);
      }
      const balance = +(res.data.find((v) => v.coin === 'USDT')?.available ?? 0);
      const equity = balance;
      const free = equity;
      const money: IAccountMoney = {
        currency: 'USDT',
        equity,
        profit: 0,
        free,
        used: 0,
        balance,
      };
      return {
        updated_at: Date.now(),
        account_id: SPOT_ACCOUNT_ID,
        money: money,
        currencies: [money],
        positions: [],
        orders: [],
      };
    }).pipe(
      //
      tap({
        error: (e) => {
          console.error(formatTime(Date.now()), 'SpotAccountInfo', e);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 1000 }),
      shareReplay(1),
    );

    provideAccountInfo(terminal, spotAccountInfo$);
  }

  // trade api
  {
    terminal.provideService(
      'SubmitOrder',
      {
        required: ['account_id'],
        properties: {
          account_id: { const: USDT_FUTURE_ACCOUNT_ID },
        },
      },
      (msg) =>
        defer(async () => {
          console.info(formatTime(Date.now()), 'SubmitOrder', msg);
          const order = msg.req;
          const [instType, instId] = decodePath(order.product_id);

          const mapOrderDirectionToSide = (direction?: string) => {
            switch (direction) {
              case 'OPEN_LONG':
              case 'CLOSE_LONG':
                return 'buy';
              case 'OPEN_SHORT':
              case 'CLOSE_SHORT':
                return 'sell';
            }
            throw new Error(`Unknown direction: ${direction}`);
          };

          const mapOrderDirectionToTradeSide = (direction?: string) => {
            switch (direction) {
              case 'OPEN_LONG':
              case 'OPEN_SHORT':
                return 'open';
              case 'CLOSE_LONG':
              case 'CLOSE_SHORT':
                return 'close';
            }
            throw new Error(`Unknown direction: ${direction}`);
          };

          const params = {
            symbol: instId,
            productType: instType,
            marginMode: 'crossed',
            marginCoin: 'USDT',
            size: '' + order.volume,
            price: order.price !== undefined ? '' + order.price : undefined,
            side: mapOrderDirectionToSide(order.order_direction),
            tradeSide: mapOrderDirectionToTradeSide(order.order_direction),
            orderType: order.order_type === 'LIMIT' ? 'limit' : 'market',
          };

          console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));

          const res = await client.postFuturePlaceOrder(params);
          if (res.msg !== 'success') {
            return { res: { code: +res.code, message: '' + res.msg } };
          }
          return { res: { code: 0, message: 'OK' } };
        }),
    );

    terminal.provideService(
      'CancelOrder',
      {
        required: ['account_id'],
        properties: {
          account_id: { const: USDT_FUTURE_ACCOUNT_ID },
        },
      },
      (msg) =>
        defer(async () => {
          console.info(formatTime(Date.now()), 'CancelOrder', msg);
          const order = msg.req;
          const [instType, instId] = decodePath(order.product_id);

          const res = await client.postFutureCancelOrder({
            symbol: instId,
            productType: instType,
            orderId: order.order_id,
          });

          if (res.msg !== 'success') {
            return { res: { code: +res.code, message: '' + res.msg } };
          }
          return { res: { code: 0, message: 'OK' } };
        }),
    );
  }

  // historical funding rate
  {
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
              series_id: { type: 'string', pattern: '^bitget/' },
            },
          },
        },
      },
      (msg, output$) => {
        const sub = interval(5000).subscribe(() => {
          output$.next({});
        });
        return defer(async () => {
          console.info(formatTime(Date.now()), 'CopyDataRecords', msg);
          if (msg.req.tags?.series_id === undefined) {
            return { res: { code: 400, message: 'series_id is required' } };
          }
          const [start, end] = msg.req.time_range || [0, Date.now()];
          const [datasource_id, product_id] = decodePath(msg.req.tags.series_id);
          const mapProductsToFutureProducts = await firstValueFrom(mapProductIdToFuturesProduct$);
          const theProduct = mapProductsToFutureProducts.get(product_id);
          if (theProduct === undefined) {
            return { res: { code: 404, message: `product ${product_id} not found` } };
          }
          const { base_currency, quote_currency } = theProduct;
          if (!base_currency || !quote_currency) {
            return { res: { code: 400, message: `base_currency or quote_currency is required` } };
          }
          const [instType, instId] = decodePath(product_id);
          const funding_rate_history: IDataRecordTypes['funding_rate'][] = [];
          let current_page = 0;
          while (true) {
            const res = await client.getHistoricalFundingRate({
              symbol: instId,
              productType: instType,
              pageSize: '100',
              pageNo: '' + current_page,
            });
            if (res.msg !== 'success') {
              console.error(
                formatTime(Date.now()),
                'HistoricalFundingRate',
                `series_id: ${msg.req.tags.series_id}`,
                res,
              );
              return { res: { code: 500, message: res.msg } };
            }
            if (res.data.length === 0) {
              break;
            }
            for (const v of res.data) {
              if (+v.fundingTime <= end) {
                funding_rate_history.push({
                  series_id: msg.req.tags.series_id,
                  datasource_id,
                  product_id,
                  base_currency,
                  quote_currency,
                  funding_at: +v.fundingTime,
                  funding_rate: +v.fundingRate,
                });
              }
            }
            if (+res.data[res.data.length - 1].fundingTime <= start) {
              break;
            }
            current_page++;
          }
          funding_rate_history.sort((a, b) => a.funding_at - b.funding_at);

          await firstValueFrom(
            from(writeDataRecords(terminal, funding_rate_history.map(getDataRecordWrapper('funding_rate')!))),
          );
          return { res: { code: 0, message: 'OK' } };
        }).pipe(
          tap({
            finalize: () => {
              sub.unsubscribe();
            },
          }),
        );
      },
    );
  }

  // transfer
  {
    // BLOCK_CHAIN;
    if (isMainAccount) {
      const depositAddressRes = await client.getDepositAddress({ coin: 'USDT', chain: 'TRC20' });
      console.info(formatTime(Date.now()), 'DepositAddress', depositAddressRes.data);
      const address = depositAddressRes.data;
      await firstValueFrom(
        defer(() =>
          writeDataRecords(terminal, [
            getDataRecordWrapper('transfer_network_info')!({
              network_id: 'TRC20',
              commission: 1,
              currency: 'USDT',
              timeout: 1800_000,
            }),
          ]),
        ),
      );
      addAccountTransferAddress({
        terminal,
        account_id: SPOT_ACCOUNT_ID,
        network_id: 'TRC20',
        currency: 'USDT',
        address: address.address,
        onApply: {
          INIT: async (order) => {
            if (!order.current_amount || order.current_amount < 10) {
              return { state: 'ERROR', message: 'Amount too small' };
            }
            const transferResult = await client.postWithdraw({
              coin: 'USDT',
              transferType: 'on_chain',
              address: order.current_rx_address!,
              chain: 'TRC20',
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
            const withdrawalRecordsResult = await client.getWithdrawalRecords({
              orderId: wdId,
              startTime: `${Date.now() - 90 * 86400_000}`,
              endTime: '' + Date.now(),
            });
            const txId = withdrawalRecordsResult.data[0].tradeId;
            if (txId === wdId) {
              return { state: 'PENDING', context: wdId };
            }
            return { state: 'COMPLETE', transaction_id: txId };
          },
        },
        onEval: async (order) => {
          const checkResult = await client.getDepositRecords({
            coin: 'USDT',
            startTime: `${Date.now() - 90 * 86400_000}`,
            endTime: '' + Date.now(),
            limit: '100',
          });
          if (checkResult.msg !== 'success') {
            return { state: 'PENDING' };
          }
          const deposit = checkResult.data.find((v) => v.tradeId === order.current_transaction_id);
          if (deposit === undefined) {
            return { state: 'PENDING' };
          }
          return { state: 'COMPLETE', received_amount: +deposit.size };
        },
      });
    }

    // account internal transfer
    const ACCOUNT_INTERNAL_NETWORK_ID = `Bitget/${uid}/ACCOUNT_INTERNAL_NETWORK_ID`;
    addAccountTransferAddress({
      terminal,
      account_id: SPOT_ACCOUNT_ID,
      network_id: ACCOUNT_INTERNAL_NETWORK_ID,
      currency: 'USDT',
      address: 'SPOT',
      onApply: {
        INIT: async (order) => {
          const transferResult = await client.postTransfer({
            fromType: 'spot',
            toType: 'usdt_futures',
            amount: `${order.current_amount}`,
            coin: 'USDT',
          });
          if (transferResult.msg !== 'success') {
            return { state: 'INIT', message: transferResult.msg };
          }
          return { state: 'COMPLETE' };
        },
      },
      onEval: async (order) => {
        return { state: 'COMPLETE', received_amount: order.current_amount };
      },
    });
    addAccountTransferAddress({
      terminal,
      account_id: USDT_FUTURE_ACCOUNT_ID,
      network_id: ACCOUNT_INTERNAL_NETWORK_ID,
      currency: 'USDT',
      address: 'USDT_FUTURE',
      onApply: {
        INIT: async (order) => {
          const transferResult = await client.postTransfer({
            fromType: 'usdt_futures',
            toType: 'spot',
            amount: `${order.current_amount}`,
            coin: 'USDT',
          });
          if (transferResult.msg !== 'success') {
            return { state: 'INIT', message: transferResult.msg };
          }
          return { state: 'COMPLETE' };
        },
      },
      onEval: async (order) => {
        return { state: 'COMPLETE', received_amount: order.current_amount };
      },
    });

    // TODO: account internal margin transfer

    // sub-account transfer
    const getSubAccountNetworkId = (subUid: string) => `Bitget/${parentId}/SubAccount/${subUid}`;
    if (isMainAccount) {
      const subAccountInfoRes = await client.getVirtualSubAccountList();
      for (const item of subAccountInfoRes.data.subAccountList || []) {
        addAccountTransferAddress({
          terminal,
          account_id: SPOT_ACCOUNT_ID,
          network_id: getSubAccountNetworkId(item.subAccountUid),
          currency: 'USDT',
          address: 'parent',
          onApply: {
            INIT: async (order) => {
              const transferResult = await client.postSubAccountTransfer({
                fromType: 'spot',
                toType: 'spot',
                amount: `${order.current_amount}`,
                coin: 'USDT',
                fromUserId: parentId,
                toUserId: item.subAccountUid,
              });
              if (transferResult.msg !== 'success') {
                return { state: 'INIT', message: transferResult.msg };
              }
              return { state: 'COMPLETE', transaction_id: transferResult.data.transferId };
            },
          },
          onEval: async (order) => {
            return { state: 'COMPLETE', received_amount: order.current_amount };
          },
        });

        addAccountTransferAddress({
          terminal,
          account_id: `bitget/${item.subAccountUid}/spot/USDT`,
          network_id: getSubAccountNetworkId(item.subAccountUid),
          currency: 'USDT',
          address: 'sub',
          onApply: {
            INIT: async (order) => {
              const transferResult = await client.postSubAccountTransfer({
                fromType: 'spot',
                toType: 'spot',
                amount: `${order.current_amount}`,
                coin: 'USDT',
                fromUserId: item.subAccountUid,
                toUserId: parentId,
              });
              if (transferResult.msg !== 'success') {
                return { state: 'INIT', message: transferResult.msg };
              }
              return { state: 'COMPLETE', transaction_id: transferResult.data.transferId };
            },
          },
          onEval: async (order) => {
            return { state: 'COMPLETE', received_amount: order.current_amount };
          },
        });
      }
    }
  }
})();
