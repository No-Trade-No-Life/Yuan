import {
  addAccountMarket,
  IAccountInfo,
  IAccountMoney,
  IPosition,
  publishAccountInfo,
} from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { addAccountTransferAddress } from '@yuants/transfer';
import { formatTime, roundToStep } from '@yuants/utils';
import {
  catchError,
  combineLatestWith,
  defer,
  distinct,
  filter,
  first,
  firstValueFrom,
  from,
  map,
  mergeMap,
  of,
  reduce,
  repeat,
  retry,
  shareReplay,
  tap,
  timeout,
  toArray,
} from 'rxjs';
import { client } from './api';
import './interest_rate';
import { perpetualContractProducts$, spotProducts$ } from './product';
import './quote';

const terminal = Terminal.fromNodeEnv();

(async () => {
  const swapAccountTypeRes = await client.getSwapUnifiedAccountType();
  if (swapAccountTypeRes.data?.account_type === 1) {
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

  const mapProductIdToPerpetualProduct$ = perpetualContractProducts$.pipe(
    map((x) => new Map(x.map((v) => [v.product_id, v]))),
    shareReplay(1),
  );

  const perpetualContractAccountInfo$ = defer(async () => {
    // balance
    const balance = await client.getUnifiedAccountInfo();
    if (!balance.data) {
      throw new Error('Failed to get unified account info');
    }
    const balanceData = balance.data.find((v) => v.margin_asset === 'USDT');
    if (!balanceData) {
      throw new Error('No USDT balance found in unified account');
    }
    const money: IAccountMoney = {
      currency: 'USDT',
      balance: balanceData.cross_margin_static,
      equity: balanceData.margin_balance,
      profit: balanceData.cross_profit_unreal,
      free: balanceData.withdraw_available,
      used: balanceData.margin_balance - balanceData.withdraw_available,
    };

    // positions
    const positionsRes = await client.getSwapCrossPositionInfo();
    const mapProductIdToPerpetualProduct = await firstValueFrom(mapProductIdToPerpetualProduct$);
    const positions: IPosition[] = (positionsRes.data || []).map((v): IPosition => {
      const product_id = v.contract_code;
      const theProduct = mapProductIdToPerpetualProduct?.get(product_id);
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
    });

    // orders
    // const orders: IOrder[] = [];
    // let page_index = 1;
    // const page_size = 50;

    // while (true) {
    //   const ordersRes = await client.getSwapOpenOrders({ page_index, page_size });
    //   if (!ordersRes.data?.orders || ordersRes.data.orders.length === 0) {
    //     break;
    //   }

    //   const pageOrders: IOrder[] = ordersRes.data.orders.map((v): IOrder => {
    //     return {
    //       order_id: v.order_id_str,
    //       account_id: SWAP_ACCOUNT_ID,
    //       product_id: v.contract_code,
    //       order_type: ['lightning'].includes(v.order_price_type)
    //         ? 'MARKET'
    //         : ['limit', 'opponent', 'post_only', 'optimal_5', 'optimal_10', 'optimal_20'].includes(
    //             v.order_price_type,
    //           )
    //         ? 'LIMIT'
    //         : ['fok'].includes(v.order_price_type)
    //         ? 'FOK'
    //         : v.order_price_type.includes('ioc')
    //         ? 'IOC'
    //         : 'STOP', // unreachable code
    //       order_direction:
    //         v.direction === 'open'
    //           ? v.offset === 'buy'
    //             ? 'OPEN_LONG'
    //             : 'OPEN_SHORT'
    //           : v.offset === 'buy'
    //           ? 'CLOSE_SHORT'
    //           : 'CLOSE_LONG',
    //       volume: v.volume,
    //       submit_at: v.created_at,
    //       price: v.price,
    //       traded_volume: v.trade_volume,
    //     };
    //   });

    //   orders.push(...pageOrders);
    //   page_index++;
    // }

    const accountInfo: IAccountInfo = {
      updated_at: Date.now(),
      account_id: SWAP_ACCOUNT_ID,
      money: money,
      positions,
    };

    return accountInfo;
  }).pipe(
    repeat({ delay: 1000 }),
    tap({
      error: (e) => {
        console.error(formatTime(Date.now()), 'perpetualContractAccountInfo', e);
      },
    }),
    retry({ delay: 1000 }),
    shareReplay(1),
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

  const superMarginAccountInfo$ = defer(async () => {
    // get account balance
    const accountBalance = await client.getSpotAccountBalance(superMarginAccountUid);
    const balanceList = accountBalance.data?.list || [];

    // calculate usdt balance
    const usdtBalance = balanceList
      .filter((v) => v.currency === 'usdt')
      .reduce((acc, cur) => acc + +cur.balance, 0);

    // get positions (non-usdt currencies)
    const positions: IPosition[] = [];
    const nonUsdtCurrencies = balanceList
      .filter((v) => v.currency !== 'usdt')
      .reduce((acc, cur) => {
        const existing = acc.find((item) => item.currency === cur.currency);
        if (existing) {
          existing.balance += +cur.balance;
        } else {
          acc.push({ currency: cur.currency, balance: +cur.balance });
        }
        return acc;
      }, [] as { currency: string; balance: number }[]);

    // get prices and create positions
    for (const currencyData of nonUsdtCurrencies) {
      if (currencyData.balance > 0) {
        try {
          // get current price from websocket or fallback to REST API
          let price: number;
          try {
            const tickPrice = await firstValueFrom(
              client.spot_ws.input$.pipe(
                //
                first((v) => v.ch?.includes('ticker') && v.ch?.includes(currencyData.currency) && v.tick),
                map((v): number => v.tick.bid),
                timeout(5000),
                tap({
                  error: (e) => {
                    subscriptions.clear();
                  },
                }),
              ),
            );
            price = tickPrice;
          } catch {
            // fallback to REST API
            const tickerRes = await client.getSpotTick({ symbol: `${currencyData.currency}usdt` });
            price = tickerRes.tick.close;
          }

          positions.push({
            position_id: `${currencyData.currency}/usdt/spot`,
            product_id: `${currencyData.currency}usdt`,
            direction: 'LONG',
            volume: currencyData.balance,
            free_volume: currencyData.balance,
            position_price: price,
            closable_price: price,
            floating_profit: 0,
            valuation: currencyData.balance * price,
          });
        } catch (error) {
          console.warn(formatTime(Date.now()), `Failed to get price for ${currencyData.currency}:`, error);
        }
      }
    }

    // calculate equity
    const equity = positions.reduce((acc, cur) => acc + cur.closable_price * cur.volume, 0) + usdtBalance;

    const money: IAccountMoney = {
      currency: 'USDT',
      balance: equity,
      equity: equity,
      profit: 0,
      free: equity,
      used: 0,
    };

    const accountInfo: IAccountInfo = {
      updated_at: Date.now(),
      account_id: SUPER_MARGIN_ACCOUNT_ID,
      money: money,
      positions,
    };

    return accountInfo;
  }).pipe(
    repeat({ delay: 1000 }),
    tap({
      error: (e) => {
        console.error(formatTime(Date.now()), 'superMarginAccountInfo', e);
      },
    }),
    retry({ delay: 5000 }),
    shareReplay(1),
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
        positions: [],
      };
    }),
    shareReplay(1),
  );

  publishAccountInfo(terminal, SPOT_ACCOUNT_ID, spotAccountInfo$);
  addAccountMarket(terminal, { account_id: SPOT_ACCOUNT_ID, market_id: 'HUOBI/SPOT' });
  publishAccountInfo(terminal, SUPER_MARGIN_ACCOUNT_ID, superMarginAccountInfo$);
  addAccountMarket(terminal, { account_id: SUPER_MARGIN_ACCOUNT_ID, market_id: 'HUOBI/SUPER-MARGIN' });
  publishAccountInfo(terminal, SWAP_ACCOUNT_ID, perpetualContractAccountInfo$);
  addAccountMarket(terminal, { account_id: SWAP_ACCOUNT_ID, market_id: 'HUOBI/SWAP' });

  // Submit order
  terminal.server.provideService<IOrder>(
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
