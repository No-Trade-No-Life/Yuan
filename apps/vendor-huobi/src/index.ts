import {
  IAccountAddressInfo,
  IAccountInfo,
  IDataRecord,
  IOrder,
  IPosition,
  IProduct,
  ITick,
  ITransferOrder,
  decodePath,
  encodePath,
  formatTime,
  wrapAccountAddressInfo,
} from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import { roundToStep } from '@yuants/utils';

import {
  EMPTY,
  bufferCount,
  catchError,
  combineLatest,
  combineLatestWith,
  concatWith,
  defer,
  distinct,
  expand,
  filter,
  first,
  firstValueFrom,
  from,
  groupBy,
  interval,
  lastValueFrom,
  map,
  mergeMap,
  of,
  reduce,
  repeat,
  retry,
  shareReplay,
  tap,
  throttleTime,
  timeout,
  timer,
  toArray,
} from 'rxjs';

import { HuobiClient } from './api';

(async () => {
  const client = new HuobiClient({
    auth: {
      access_key: process.env.ACCESS_KEY!,
      secret_key: process.env.SECRET_KEY!,
    },
  });

  const huobiUid: number = (await client.getUid()).data;

  const huobiAccounts = await client.getAccount();
  const superMarginAccountUid = huobiAccounts.data.find((v) => v.type === 'super-margin')?.id!;
  const spotAccountUid = huobiAccounts.data.find((v) => v.type === 'spot')?.id!;
  console.info(formatTime(Date.now()), 'huobiAccount', JSON.stringify(huobiAccounts));

  const account_id = `huobi/${huobiUid}`;
  const SPOT_ACCOUNT_ID = `${account_id}/spot/usdt`;
  const SUPER_MARGIN_ACCOUNT_ID = `${account_id}/super-margin`;
  const SWAP_ACCOUNT_ID = `${account_id}/swap`;

  const terminal = new Terminal(process.env.HOST_URL!, {
    terminal_id: process.env.TERMINAL_ID || `Huobi-client-${account_id}`,
    name: 'Huobi',
  });

  const perpetualContractProducts$ = defer(() => client.getPerpetualContractSymbols()).pipe(
    mergeMap((res) => res.data),
    filter((symbol) => symbol.contract_status === 1),
    map(
      (symbol): IProduct => ({
        datasource_id: 'huobi-swap',
        product_id: symbol.contract_code,
        base_currency: symbol.symbol,
        quote_currency: 'USDT',
        value_scale: symbol.contract_size,
        price_step: symbol.price_tick,
        volume_step: 1,
      }),
    ),
    toArray(),
    repeat({ delay: 86400_000 }),
    retry({ delay: 10_000 }),
    shareReplay(1),
  );

  const spotProducts$ = defer(() => client.getSpotSymbols()).pipe(
    mergeMap((res) => res.data),
    filter((symbol) => symbol.state === 'online'),
    map(
      (symbol): IProduct => ({
        datasource_id: 'huobi-spot',
        product_id: symbol.sc,
        base_currency: symbol.bc,
        quote_currency: symbol.qc,
        value_scale: 1,
        price_step: 1 / 10 ** symbol.tpp,
        volume_step: 1 / 10 ** symbol.tap,
      }),
    ),
    toArray(),
    repeat({ delay: 86400_000 }),
    retry({ delay: 10_000 }),
    shareReplay(1),
  );

  spotProducts$.pipe(mergeMap((products) => terminal.updateProducts(products))).subscribe();
  perpetualContractProducts$.pipe(mergeMap((products) => terminal.updateProducts(products))).subscribe();

  const mapSwapContractCodeToBboTick$ = defer(() => client.getSwapMarketBbo({})).pipe(
    mergeMap((res) =>
      from(res.ticks).pipe(
        map((tick) => [tick.contract_code, tick] as const),
        toArray(),
        map((ticks) => Object.fromEntries(ticks)),
      ),
    ),

    repeat({ delay: 1000 }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );

  const mapSwapContractCodeToTradeTick$ = defer(() => client.getSwapMarketTrade({})).pipe(
    mergeMap((res) =>
      from(res.tick.data).pipe(
        map((tick) => [tick.contract_code, tick] as const),
        toArray(),
        map((ticks) => Object.fromEntries(ticks)),
      ),
    ),

    repeat({ delay: 1000 }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );

  const mapSwapContractCodeToFundingRateTick$ = defer(() => client.getSwapBatchFundingRate({})).pipe(
    mergeMap((res) =>
      from(res.data).pipe(
        map((tick) => [tick.contract_code, tick] as const),
        toArray(),
        map((ticks) => Object.fromEntries(ticks)),
      ),
    ),

    repeat({ delay: 1000 }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );

  terminal.provideTicks('huobi-swap', (product_id) => {
    return defer(async () => {
      const products = await firstValueFrom(perpetualContractProducts$);
      const theProduct = products.find((x) => x.product_id === product_id);
      if (!theProduct) throw `No Found ProductID ${product_id}`;

      return [
        of(theProduct),
        mapSwapContractCodeToBboTick$,
        mapSwapContractCodeToTradeTick$,
        mapSwapContractCodeToFundingRateTick$,
      ] as const;
    }).pipe(
      catchError(() => EMPTY),
      mergeMap((x) =>
        combineLatest(x).pipe(
          map(
            ([theProduct, bboTick, tradeTick, fundingRateTick]): ITick => ({
              datasource_id: 'huobi-swap',
              product_id,
              updated_at: Date.now(),
              settlement_scheduled_at: +fundingRateTick[product_id].funding_time,
              price: +tradeTick[product_id].price,
              ask: bboTick[product_id].ask?.[0] ?? undefined,
              bid: bboTick[product_id].bid?.[0] ?? undefined,
              volume: +tradeTick[product_id].amount,
              interest_rate_for_long: -+fundingRateTick[product_id].funding_rate,
              interest_rate_for_short: +fundingRateTick[product_id].funding_rate,
            }),
          ),
        ),
      ),
    );
  });

  const mapProductIdToPerpetualProduct$ = perpetualContractProducts$.pipe(
    map((x) => new Map(x.map((v) => [v.product_id, v]))),
    shareReplay(1),
  );

  // account info
  const perpetualContractAccountInfo$ = of(0).pipe(
    mergeMap(() => {
      const balance$ = defer(() => client.getUnifiedAccountInfo()).pipe(
        //
        mergeMap((res) => res.data),
        filter((v) => v.margin_asset === 'USDT'),
        repeat({ delay: 1000 }),
        tap({
          error: (e) => {
            console.error(formatTime(Date.now()), 'balanceAndPosition$', e);
          },
        }),
        retry({ delay: 5000 }),
        shareReplay(1),
      );

      const positions$ = defer(() => client.getSwapCrossPositionInfo()).pipe(
        //
        combineLatestWith(mapProductIdToPerpetualProduct$.pipe(first())),
        mergeMap(([res, mapProductIdToPerpetualProduct]) =>
          from(res.data).pipe(
            map((v): IPosition => {
              const product_id = v.contract_code;
              const theProduct = mapProductIdToPerpetualProduct.get(product_id);
              const valuation = v.volume * v.last_price * (theProduct?.value_scale || 1);
              return {
                position_id: `${v.contract_code}/${v.contract_type}/${v.direction}/${v.margin_mode}`,
                datasource_id: 'huobi-swap',
                product_id,
                direction: v.direction === 'buy' ? 'LONG' : 'SHORT',
                volume: v.volume,
                free_volume: v.available,
                position_price: v.cost_hold,
                closable_price: v.last_price,
                floating_profit: v.profit_unreal,
                valuation,
              };
            }),
            toArray(),
          ),
        ),
        repeat({ delay: 1000 }),
        tap({
          error: (e) => {
            console.error(formatTime(Date.now()), 'balanceAndPosition$', e);
          },
        }),
        retry({ delay: 5000 }),
        shareReplay(1),
      );

      const orders$ = of({ orders: [], page_index: 1, page_size: 50 }).pipe(
        expand((v) =>
          defer(() => client.getSwapOpenOrders()).pipe(
            //
            retry({ delay: 5000 }),
            map((v) => v.data),
            mergeMap((ret) => {
              if (ret.orders.length === 0) {
                return EMPTY;
              }
              return of({ orders: ret.orders, page_index: v.page_index + 1, page_size: v.page_size });
            }),
          ),
        ),

        mergeMap((res) =>
          from(res.orders).pipe(
            map((v): IOrder => {
              return {
                order_id: v.order_id_str,
                account_id: SWAP_ACCOUNT_ID,
                product_id: v.contract_code,
                order_type: ['lightning'].includes(v.order_price_type)
                  ? 'MARKET'
                  : ['limit', 'opponent', 'post_only', 'optimal_5', 'optimal_10', 'optimal_20'].includes(
                      v.order_price_type,
                    )
                  ? 'LIMIT'
                  : ['fok'].includes(v.order_price_type)
                  ? 'FOK'
                  : v.order_price_type.includes('ioc')
                  ? 'IOC'
                  : 'STOP', // unreachable code
                order_direction:
                  v.direction === 'open'
                    ? v.offset === 'buy'
                      ? 'OPEN_LONG'
                      : 'OPEN_SHORT'
                    : v.offset === 'buy'
                    ? 'CLOSE_SHORT'
                    : 'CLOSE_LONG',
                volume: v.volume,
                submit_at: v.created_at,
                price: v.price,
                traded_volume: v.trade_volume,
              };
            }),
            toArray(),
          ),
        ),

        repeat({ delay: 1000 }),
        tap({
          error: (e) => {
            console.error(formatTime(Date.now()), 'orders$', e);
          },
        }),
        retry({ delay: 5000 }),
        shareReplay(1),
      );

      return combineLatest([balance$, positions$, orders$]).pipe(
        throttleTime(1000),
        map(([balance, positions, orders]): IAccountInfo => {
          return {
            timestamp_in_us: Date.now() * 1000,
            updated_at: Date.now(),
            account_id: SWAP_ACCOUNT_ID,
            money: {
              currency: 'USDT',
              balance: balance.cross_margin_static,
              equity: balance.margin_balance,
              profit: balance.cross_profit_unreal,
              free: balance.withdraw_available,
              used: balance.margin_balance - balance.withdraw_available,
            },
            positions,
            orders,
          };
        }),
      );
    }),
  );

  const superMarginUnifiedRawAccountBalance$ = defer(() =>
    client.getSpotAccountBalance(superMarginAccountUid),
  ).pipe(
    //
    map((res) => res.data),
    repeat({ delay: 1000 }),
    tap({
      error: (e) => {
        console.error(formatTime(Date.now()), 'unifiedRaw', e);
      },
    }),
    retry({ delay: 5000 }),
    shareReplay(1),
  );

  const subscriptions: Set<string> = new Set();
  client.spot_ws.connection$.subscribe(() => {
    subscriptions.clear();
  });
  // subscribe the symbols of positions we held
  superMarginUnifiedRawAccountBalance$
    .pipe(
      //
      mergeMap((res) =>
        from(res.list).pipe(
          filter((v) => v.currency !== 'usdt'),
          map((v) => v.currency),
          distinct(),
          toArray(),
          map((v) => new Set(v)),
        ),
      ),
    )
    .subscribe((v: Set<string>) => {
      const toUnsubscribe = [...subscriptions].filter((x) => !v.has(x));
      const toSubscribe = [...v].filter((x) => !subscriptions.has(x));

      for (const symbol of toUnsubscribe) {
        client.spot_ws.output$.next({
          unsub: `market.${symbol}usdt.ticker`,
        });
        subscriptions.delete(symbol);
      }
      for (const symbol of toSubscribe) {
        client.spot_ws.output$.next({
          sub: `market.${symbol}usdt.ticker`,
        });
        subscriptions.add(symbol);
      }
    });

  const superMarginAccountInfo$ = of(0).pipe(
    //
    mergeMap(() => {
      const balance$ = superMarginUnifiedRawAccountBalance$.pipe(
        //
        mergeMap((res) =>
          from(res.list).pipe(
            filter((v) => v.currency === 'usdt'),
            reduce((acc, cur) => acc + +cur.balance, 0),
          ),
        ),
      );
      const position$ = superMarginUnifiedRawAccountBalance$.pipe(
        //
        mergeMap((res) =>
          from(res.list).pipe(
            filter((v) => v.currency !== 'usdt'),
            groupBy((res) => res.currency),
            mergeMap((group$) =>
              group$.pipe(
                reduce((acc, cur) => ({ currency: acc.currency, balance: acc.balance + +cur.balance }), {
                  currency: group$.key,
                  balance: 0,
                }),
                combineLatestWith(
                  defer(() => client.spot_ws.input$).pipe(
                    //
                    first((v) => v.ch?.includes('ticker') && v.ch?.includes(group$.key) && v.tick),
                    map((v): number => v.tick.bid),
                    timeout(5000),
                    tap({
                      error: (e) => {
                        subscriptions.clear();
                      },
                    }),
                    retry({ delay: 5000 }),
                  ),
                ),
                map(([v, price]): IPosition => {
                  return {
                    position_id: `${v.currency}/usdt/spot`,
                    product_id: `${v.currency}usdt`,
                    direction: 'LONG',
                    volume: v.balance,
                    free_volume: v.balance,
                    position_price: price,
                    closable_price: price,
                    floating_profit: 0,
                    valuation: v.balance * price,
                  };
                }),
              ),
            ),
            toArray(),
          ),
        ),
      );
      return combineLatest([balance$, position$]).pipe(
        //
        throttleTime(1000),
        map(([balance, positions]): IAccountInfo => {
          const equity = positions.reduce((acc, cur) => acc + cur.closable_price * cur.volume, 0) + balance;
          return {
            timestamp_in_us: Date.now() * 1000,
            updated_at: Date.now(),
            account_id: SUPER_MARGIN_ACCOUNT_ID,
            money: {
              currency: 'USDT',
              balance: equity,
              equity: equity,
              profit: 0,
              free: equity,
              used: 0,
            },
            positions,
            orders: [],
          };
        }),
      );
    }),
  );

  const spotRawBalance$ = defer(() => client.getSpotAccountBalance(spotAccountUid)).pipe(
    repeat({ delay: 1000 }),
    retry({ delay: 5000 }),
    shareReplay(1),
  );

  const spotAccountInfo$ = spotRawBalance$.pipe(
    map((spotBalance): IAccountInfo => {
      const balance = +(spotBalance.data.list.find((v) => v.currency === 'usdt')?.balance ?? 0);
      const equity = balance;
      const free = equity;
      return {
        updated_at: Date.now(),
        account_id: SPOT_ACCOUNT_ID,
        money: {
          currency: 'USDT',
          balance,
          equity,
          profit: 0,
          free,
          used: 0,
        },
        positions: [],
        orders: [],
      };
    }),
    shareReplay(1),
  );

  terminal.provideAccountInfo(spotAccountInfo$);
  terminal.provideAccountInfo(superMarginAccountInfo$);
  terminal.provideAccountInfo(perpetualContractAccountInfo$);

  // Submit order
  terminal.provideService(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: {
          enum: [SUPER_MARGIN_ACCOUNT_ID, SWAP_ACCOUNT_ID],
        },
      },
    },
    (msg) => {
      const { account_id: req_account_id } = msg.req;
      console.info(formatTime(Date.now()), `SubmitOrder for ${account_id}`, JSON.stringify(msg));

      if (req_account_id === SWAP_ACCOUNT_ID) {
        return defer(() => client.getSwapCrossPositionInfo()).pipe(
          mergeMap((res) => res.data),
          map((v) => [v.contract_code, v.lever_rate]),
          toArray(),
          map((v) => Object.fromEntries(v)),
          mergeMap((mapContractCodeToRate) => {
            const lever_rate = mapContractCodeToRate[msg.req.product_id] ?? 20;
            const params = {
              contract_code: msg.req.product_id,
              contract_type: 'swap',
              price: msg.req.price,
              volume: msg.req.volume,
              offset:
                msg.req.order_direction === 'OPEN_LONG' || msg.req.order_direction === 'OPEN_SHORT'
                  ? 'open'
                  : 'close',
              direction:
                msg.req.order_direction === 'OPEN_LONG' || msg.req.order_direction === 'CLOSE_SHORT'
                  ? 'buy'
                  : 'sell',
              // dynamically adjust the leverage
              lever_rate,
              order_price_type: msg.req.order_type === 'MARKET' ? 'market' : 'limit',
            };
            return client.postSwapOrder(params).then((v) => {
              console.info(formatTime(Date.now()), 'SubmitOrder', JSON.stringify(v), JSON.stringify(params));
              return v;
            });
          }),
          map((v) => {
            if (v.status !== 'ok') {
              return { res: { code: 500, message: v.status } };
            }
            return { res: { code: 0, message: 'OK' } };
          }),
          catchError((e) => {
            console.error(formatTime(Date.now()), 'SubmitOrder', e);
            return of({ res: { code: 500, message: `${e}` } });
          }),
        );
      }
      // for super-margin orders, we need to denote the amount of usdt to borrow, therefore we need to:
      // 1. get the loanable amount
      // 2. get the current balance
      // 3. get the current price
      // 4. combine the information to submit the order
      return defer(() => client.getCrossMarginLoanInfo()).pipe(
        //
        mergeMap((res) => res.data),
        first((v) => v.currency === 'usdt'),
        map((v) => +v['loanable-amt']),
        combineLatestWith(
          superMarginUnifiedRawAccountBalance$.pipe(
            first(),
            mergeMap((res) =>
              from(res.list).pipe(
                // we only need the amount of usdt that can be used to trade
                filter((v) => v.currency === 'usdt' && v.type === 'trade'),
                reduce((acc, cur) => acc + +cur.balance, 0),
              ),
            ),
          ),
        ),
        combineLatestWith(spotProducts$.pipe(first())),
        mergeMap(async ([[loanable, balance], products]) => {
          const priceRes = await client.getSpotTick({ symbol: msg.req.product_id });
          const theProduct = products.find((v) => v.product_id === msg.req.product_id);
          const price: number = priceRes.tick.close;
          const borrow_amount =
            msg.req.order_direction === 'OPEN_LONG' || msg.req.order_direction === 'CLOSE_SHORT'
              ? Math.max(Math.min(loanable, msg.req.volume * price - balance), 0)
              : undefined;
          const params = {
            symbol: msg.req.product_id,
            'account-id': '' + superMarginAccountUid,
            // amount: msg.req.type === OrderType.MARKET ? 0 : '' + msg.req.volume,
            // 'market-amount': msg.req.type === OrderType.MARKET ? '' + msg.req.volume : undefined,
            amount:
              '' +
              (msg.req.order_direction === 'OPEN_LONG' || msg.req.order_direction === 'CLOSE_SHORT'
                ? roundToStep(msg.req.volume * price, theProduct?.volume_step!)
                : msg.req.volume),
            'borrow-amount': '' + borrow_amount,
            type: `${
              msg.req.order_direction === 'OPEN_LONG' || msg.req.order_direction === 'CLOSE_SHORT'
                ? 'buy'
                : 'sell'
            }-${'LIMIT' === msg.req.order_type ? 'limit' : 'market'}`,
            'trade-purpose':
              msg.req.order_direction === 'OPEN_LONG' || msg.req.order_direction === 'CLOSE_SHORT'
                ? '1' // auto borrow
                : '2', // auto repay
            price: msg.req.order_type === 'MARKET' ? undefined : '' + msg.req.price,
            source: 'super-margin-api',
          };
          return client.postSpotOrder(params).then((v) => {
            console.info(formatTime(Date.now()), 'SubmitOrder', JSON.stringify(v), JSON.stringify(params));
            return v;
          });
        }),
        map((v) => {
          if (v.success === false) {
            return { res: { code: v.code, message: v.message } };
          }
          return { res: { code: 0, message: 'OK' } };
        }),
        catchError((e) => {
          console.error(formatTime(Date.now()), 'SubmitOrder', e);
          return of({ res: { code: 500, message: `${e}` } });
        }),
      );
    },
  );

  const blockchainAddress$ = defer(() => client.getSpotAccountDepositAddresses({ currency: 'usdt' })).pipe(
    //
    retry({ delay: 5000 }),
    mergeMap((v) =>
      from(v.data).pipe(
        //
        map((v) => encodePath(`blockchain`, v.chain, v.address)),
        toArray(),
      ),
    ),
    shareReplay(1),
  );

  const debit_methods = [
    encodePath(`huobi`, `account_internal`, SUPER_MARGIN_ACCOUNT_ID),
    encodePath(`huobi`, `account_internal`, SWAP_ACCOUNT_ID),
    ...(await firstValueFrom(blockchainAddress$)),
  ];

  const updateTransferOrder = (transferOrder: ITransferOrder): Promise<void> => {
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
              status: `${transferOrder.status}`,
            },
            origin: transferOrder,
          },
        ])
        .pipe(concatWith(of(void 0))),
    );
  };

  // Transfer
  terminal.provideService(
    'Transfer',
    {
      oneOf: [
        {
          type: 'object',
          required: ['debit_account_id', 'credit_account_id', 'currency'],
          properties: {
            debit_account_id: {
              enum: [SUPER_MARGIN_ACCOUNT_ID, SWAP_ACCOUNT_ID],
            },
            currency: {
              const: 'USDT',
            },
            status: {
              const: 'AWAIT_DEBIT',
            },
          },
        },
        {
          type: 'object',
          required: ['debit_account_id', 'credit_account_id', 'currency'],
          properties: {
            credit_account_id: {
              enum: [SUPER_MARGIN_ACCOUNT_ID, SWAP_ACCOUNT_ID],
            },
            currency: {
              const: 'USDT',
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
        console.info(formatTime(Date.now()), `Transfer for ${account_id}`, JSON.stringify(msg));
        const req = msg.req;
        const { credit_account_id, debit_account_id, status } = req;

        if (req.timeout_at < Date.now()) {
          const nextOrder = {
            ...req,
            status: 'ERROR',
            error_message: `Transaction Timeout: ${formatTime(req.timeout_at)}`,
            updated_at: Date.now(),
          };
          await updateTransferOrder(nextOrder);
          return { res: { code: 500, message: 'TRANSFER_TIMEOUT' } };
        }

        if (status === 'AWAIT_DEBIT') {
          // if we are the debit side
          if (!req.debit_methods?.length) {
            console.info(formatTime(Date.now()), 'Transfer', 'DEBIT', 'adding debit methods');
            const nextOrder = {
              ...req,
              debit_methods,
              status: 'AWAIT_CREDIT',
              updated_at: Date.now(),
              timeout_at: req.timeout_at !== undefined ? req.timeout_at : Date.now() + 600_000,
            };
            await updateTransferOrder(nextOrder);
            await firstValueFrom(terminal.requestService('Transfer', nextOrder));
            return { res: { code: 0, message: 'OK' } };
          }

          // the transfer is ongoing
          if (req.credit_method) {
            const routing = decodePath(req.credit_method);
            if (routing[0] === 'huobi') {
              if (routing[1] === 'account_internal') {
                try {
                  await firstValueFrom(
                    defer(async () => {
                      const ledger = await client.getAccountLedger({
                        accountId: '' + spotAccountUid,
                        currency: 'usdt',
                      });
                      console.info(
                        formatTime(Date.now()),
                        'Transfer',
                        'DEBIT',
                        'checking credit account',
                        JSON.stringify(ledger),
                      );
                      const v = ledger.data.find(
                        (v) =>
                          v.transactTime >= req.transferred_at! && -v.transactAmt === req.transferred_amount,
                      );
                      if (v !== undefined) {
                        return {
                          ...req,
                          status: 'COMPLETE',
                          received_at: Date.now(),
                          received_amount: req.transferred_amount,
                          updated_at: Date.now(),
                        };
                      }
                      throw new Error('NOT_RECEIVED');
                    }).pipe(
                      //
                      retry({ delay: 5000 }),
                      timeout({
                        each: (req.timeout_at || Date.now() + 600_000) - Date.now(),
                        meta: 'TIMEOUT',
                      }),
                    ),
                  );
                } catch (e) {
                  console.error(formatTime(Date.now()), 'Transfer', 'DEBIT', `${e}`);
                  const nextOrder = {
                    ...req,
                    status: 'ERROR',
                    error_message: `DEBIT: ${e}`,
                    updated_at: Date.now(),
                  };
                  await updateTransferOrder(nextOrder);
                }
                const nextOrder = {
                  ...req,
                  status: 'COMPLETE',
                  received_at: Date.now(),
                  received_amount: req.transferred_amount,
                  updated_at: Date.now(),
                };
                await updateTransferOrder(nextOrder);
                return { res: { code: 0, message: 'OK' } };
              }
            }
            if (routing[0] === 'blockchain') {
              if (routing[1].match(/USDT/i) && routing[1].match(/TRC20/i)) {
                const address = routing[2];
                console.info(formatTime(Date.now()), 'Transfer', 'DEBIT', 'USDT TRC20', address);
                try {
                  const res = await firstValueFrom(
                    defer(() =>
                      client.getDepositWithdrawHistory({
                        currency: 'usdt',
                        type: 'deposit',
                        direct: 'next',
                      }),
                    ).pipe(
                      //
                      mergeMap((v) => {
                        if (v.status !== 'ok') {
                          throw new Error(v['error-msg']);
                        }
                        return v.data;
                      }),
                      repeat({ delay: 5000 }),
                      retry({ delay: 5000 }),
                      first((v) => v['tx-hash'] === req.transaction_id && v.state === 'safe'),
                      timeout({
                        each: (req.timeout_at || Date.now() + 600_000) - Date.now(),
                        meta: `Deposit ${req.transaction_id} Timeout`,
                      }),
                    ),
                  );

                  await firstValueFrom(timer(10000));

                  // transfer received money to trading account
                  if (debit_account_id === SWAP_ACCOUNT_ID) {
                    const transferResult = await client.postSpotAccountTransfer({
                      from: 'spot',
                      to: 'linear-swap',
                      currency: 'usdt',
                      amount: +res.amount,
                      'margin-account': 'USDT',
                    });

                    if (!transferResult.success) {
                      console.info(
                        formatTime(Date.now()),
                        'Transfer',
                        'CREDIT',
                        'spot to linear-swap failed',
                        JSON.stringify(transferResult),
                      );
                      const nextOrder = {
                        ...req,
                        status: 'ERROR',
                        error_message: `SPOT-TO-SWAP: TRANSFER_FAILED`,
                        update_at: Date.now(),
                      };
                      await updateTransferOrder(nextOrder);
                      return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                    }
                  }
                  if (debit_account_id === SUPER_MARGIN_ACCOUNT_ID) {
                    const transferInResult = await client.postSuperMarginAccountTransferIn({
                      currency: 'usdt',
                      amount: '' + req.expected_amount,
                    });
                    if (transferInResult.status !== 'ok') {
                      console.info(
                        formatTime(Date.now()),
                        'Transfer',
                        'CREDIT',
                        'spot to super-margin failed',
                        JSON.stringify(transferInResult),
                      );
                      const nextOrder = {
                        ...req,
                        status: 'ERROR',
                        error_message: `SPOT-TO-MARGIN: TRANSFER_FAILED`,
                        updated_at: Date.now(),
                      };
                      await updateTransferOrder(nextOrder);
                      return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                    }
                  }
                  const nextOrder = {
                    ...req,
                    status: 'COMPLETE',
                    received_at: Date.now(),
                    received_amount: +res.amount,
                    updated_at: Date.now(),
                  };
                  await updateTransferOrder(nextOrder);
                  return { res: { code: 0, message: 'OK' } };
                } catch (err) {
                  console.error(formatTime(Date.now()), 'Transfer', 'DEBIT', `${err}`);
                  const nextOrder = {
                    ...req,
                    status: 'ERROR',
                    error_message: `Deposit Checking Timeout`,
                    updated_at: Date.now(),
                  };
                  await updateTransferOrder(nextOrder);
                  return { res: { code: 500, message: 'TRANSFER_ERROR' } };
                }
              }
            }
            return { res: { code: 500, message: 'UNIMPLEMENTED' } };
          }
          return { res: { code: 0, message: 'OK' } };
        }

        if (status === 'AWAIT_CREDIT') {
          if (req.debit_methods) {
            console.info(
              formatTime(Date.now()),
              'Transfer',
              'CREDIT',
              'choosing credit method and performing transfer',
            );
            for (const method of req.debit_methods) {
              // method matched
              const routing = decodePath(method);
              if (routing[0] === 'huobi') {
                if (routing[1] === 'account_internal') {
                  const target_account_id = routing[2];
                  if (target_account_id === credit_account_id) {
                    // we cannot transfer to ourselves
                    continue;
                  }
                  // if we are playing the role of super-margin account
                  if (
                    credit_account_id === SUPER_MARGIN_ACCOUNT_ID &&
                    target_account_id === SWAP_ACCOUNT_ID
                  ) {
                    console.info(formatTime(Date.now()), 'Transfer', 'CREDIT', 'from super-margin to swap');

                    const updated_at = Date.now();

                    // 0. if we don't have enough usdt, we need to borrow
                    const toTransfer = req.expected_amount;
                    const usdtBalance = await firstValueFrom(
                      superMarginUnifiedRawAccountBalance$.pipe(
                        //
                        mergeMap((v) =>
                          from(v.list).pipe(
                            //
                            filter((v) => v.currency === 'usdt' && v.type === 'trade'),
                            reduce((acc, cur) => acc + +cur.balance, 0),
                          ),
                        ),
                      ),
                    );

                    if (usdtBalance <= toTransfer) {
                      // ISSUE: the minimum amount for usdt to borrow is 10
                      const toBorrow = Math.max(Math.ceil(toTransfer - usdtBalance), 10);
                      const borrowResult = await client.postBorrow({
                        currency: 'usdt',
                        amount: '' + toBorrow,
                      });

                      if (borrowResult.status !== 'ok') {
                        console.info(
                          formatTime(Date.now()),
                          'Transfer',
                          'CREDIT',
                          `toBorrow: ${toBorrow}`,
                          'borrow failed, not enough usdt to transfer',
                          JSON.stringify(borrowResult),
                        );
                        const nextOrder = {
                          ...req,
                          status: 'ERROR',
                          error_message: `BORROW FAILED`,
                          updated_at,
                        };
                        await updateTransferOrder(nextOrder);
                        return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                      }
                    }

                    // 1. transfer the amount of usdt to the spot account
                    const transferOutResult = await client.postSuperMarginAccountTransferOut({
                      currency: 'usdt',
                      amount: '' + req.expected_amount,
                    });
                    if (transferOutResult.status !== 'ok') {
                      console.info(
                        formatTime(Date.now()),
                        'Transfer',
                        'CREDIT',
                        'super-margin to spot failed',
                        JSON.stringify(transferOutResult),
                      );
                      const nextOrder = {
                        ...req,
                        status: 'ERROR',
                        error_message: `MARGIN-TO-SPOT: TRANSFER_FAILED`,
                        updated_at,
                      };
                      await updateTransferOrder(nextOrder);
                      return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                    }
                    // 2. transfer the amount of usdt to the swap account
                    const transferInResult = await client.postSpotAccountTransfer({
                      from: 'spot',
                      to: 'linear-swap',
                      currency: 'usdt',
                      amount: req.expected_amount,
                      'margin-account': 'USDT',
                    });
                    if (!transferInResult.success) {
                      console.info(
                        formatTime(Date.now()),
                        'Transfer',
                        'CREDIT',
                        'spot to linear-swap failed',
                        JSON.stringify(transferInResult),
                      );
                      const nextOrder = {
                        ...req,
                        status: 'ERROR',
                        error_message: `SPOT-TO-SWAP: TRANSFER_FAILED`,
                        updated_at,
                      };
                      await updateTransferOrder(nextOrder);
                      return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                    }
                    const nextOrder = {
                      ...req,
                      status: 'AWAIT_DEBIT',
                      credit_method: method,
                      transferred_at: updated_at,
                      transferred_amount: req.expected_amount,
                      updated_at,
                    };
                    await updateTransferOrder(nextOrder);
                    await firstValueFrom(terminal.requestService('Transfer', nextOrder));
                    return { res: { code: 0, message: 'OK' } };
                  }
                  if (
                    credit_account_id === SWAP_ACCOUNT_ID &&
                    target_account_id === SUPER_MARGIN_ACCOUNT_ID
                  ) {
                    const updated_at = Date.now();
                    // return defer(async () => {
                    const transferOutResult = await client.postSpotAccountTransfer({
                      from: 'linear-swap',
                      to: 'spot',
                      currency: 'usdt',
                      amount: req.expected_amount,
                      'margin-account': 'USDT',
                    });
                    if (!transferOutResult.success) {
                      console.info(
                        formatTime(Date.now()),
                        'Transfer',
                        'CREDIT',
                        'linear-swap to spot failed',
                        JSON.stringify(transferOutResult),
                      );

                      const nextOrder = {
                        ...req,
                        status: 'ERROR',
                        error_message: `SWAP-TO-SPOT: TRANSFER_FAILED`,
                        updated_at,
                      };
                      await updateTransferOrder(nextOrder);
                      return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                    }
                    const transferInResult = await client.postSuperMarginAccountTransferIn({
                      currency: 'usdt',
                      amount: '' + req.expected_amount,
                    });
                    if (transferInResult.status !== 'ok') {
                      console.info(
                        formatTime(Date.now()),
                        'Transfer',
                        'CREDIT',
                        'spot to super-margin failed',
                        JSON.stringify(transferInResult),
                      );
                      const nextOrder = {
                        ...req,
                        status: 'ERROR',
                        error_message: `SPOT-TO-MARGIN: TRANSFER_FAILED`,
                        updated_at,
                      };
                      await updateTransferOrder(nextOrder);
                      return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                    }

                    const nextOrder = {
                      ...req,
                      status: 'AWAIT_DEBIT',
                      credit_method: method,
                      transferred_at: updated_at,
                      transferred_amount: req.expected_amount,
                      updated_at,
                    };

                    await updateTransferOrder(nextOrder);
                    await firstValueFrom(terminal.requestService('Transfer', nextOrder));
                    return { res: { code: 0, message: 'OK' } };
                  }
                }
              }
              if (routing[0] === 'blockchain') {
                if (routing[1].match(/USDT/i) && routing[1].match(/TRC20/i)) {
                  //
                  const address = routing[2];
                  console.info(formatTime(Date.now()), 'Transfer', req.order_id, 'USDT TRC20', address);

                  // 1. transfer the amount of usdt to the spot account
                  if (credit_account_id === SUPER_MARGIN_ACCOUNT_ID) {
                    const transferOutResult = await client.postSuperMarginAccountTransferOut({
                      currency: 'usdt',
                      amount: '' + req.expected_amount + 1 /* 1 as fee */,
                    });
                    if (transferOutResult.status !== 'ok') {
                      console.info(
                        formatTime(Date.now()),
                        'Transfer',
                        'CREDIT',
                        'super-margin to spot failed',
                        JSON.stringify(transferOutResult),
                      );
                      const nextOrder = {
                        ...req,
                        status: 'ERROR',
                        error_message: `MARGIN-TO-SPOT: TRANSFER_FAILED`,
                        updated_at: Date.now(),
                      };
                      await updateTransferOrder(nextOrder);
                      return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                    }
                  }
                  if (credit_account_id === SWAP_ACCOUNT_ID) {
                    const transferOutResult = await client.postSpotAccountTransfer({
                      from: 'linear-swap',
                      to: 'spot',
                      currency: 'usdt',
                      amount: req.expected_amount + 1 /* 1 as fee */,
                      'margin-account': 'USDT',
                    });
                    if (!transferOutResult.success) {
                      console.info(
                        formatTime(Date.now()),
                        'Transfer',
                        'CREDIT',
                        'linear-swap to spot failed',
                        JSON.stringify(transferOutResult),
                      );

                      const nextOrder = {
                        ...req,
                        status: 'ERROR',
                        error_message: `SWAP-TO-SPOT: TRANSFER_FAILED`,
                        updated_at: Date.now(),
                      };
                      await updateTransferOrder(nextOrder);
                      return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                    }
                  }

                  // 2. withdraw the amount of usdt to the blockchain address
                  const res = await client.postWithdraw({
                    address,
                    amount: '' + req.expected_amount,
                    currency: 'usdt',
                    fee: '1',
                    chain: 'trc20usdt',
                  });

                  if (res.status != 'ok') {
                    const nextOrder = {
                      ...req,
                      status: 'ERROR',
                      error_message: `WITHDRAW_FAILED: ${JSON.stringify(res)}`,
                      updated_at: Date.now(),
                    };
                    await updateTransferOrder(nextOrder);
                    return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                  }

                  // 3. check the withdrawal status
                  const wdId = res.data;
                  const txId = await firstValueFrom(
                    defer(() =>
                      client.getDepositWithdrawHistory({
                        currency: 'usdt',
                        type: 'withdraw',
                        from: `${wdId}`,
                      }),
                    ).pipe(
                      tap((v) => {
                        console.info(
                          formatTime(Date.now()),
                          'Transfer',
                          req.order_id,
                          'USDT TRC20',
                          JSON.stringify(v),
                        );
                      }),
                      repeat({ delay: 5000 }),
                      retry({ delay: 5000 }),
                      mergeMap((v) => v.data),
                      first((v) => v.id === wdId && v['tx-hash'] !== ''),
                      timeout({ each: 600_000, meta: `Withdrawal ${wdId} Timeout` }),
                      map((v) => v['tx-hash']),
                      catchError((err) => of('')),
                      shareReplay(1),
                    ),
                  );

                  if (txId === '') {
                    const nextOrder = {
                      ...req,
                      status: 'ERROR',
                      error_message: 'WITHDRAW_TIMEOUT',
                      updated_at: Date.now(),
                    };
                    await updateTransferOrder(nextOrder);
                    return { res: { code: 500, message: 'TRANSFER_FAILED' } };
                  }

                  console.info(formatTime(Date.now()), 'Transfer', req.order_id, 'USDT TRC20', txId);

                  // 4. update the transfer order
                  const nextOrder: ITransferOrder = {
                    ...req,
                    status: 'AWAIT_DEBIT',
                    credit_method: method,
                    updated_at: Date.now(),
                    transferred_at: Date.now(),
                    transferred_amount: req.expected_amount,
                    transaction_id: txId,
                  };
                  await updateTransferOrder(nextOrder);
                  await firstValueFrom(terminal.requestService('Transfer', nextOrder));
                  return { res: { code: 0, message: 'OK' } };
                }
              }
            }

            const nextOrder = {
              ...req,
              status: 'ERROR',
              error_message: 'Method Not Available',
              updated_at: Date.now(),
            };
            await updateTransferOrder(nextOrder);
            return { res: { code: 400, message: 'NO_USABLE_CREDIT_METHOD' } };
          }
          return { res: { code: 400, message: 'NO_USABLE_CREDIT_METHOD' } };
        }

        return { res: { code: 400, message: 'INVALID_STATUS' } };
      }),
  );

  interface IFundingRate {
    series_id: string;
    datasource_id: string;
    product_id: string;
    base_currency: string;
    quote_currency: string;
    funding_at: number;
    funding_rate: number;
  }

  const wrapFundingRateRecord = (v: IFundingRate): IDataRecord<IFundingRate> => ({
    id: encodePath(v.datasource_id, v.product_id, v.funding_at),
    type: 'funding_rate',
    created_at: v.funding_at,
    updated_at: v.funding_at,
    frozen_at: v.funding_at,
    tags: {
      series_id: encodePath(v.datasource_id, v.product_id),
      datasource_id: v.datasource_id,
      product_id: v.product_id,
      base_currency: v.base_currency,
      quote_currency: v.quote_currency,
    },
    origin: {
      series_id: encodePath(v.datasource_id, v.product_id),
      datasource_id: v.datasource_id,
      product_id: v.product_id,
      base_currency: v.base_currency,
      quote_currency: v.quote_currency,
      funding_rate: v.funding_rate,
      funding_at: v.funding_at,
    },
  });

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
            series_id: { type: 'string', pattern: '^huobi/.+' },
          },
        },
      },
    },
    (msg, output$) => {
      const sub = interval(1000).subscribe(() => {
        output$.next({});
      });
      return defer(async () => {
        console.info(formatTime(Date.now()), `CopyDataRecords for ${account_id}`, JSON.stringify(msg));
        if (msg.req.tags?.series_id === undefined) {
          return { res: { code: 400, message: 'series_id is required' } };
        }
        const [start, end] = msg.req.time_range || [0, Date.now()];
        const [datasource_id, product_id] = decodePath(msg.req.tags.series_id);
        const mapProductIdToPerpetualProduct = await firstValueFrom(mapProductIdToPerpetualProduct$);
        const theProduct = mapProductIdToPerpetualProduct.get(product_id);
        if (!theProduct) {
          return { res: { code: 404, message: 'product_id not found' } };
        }
        const { base_currency, quote_currency } = theProduct;
        if (!base_currency || !quote_currency) {
          return { res: { code: 404, message: 'base_currency or quote_currency not found' } };
        }
        const funding_rate_history: IFundingRate[] = [];
        let current_page = 0;
        let total_page = 1;
        while (true) {
          const res = await client.getSwapHistoricalFundingRate({
            contract_code: product_id,
            page_index: current_page++,
          });
          if (res.status !== 'ok') {
            console.error(formatTime(Date.now()), `CopyDataRecords for ${account_id}`, JSON.stringify(res));
            return { res: { code: 500, message: 'not OK' } };
          }
          if (res.data.data.length === 0) {
            break;
          }
          for (const v of res.data.data) {
            if (+v.funding_time <= end) {
              funding_rate_history.push({
                series_id: msg.req.tags.series_id,
                datasource_id,
                product_id,
                base_currency,
                quote_currency,
                funding_rate: +v.funding_rate,
                funding_at: +v.funding_time,
              });
            }
          }
          total_page = res.data.total_page;
          if (current_page >= total_page || +res.data.data[res.data.data.length - 1].funding_time <= start) {
            break;
          }
          await firstValueFrom(timer(100));
        }
        funding_rate_history.sort((a, b) => +a.funding_at - +b.funding_at);

        await lastValueFrom(
          from(funding_rate_history).pipe(
            map(wrapFundingRateRecord),
            bufferCount(2000),
            mergeMap((v) => terminal.updateDataRecords(v).pipe(concatWith(of(void 0)))),
          ),
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
    { concurrent: 10 },
  );

  terminal.provideService(
    'TransferApply',
    {
      type: 'object',
      required: ['current_tx_account_id'],
      properties: {
        current_tx_account_id: {
          enum: [SPOT_ACCOUNT_ID, SUPER_MARGIN_ACCOUNT_ID, SWAP_ACCOUNT_ID],
        },
      },
    },
    (msg) =>
      defer(async () => {
        //
        const order = msg.req;
        const { current_tx_state, current_tx_account_id, current_network_id } = order;
        if (current_network_id === 'TRC20') {
          if (current_tx_account_id !== SPOT_ACCOUNT_ID) {
            return { res: { code: 400, message: `Only SPOT Account Can Withdraw ${current_tx_account_id}` } };
          }
          if (current_tx_state === 'INIT') {
            const res = await client.postWithdraw({
              address: order.current_rx_address!,
              amount: '' + order.expected_amount,
              currency: 'usdt',
              fee: '1',
              chain: 'trc20usdt',
            });
            if (res.status != 'ok') {
              return { res: { code: 500, message: 'TRANSFER_FAILED' } };
            }
            return { res: { code: 0, message: 'OK', data: { state: 'PENDING', context: `${res.data}` } } };
          }
          if (current_tx_state === 'PENDING') {
            if (!order.current_tx_context) {
              return { res: { code: 400, message: 'MISSING_CONTEXT' } };
            }
            const wdId = +order.current_tx_context;
            const res = await client.getDepositWithdrawHistory({
              currency: 'usdt',
              type: 'withdraw',
              from: `${wdId}`,
            });
            const txId = res.data.find((v) => v.id === wdId)?.['tx-hash'];
            if (!txId) {
              return { res: { code: 0, message: 'NOT_RECEIVED' } };
            }
            return {
              res: {
                code: 0,
                message: 'OK',
                data: {
                  state: 'COMPLETE',
                  transaction_id: txId,
                },
              },
            };
          }
          return { res: { code: 400, message: `UNKNOWN STATE ${current_tx_state}` } };
        }

        if (current_network_id === `Huobi/${huobiUid}/SPOT-SUPER_MARGIN`) {
          if (current_tx_state === 'INIT') {
            //
            if (current_tx_account_id === SPOT_ACCOUNT_ID) {
              // from SPOT to SUPER_MARGIN
              const transferInResult = await client.postSuperMarginAccountTransferIn({
                currency: 'usdt',
                amount: '' + order.expected_amount,
              });
              if (transferInResult.status !== 'ok') {
                return { res: { code: 500, message: 'TRANSFER_FAILED' } };
              }
              return { res: { code: 0, message: 'OK', data: { state: 'COMPLETE' } } };
            }
            if (current_tx_account_id === SUPER_MARGIN_ACCOUNT_ID) {
              // from SUPER_MARGIN to SPOT
              const transferOutResult = await client.postSuperMarginAccountTransferOut({
                currency: 'usdt',
                amount: '' + order.expected_amount,
              });
              if (transferOutResult.status !== 'ok') {
                return { res: { code: 500, message: 'TRANSFER_FAILED' } };
              }
              return { res: { code: 0, message: 'OK', data: { state: 'COMPLETE' } } };
            }
          }
          return { res: { code: 400, message: `UNKNOWN STATE ${current_tx_state}` } };
        }

        if (current_network_id === `Huobi/${huobiUid}/SPOT-SWAP`) {
          if (current_tx_state === 'INIT') {
            if (current_tx_account_id === SPOT_ACCOUNT_ID) {
              // from SPOT to SWAP
              const transferResult = await client.postSpotAccountTransfer({
                from: 'spot',
                to: 'linear-swap',
                currency: 'usdt',
                amount: order.expected_amount,
                'margin-account': 'USDT',
              });
              if (!transferResult.success) {
                return { res: { code: 500, message: 'TRANSFER_FAILED' } };
              }
              return { res: { code: 0, message: 'OK', data: { state: 'COMPLETE' } } };
            }
            if (current_tx_account_id === SWAP_ACCOUNT_ID) {
              // from SWAP to SPOT
              const transferResult = await client.postSpotAccountTransfer({
                from: 'linear-swap',
                to: 'spot',
                currency: 'usdt',
                amount: order.expected_amount,
                'margin-account': 'USDT',
              });
              if (!transferResult.success) {
                return { res: { code: 500, message: 'TRANSFER_FAILED' } };
              }
              return { res: { code: 0, message: 'OK', data: { state: 'COMPLETE' } } };
            }
          }
        }

        return { res: { code: 400, message: `UNKNOWN NETWORK ${current_network_id}` } };
      }),
  );

  terminal.provideService(
    'TransferEval',
    {
      type: 'object',
      required: ['current_rx_account_id'],
      properties: {
        current_rx_account_id: {
          enum: [SPOT_ACCOUNT_ID, SUPER_MARGIN_ACCOUNT_ID, SWAP_ACCOUNT_ID],
        },
      },
    },
    (msg) =>
      defer(async () => {
        const order = msg.req;
        const { current_rx_account_id, current_network_id } = order;
        if (current_network_id === 'TRC20') {
          if (current_rx_account_id !== SPOT_ACCOUNT_ID) {
            return { res: { code: 400, message: `Only SPOT Account Can Receive ${current_rx_account_id}` } };
          }
          const res = await client.getDepositWithdrawHistory({
            currency: 'usdt',
            type: 'deposit',
            direct: 'next',
          });

          const theItem = res.data.find((v) => v['tx-hash'] === order.transaction_id && v.state === 'safe');
          if (!theItem) {
            return { res: { code: 0, message: 'NOT_RECEIVED' } };
          }
          return { res: { code: 0, message: 'OK', data: { received_amount: +theItem.amount } } };
        }

        if (current_network_id === `Huobi/${huobiUid}/SPOT-SUPER_MARGIN`) {
          return { res: { code: 0, message: 'OK', data: { received_amount: order.expected_amount } } };
        }

        if (current_network_id === `Huobi/${huobiUid}/SPOT-SWAP`) {
          return { res: { code: 0, message: 'OK', data: { received_amount: order.expected_amount } } };
        }

        return { res: { code: 400, message: 'UNKNOWN ROUTING' } };
      }),
  );

  // Update Spot TRC20 Addresses
  {
    const res = await client.getSpotAccountDepositAddresses({ currency: 'usdt' });
    const addresses = res.data.filter((v) => v.chain === 'trc20usdt').map((v) => v.address);
    const info = [
      ...addresses.map(
        (address): IAccountAddressInfo => ({
          account_id: SPOT_ACCOUNT_ID,
          currency: 'USDT',
          address: address,
          network_id: 'TRC20',
        }),
      ),
      {
        account_id: SPOT_ACCOUNT_ID,
        currency: 'USDT',
        address: 'SPOT',
        network_id: `Huobi/${huobiUid}/SPOT-SUPER_MARGIN`,
      },
      {
        account_id: SUPER_MARGIN_ACCOUNT_ID,
        currency: 'USDT',
        address: 'SUPER_MARGIN',
        network_id: `Huobi/${huobiUid}/SPOT-SUPER_MARGIN`,
      },
      {
        account_id: SPOT_ACCOUNT_ID,
        currency: 'USDT',
        address: 'SPOT',
        network_id: `Huobi/${huobiUid}/SPOT-SWAP`,
      },
      {
        account_id: SWAP_ACCOUNT_ID,
        currency: 'USDT',
        address: 'SWAP',
        network_id: `Huobi/${huobiUid}/SPOT-SWAP`,
      },
    ].map(wrapAccountAddressInfo);
    terminal.updateDataRecords(info).subscribe();
  }
})();
