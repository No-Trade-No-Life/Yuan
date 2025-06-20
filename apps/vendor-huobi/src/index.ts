import { IAccountInfo, IAccountMoney, IOrder, IPosition, ITick, formatTime } from '@yuants/data-model';
import { provideAccountInfo, provideTicks } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/transfer/lib/services';
import { addAccountTransferAddress } from '@yuants/transfer';
import { roundToStep } from '@yuants/utils';
import {
  EMPTY,
  catchError,
  combineLatest,
  combineLatestWith,
  defer,
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
import { client } from './api';
import './interest_rate';
import { perpetualContractProducts$, spotProducts$ } from './product';
import { terminal } from './terminal';

(async () => {
  const swapAccountTypeRes = await client.getSwapUnifiedAccountType();
  if (swapAccountTypeRes.data.account_type !== 2) {
    console.info(
      formatTime(Date.now()),
      'SwitchingAccountType',
      `previous: ${swapAccountTypeRes.data.account_type}, switching to 2 (unified account)`,
    );
    const switchRes = await client.postSwapSwitchAccountType({ account_type: 2 });
    console.info(formatTime(Date.now()), 'SwitchingAccountType', `current: ${switchRes.data.account_type}`);
  }

  const huobiUid: number = (await client.getUid()).data;
  console.info(formatTime(Date.now()), 'UID', huobiUid);

  const huobiAccounts = await client.getAccount();
  const superMarginAccountUid = huobiAccounts.data.find((v) => v.type === 'super-margin')?.id!;
  const spotAccountUid = huobiAccounts.data.find((v) => v.type === 'spot')?.id!;
  console.info(formatTime(Date.now()), 'huobiAccount', JSON.stringify(huobiAccounts));

  const account_id = `huobi/${huobiUid}`;
  const SPOT_ACCOUNT_ID = `${account_id}/spot/usdt`;
  const SUPER_MARGIN_ACCOUNT_ID = `${account_id}/super-margin`;
  const SWAP_ACCOUNT_ID = `${account_id}/swap`;

  const subUsersRes = await client.getSubUserList();
  const subAccounts = subUsersRes.data;
  const isMainAccount = subUsersRes.ok;
  console.info(formatTime(Date.now()), 'subAccounts', JSON.stringify(subAccounts));

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

  const mapSwapContractCodeToOpenInterest$ = defer(() => client.getSwapOpenInterest({})).pipe(
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

  provideTicks(terminal, 'HUOBI-SWAP', (product_id) => {
    return defer(async () => {
      const products = await firstValueFrom(perpetualContractProducts$);
      const theProduct = products.find((x) => x.product_id === product_id);
      if (!theProduct) throw `No Found ProductID ${product_id}`;

      return [
        of(theProduct),
        mapSwapContractCodeToBboTick$,
        mapSwapContractCodeToTradeTick$,
        mapSwapContractCodeToFundingRateTick$,
        mapSwapContractCodeToOpenInterest$,
      ] as const;
    }).pipe(
      catchError(() => EMPTY),
      mergeMap((x) =>
        combineLatest(x).pipe(
          map(([theProduct, bboTick, tradeTick, fundingRateTick, openInterest]): ITick => {
            return {
              datasource_id: 'HUOBI-SWAP',
              product_id,
              updated_at: Date.now(),
              settlement_scheduled_at: +fundingRateTick[product_id].funding_time,
              price: +tradeTick[product_id].price,
              ask: bboTick[product_id].ask?.[0] ?? undefined,
              bid: bboTick[product_id].bid?.[0] ?? undefined,
              volume: +tradeTick[product_id].amount,
              interest_rate_for_long: -+fundingRateTick[product_id].funding_rate,
              interest_rate_for_short: +fundingRateTick[product_id].funding_rate,
              open_interest: +openInterest[product_id]?.volume,
            };
          }),
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
                datasource_id: 'HUOBI-SWAP',
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
          defer(() =>
            client.getSwapOpenOrders({
              page_index: v.page_index,
              page_size: v.page_size,
            }),
          ).pipe(
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
          const money: IAccountMoney = {
            currency: 'USDT',
            balance: balance.cross_margin_static,
            equity: balance.margin_balance,
            profit: balance.cross_profit_unreal,
            free: balance.withdraw_available,
            used: balance.margin_balance - balance.withdraw_available,
          };
          return {
            updated_at: Date.now(),
            account_id: SWAP_ACCOUNT_ID,
            money: money,
            currencies: [money],
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
  from(client.spot_ws.connection$).subscribe(() => {
    subscriptions.clear();
  });
  // subscribe the symbols of positions we held
  superMarginUnifiedRawAccountBalance$
    .pipe(
      //
      mergeMap((res) =>
        from(res?.list || []).pipe(
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
          from(res?.list || []).pipe(
            filter((v) => v.currency === 'usdt'),
            reduce((acc, cur) => acc + +cur.balance, 0),
          ),
        ),
      );
      const position$ = superMarginUnifiedRawAccountBalance$.pipe(
        //
        mergeMap((res) =>
          from(res?.list || []).pipe(
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
          const money: IAccountMoney = {
            currency: 'USDT',
            balance: equity,
            equity: equity,
            profit: 0,
            free: equity,
            used: 0,
          };
          return {
            updated_at: Date.now(),
            account_id: SUPER_MARGIN_ACCOUNT_ID,
            money: money,
            currencies: [money],
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
      const money: IAccountMoney = {
        currency: 'USDT',
        balance,
        equity,
        profit: 0,
        free,
        used: 0,
      };
      return {
        updated_at: Date.now(),
        account_id: SPOT_ACCOUNT_ID,
        money: money,
        currencies: [money],
        positions: [],
        orders: [],
      };
    }),
    shareReplay(1),
  );

  provideAccountInfo(terminal, spotAccountInfo$);
  provideAccountInfo(terminal, superMarginAccountInfo$);
  provideAccountInfo(terminal, perpetualContractAccountInfo$);

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

  // Update Spot TRC20 Addresses (Only Main Account)
  if (isMainAccount) {
    const res = await client.getSpotAccountDepositAddresses({ currency: 'usdt' });
    const addresses = res.data.filter((v) => v.chain === 'trc20usdt').map((v) => v.address);

    for (const address of addresses) {
      addAccountTransferAddress({
        terminal,
        account_id: SPOT_ACCOUNT_ID,
        currency: 'USDT',
        address: address,
        network_id: 'TRC20',
        onApply: {
          INIT: async (order) => {
            const res0 = await client.getV2ReferenceCurrencies({ currency: 'usdt' });
            const fee = res0.data
              .find((v) => v.currency === 'usdt')
              ?.chains.find((v) => v.chain === 'trc20usdt')?.transactFeeWithdraw;
            if (!fee) {
              return { state: 'ERROR', message: 'MISSING FEE' };
            }
            const res = await client.postWithdraw({
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
            const res = await client.getDepositWithdrawHistory({
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
          const res = await client.getDepositWithdrawHistory({
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
  }

  addAccountTransferAddress({
    terminal,
    account_id: SPOT_ACCOUNT_ID,
    currency: 'USDT',
    network_id: `Huobi/${huobiUid}/SPOT-SUPER_MARGIN`,
    address: 'SPOT',
    onApply: {
      INIT: async (order) => {
        const transferInResult = await client.postSuperMarginAccountTransferIn({
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

  addAccountTransferAddress({
    terminal,
    account_id: SUPER_MARGIN_ACCOUNT_ID,
    currency: 'USDT',
    network_id: `Huobi/${huobiUid}/SPOT-SUPER_MARGIN`,
    address: 'SUPER_MARGIN',
    onApply: {
      INIT: async (order) => {
        const transferOutResult = await client.postSuperMarginAccountTransferOut({
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

  addAccountTransferAddress({
    terminal,
    account_id: SPOT_ACCOUNT_ID,
    currency: 'USDT',
    network_id: `Huobi/${huobiUid}/SPOT-SWAP`,
    address: 'SPOT',
    onApply: {
      INIT: async (order) => {
        const transferResult = await client.postSpotAccountTransfer({
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

  addAccountTransferAddress({
    terminal,
    account_id: SWAP_ACCOUNT_ID,
    currency: 'USDT',
    network_id: `Huobi/${huobiUid}/SPOT-SWAP`,
    address: 'SWAP',
    onApply: {
      INIT: async (order) => {
        const transferResult = await client.postSpotAccountTransfer({
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

  if (isMainAccount) {
    for (const subAccount of subAccounts) {
      const SPOT_SUB_ACCOUNT_ID = `huobi/${subAccount.uid}/spot/usdt`;

      const SUB_ACCOUNT_NETWORK_ID = `Huobi/${huobiUid}/SubAccount/${subAccount.uid}`;
      addAccountTransferAddress({
        terminal,
        account_id: SPOT_ACCOUNT_ID,
        currency: 'USDT',
        network_id: SUB_ACCOUNT_NETWORK_ID,
        address: '#main',
        onApply: {
          INIT: async (order) => {
            const transferResult = await client.postSubUserTransfer({
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
      addAccountTransferAddress({
        terminal,
        account_id: SPOT_SUB_ACCOUNT_ID,
        currency: 'USDT',
        network_id: SUB_ACCOUNT_NETWORK_ID,
        address: `${subAccount.uid}`,
        onApply: {
          INIT: async (order) => {
            const transferResult = await client.postSubUserTransfer({
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
  }
})();
