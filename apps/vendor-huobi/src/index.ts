import {
  IAccountInfo,
  IOrder,
  IPosition,
  IProduct,
  ITransferOrder,
  OrderDirection,
  OrderType,
  PositionVariant,
  decodePath,
  encodePath,
  formatTime,
} from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import { roundToStep } from '@yuants/utils';
import {
  EMPTY,
  Observable,
  catchError,
  combineLatest,
  combineLatestWith,
  concatWith,
  defer,
  delayWhen,
  distinct,
  expand,
  filter,
  first,
  firstValueFrom,
  from,
  groupBy,
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
  toArray,
} from 'rxjs';
import { HuobiClient } from './api';

(async () => {
  if (process.env.DEBUG_MODE === 'true') {
    return;
  }
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
        mergeMap((res) =>
          from(res.data).pipe(
            map((v): IPosition => {
              return {
                position_id: `${v.contract_code}/${v.contract_type}/${v.direction}/${v.margin_mode}`,
                product_id: v.contract_code,
                variant: v.direction === 'buy' ? PositionVariant.LONG : PositionVariant.SHORT,
                volume: v.volume,
                free_volume: v.available,
                position_price: v.cost_hold,
                closable_price: v.last_price,
                floating_profit: v.profit_unreal,
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
                exchange_order_id: v.order_id_str,
                client_order_id: v.order_id_str,
                account_id,
                product_id: v.contract_code,
                type: ['lightning'].includes(v.order_price_type)
                  ? OrderType.MARKET
                  : ['limit', 'opponent', 'post_only', 'optimal_5', 'optimal_10', 'optimal_20'].includes(
                      v.order_price_type,
                    )
                  ? OrderType.LIMIT
                  : ['fok'].includes(v.order_price_type)
                  ? OrderType.FOK
                  : v.order_price_type.includes('ioc')
                  ? OrderType.IOC
                  : OrderType.STOP, // unreachable code
                direction:
                  v.direction === 'open'
                    ? v.offset === 'buy'
                      ? OrderDirection.OPEN_LONG
                      : OrderDirection.OPEN_SHORT
                    : v.offset === 'buy'
                    ? OrderDirection.CLOSE_SHORT
                    : OrderDirection.CLOSE_LONG,
                volume: v.volume,
                timestamp_in_us: v.created_at * 1000,
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
            account_id: `${account_id}/swap`,
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

  const unifiedRawAccountBalance$ = defer(() => client.getSpotAccountBalance(superMarginAccountUid)).pipe(
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
  unifiedRawAccountBalance$
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
      const balance$ = unifiedRawAccountBalance$.pipe(
        //
        mergeMap((res) =>
          from(res.list).pipe(
            filter((v) => v.currency === 'usdt'),
            reduce((acc, cur) => acc + +cur.balance, 0),
          ),
        ),
      );
      const position$ = unifiedRawAccountBalance$.pipe(
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
                    variant: PositionVariant.LONG,
                    volume: v.balance,
                    free_volume: v.balance,
                    position_price: price,
                    closable_price: price,
                    floating_profit: 0,
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
            account_id: `${account_id}/super-margin`,
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

  terminal.provideAccountInfo(superMarginAccountInfo$);
  terminal.provideAccountInfo(perpetualContractAccountInfo$);

  // Submit order
  terminal.provideService(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: {
          enum: [`${account_id}/super-margin`, `${account_id}/swap`],
        },
      },
    },
    (msg) => {
      const { account_id: req_account_id } = msg.req;
      console.info(formatTime(Date.now()), `SubmitOrder for ${account_id}`, JSON.stringify(msg));

      if (req_account_id === `${account_id}/swap`) {
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
              offset: [OrderDirection.OPEN_LONG, OrderDirection.OPEN_SHORT].includes(msg.req.direction)
                ? 'open'
                : 'close',
              direction: [OrderDirection.OPEN_LONG, OrderDirection.CLOSE_SHORT].includes(msg.req.direction)
                ? 'buy'
                : 'sell',
              // dynamically adjust the leverage
              lever_rate,
              order_price_type: msg.req.type === OrderType.MARKET ? 'market' : 'limit',
            };
            return client.placeSwapOrder(params).then((v) => {
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
          unifiedRawAccountBalance$.pipe(
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
          const borrow_amount = [OrderDirection.OPEN_LONG, OrderDirection.CLOSE_SHORT].includes(
            msg.req.direction,
          )
            ? Math.max(Math.min(loanable, msg.req.volume * price - balance), 0)
            : undefined;
          const params = {
            symbol: msg.req.product_id,
            'account-id': '' + superMarginAccountUid,
            // amount: msg.req.type === OrderType.MARKET ? 0 : '' + msg.req.volume,
            // 'market-amount': msg.req.type === OrderType.MARKET ? '' + msg.req.volume : undefined,
            amount:
              '' +
              ([OrderDirection.OPEN_LONG, OrderDirection.CLOSE_SHORT].includes(msg.req.direction)
                ? roundToStep(msg.req.volume * price, theProduct?.volume_step!)
                : msg.req.volume),
            'borrow-amount': '' + borrow_amount,
            type: `${
              [OrderDirection.OPEN_LONG, OrderDirection.CLOSE_SHORT].includes(msg.req.direction)
                ? 'buy'
                : 'sell'
            }-${OrderType.LIMIT === msg.req.type ? 'limit' : 'market'}`,
            'trade-purpose': [OrderDirection.OPEN_LONG, OrderDirection.CLOSE_SHORT].includes(
              msg.req.direction,
            )
              ? '1' // auto borrow
              : '2', // auto repay
            price: msg.req.type === OrderType.MARKET ? undefined : '' + msg.req.price,
            source: 'super-margin-api',
          };
          return client.placeSpotOrder(params).then((v) => {
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
    encodePath(`huobi`, `account_internal`, `${account_id}/super-margin`),
    encodePath(`huobi`, `account_internal`, `${account_id}/swap`),
    ...(await firstValueFrom(blockchainAddress$)),
  ];

  const updateTransferOrder = (transferOrder: ITransferOrder): Observable<void> => {
    return terminal
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
      .pipe(concatWith(of(void 0)));
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
              enum: [`${account_id}/super-margin`, `${account_id}/swap`],
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
              enum: [`${account_id}/super-margin`, `${account_id}/swap`],
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
    (msg) => {
      console.info(formatTime(Date.now()), `Transfer for ${account_id}`, JSON.stringify(msg));
      const req = msg.req;
      const { credit_account_id, debit_account_id, status } = req;

      if (req.timeout_at < Date.now()) {
        return defer(() =>
          updateTransferOrder({
            ...req,
            status: 'ERROR',
            error_message: `Transaction Timeout: ${formatTime(req.timeout_at)}`,
            updated_at: Date.now(),
          }),
        ).pipe(map(() => ({ res: { code: 500, message: 'TRANSFER_TIMEOUT' } })));
      }

      if (status === 'AWAIT_DEBIT') {
        // if we are the debit side
        if (!req.debit_methods?.length) {
          console.info(formatTime(Date.now()), 'Transfer', 'DEBIT', 'adding debit methods');
          const nextReq = { ...req, debit_methods, status: 'AWAIT_CREDIT', updated_at: Date.now() };
          return updateTransferOrder(nextReq).pipe(
            mergeMap(() =>
              defer(() => terminal.requestService('Transfer', nextReq)).pipe(
                retry({ delay: 5000, count: 3 }),
              ),
            ),
            map(() => ({ res: { code: 0, message: 'OK' } })),
          );
        }

        // the transfer is ongoing
        if (req.credit_method) {
          const parts = decodePath(req.credit_method);
          if (parts[0] === 'huobi') {
            if (parts[1] === 'account_internal') {
              return defer(async () => {
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
                  (v) => v.transactTime >= req.transferred_at! && -v.transactAmt === req.transferred_amount,
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
                delayWhen((v) => updateTransferOrder(v)),
                map(() => ({ res: { code: 0, message: 'OK' } })),
              );
            }
          }
          return of({ res: { code: 500, message: 'UNIMPLEMENTED' } });
        }
        return of({ res: { code: 0, message: 'OK' } });
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
            if (debit_methods.includes(method)) {
              // method matched
              const parts = decodePath(method);
              if (parts[0] === 'huobi') {
                if (parts[1] === 'account_internal') {
                  const target_account_id = parts[2];
                  if (target_account_id === credit_account_id) {
                    // we cannot transfer to ourselves
                    continue;
                  }
                  // if we are playing the role of super-margin account
                  if (
                    credit_account_id === `${account_id}/super-margin` &&
                    target_account_id === `${account_id}/swap`
                  ) {
                    console.info(formatTime(Date.now()), 'Transfer', 'CREDIT', 'from super-margin to swap');

                    const updated_at = Date.now();

                    return defer(async () => {
                      // 0. if we don't have enough usdt, we need to borrow
                      const toTransfer = req.expected_amount;
                      const usdtBalance = await firstValueFrom(
                        unifiedRawAccountBalance$.pipe(
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
                        const borrowResult = await client.borrow({
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
                          throw new Error('TRANSFER_FAILED');
                        }
                      }

                      // 1. transfer the amount of usdt to the spot account
                      const transferOutResult = await client.superMarginAccountTransferOut({
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
                        throw new Error('TRANSFER_FAILED');
                      }
                      // 2. transfer the amount of usdt to the spot account
                      const transferInResult = await client.spotAccountTransfer({
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
                        throw new Error('TRANSFER_FAILED');
                      }
                      return {
                        ...req,
                        status: 'AWAIT_DEBIT',
                        credit_method: method,
                        transferred_at: updated_at,
                        transferred_amount: req.expected_amount,
                        updated_at,
                      };
                    }).pipe(
                      delayWhen((v) => updateTransferOrder(v)),
                      delayWhen((v) => terminal.requestService('Transfer', v)),
                      map(() => ({ res: { code: 0, message: 'OK' } })),
                      catchError((e) => {
                        console.error(formatTime(Date.now()), 'Transfer', 'CREDIT', e);

                        return updateTransferOrder({
                          ...req,
                          status: 'ERROR',
                          error_message: `MARGIN-TO-SWAP: ${e}`,
                          updated_at,
                        }).pipe(map(() => ({ res: { code: 500, message: 'TRANSFER_FAILED' } })));
                      }),
                    );
                  }
                  if (
                    credit_account_id === `${account_id}/swap` &&
                    target_account_id === `${account_id}/super-margin`
                  ) {
                    const updated_at = Date.now();
                    return defer(async () => {
                      const transferOutResult = await client.spotAccountTransfer({
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
                        throw new Error('TRANSFER_FAILED');
                      }
                      const transferInResult = await client.superMarginAccountTransferIn({
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
                        throw new Error('TRANSFER_FAILED');
                      }
                      return {
                        ...req,
                        status: 'AWAIT_DEBIT',
                        credit_method: method,
                        transferred_at: updated_at,
                        transferred_amount: req.expected_amount,
                        updated_at,
                      };
                    }).pipe(
                      delayWhen((v) => updateTransferOrder(v)),
                      delayWhen((v) => terminal.requestService('Transfer', v)),
                      map(() => ({ res: { code: 0, message: 'OK' } })),
                      catchError((e) => {
                        console.error(formatTime(Date.now()), 'Transfer', 'CREDIT', e);

                        return updateTransferOrder({
                          ...req,
                          status: 'ERROR',
                          error_message: `SWAP-TO-MARGIN SIDE: ${e}`,
                          updated_at,
                        }).pipe(map(() => ({ res: { code: 500, message: 'TRANSFER_FAILED' } })));
                      }),
                    );
                  }
                }
              }
            }
          }
          return updateTransferOrder({
            ...req,
            status: 'ERROR',
            error_message: 'Method Not Available',
          }).pipe(map(() => ({ res: { code: 400, message: 'NO_USABLE_CREDIT_METHOD' } })));
        }
        return of({ res: { code: 400, message: 'NO_USABLE_CREDIT_METHOD' } });
      }

      return of({ res: { code: 400, message: 'INVALID_STATUS' } });
    },
  );
})();

// for testing - to be removed after the api implementation is done
(async () => {
  if (process.env.DEBUG_MODE !== 'true') {
    return;
  }
  const client = new HuobiClient({
    auth: {
      access_key: process.env.ACCESS_KEY!,
      secret_key: process.env.SECRET_KEY!,
    },
  });

  const huobiAccount = await client.getAccount();
  console.info(formatTime(Date.now()), 'huobiAccount', JSON.stringify(huobiAccount));

  const uid = huobiAccount.data[0].id;

  console.info(
    JSON.stringify(await client.request('GET', '/v1/cross-margin/loan-info', client.spot_api_root)),
  );

  const priceRes = await client.request('GET', `/market/detail/merged`, client.spot_api_root, {
    symbol: 'dogeusdt',
  });
  console.info(priceRes);

  console.info(
    JSON.stringify(
      await client.request('GET', `/v1/account/accounts/${60841683}/balance`, client.spot_api_root),
    ),
  );
})();
