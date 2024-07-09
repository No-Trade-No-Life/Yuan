import {
  decodePath,
  encodePath,
  formatTime,
  IAccountInfo,
  IAccountMoney,
  IDataRecord,
  IOrder,
  IPosition,
  IProduct,
  UUID,
} from '@yuants/data-model';
import { provideAccountInfo, Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import {
  combineLatest,
  combineLatestWith,
  concatWith,
  defer,
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
  throttleTime,
  toArray,
} from 'rxjs';
import { GateClient } from './api';
import { addAccountTransferAddress } from './utils/addAccountTransferAddress';

(async () => {
  const client = new GateClient({
    auth: {
      access_key: process.env.ACCESS_KEY!,
      secret_key: process.env.SECRET_KEY!,
    },
  });

  const gate_account = await client.getAccountDetail();
  const uid = gate_account.user_id;

  const FUTURE_USDT_ACCOUNT_ID = `gate/${uid}/future/USDT`;
  const SPOT_USDT_ACCOUNT_ID = `gate/${uid}/spot/USDT`;

  const terminal = new Terminal(process.env.HOST_URL!, {
    terminal_id: process.env.TERMINAL_ID || `@yuants/vendor-gate/${uid}/${UUID()}`,
  });

  const usdtFutureProducts$ = defer(() => client.getFuturesContracts('usdt', {})).pipe(
    mergeMap((contracts) =>
      from(contracts).pipe(
        map((contract): IProduct => {
          const [base, quote] = contract.name.split('_');
          return {
            datasource_id: 'gate/future',
            product_id: contract.name,
            base_currency: base,
            quote_currency: quote,
            value_scale: +contract.quanto_multiplier,
            price_step: +contract.order_price_round,
            volume_step: 1,
          };
        }),
        toArray(),
      ),
    ),

    repeat({ delay: 3600_000 }),
    retry({ delay: 60_000 }),
    shareReplay(1),
  );

  usdtFutureProducts$.subscribe((products) => {
    terminal.updateProducts(products).subscribe();
  });

  const mapProductIdToUsdtFutureProduct$ = usdtFutureProducts$.pipe(
    map((x) => new Map(x.map((x) => [x.product_id, x]))),
    shareReplay(1),
  );

  const accountFuturePosition$ = defer(() => client.getFuturePositions('usdt')).pipe(
    //
    map((res) => (res instanceof Array ? res : [])),
    mergeMap((res) =>
      from(res).pipe(
        combineLatestWith(mapProductIdToUsdtFutureProduct$.pipe(first())),
        map(([position, mapProductIdToUsdtFutureProduct]): IPosition => {
          const product_id = position.contract;
          const theProduct = mapProductIdToUsdtFutureProduct.get(product_id);
          const volume = Math.abs(position.size);
          const closable_price = +position.mark_price;
          const valuation = volume * closable_price * (theProduct?.value_scale ?? 1);
          return {
            position_id: `${position.contract}-${position.leverage}-${position.mode}`,
            product_id,
            direction:
              position.mode === 'dual_long'
                ? 'LONG'
                : position.mode === 'dual_short'
                ? 'SHORT'
                : position.size > 0
                ? 'LONG'
                : 'SHORT',
            volume: volume,
            free_volume: Math.abs(position.size),
            position_price: +position.entry_price,
            closable_price,
            floating_profit: +position.unrealised_pnl,
            valuation,
          };
        }),
        toArray(),
      ),
    ),
    repeat({ delay: 1000 }),
    tap({
      error: (err) => {
        console.error(formatTime(Date.now()), 'futuresAccountInfoPosition$', err);
      },
    }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );

  const accountFutureOpenOrders$ = defer(() => client.getFuturesOrders('usdt', { status: 'open' })).pipe(
    //
    map((res) => (res instanceof Array ? res : [])),
    mergeMap((res) =>
      from(res).pipe(
        map((order): IOrder => {
          return {
            order_id: order.id,
            account_id: FUTURE_USDT_ACCOUNT_ID,
            submit_at: order.create_time * 1000,
            product_id: order.contract,
            order_type: 'LIMIT',
            order_direction:
              order.size > 0
                ? order.is_close
                  ? 'CLOSE_SHORT'
                  : 'OPEN_LONG'
                : order.is_close
                ? 'CLOSE_LONG'
                : 'OPEN_SHORT',
            volume: Math.abs(order.size),
            price: order.price !== undefined ? +order.price : undefined,
          };
        }),
        toArray(),
      ),
    ),
    repeat({ delay: 1000 }),
    tap({
      error: (err) => {
        console.error(formatTime(Date.now()), 'futuresAccountInfoOpenOrders$', err);
      },
    }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );

  const futureAccount$ = defer(() => client.getFuturesAccounts('usdt')).pipe(
    map((res) => (res.available ? res : { available: '0', total: '0', unrealised_pnl: '0' })),
    repeat({ delay: 1000 }),
    tap({
      error: (err) => {
        console.error(formatTime(Date.now()), 'futuresAccountInfoAccount$', err);
      },
    }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );

  const futureUsdtAccountInfo$ = combineLatest([
    accountFuturePosition$,
    accountFutureOpenOrders$,
    futureAccount$,
  ]).pipe(
    map(([positions, orders, account]): IAccountInfo => {
      const free = +account.available;
      const profit = +account.unrealised_pnl;
      const balance = +account.total;
      const equity = balance + profit;
      const used = equity - free;

      const money: IAccountMoney = {
        currency: 'USDT',
        balance,
        profit,
        free,
        used,
        equity,
      };
      return {
        updated_at: Date.now(),
        account_id: FUTURE_USDT_ACCOUNT_ID,
        money: money,
        currencies: [money],
        positions,
        orders,
      };
    }),
    throttleTime(1000),
    shareReplay(1),
  );

  terminal.provideAccountInfo(futureUsdtAccountInfo$);
  const spotAccountInfo$ = defer(async (): Promise<IAccountInfo> => {
    const res = await client.getSpotAccounts();
    if (!(res instanceof Array)) {
      throw new Error(`${res}`);
    }
    const balance = +(res.find((v) => v.currency === 'USDT')?.available ?? '0');
    const equity = balance;
    const free = equity;
    const money: IAccountMoney = {
      currency: 'USDT',
      equity,
      profit: 0,
      balance,
      free,
      used: 0,
    };
    return {
      updated_at: Date.now(),
      account_id: SPOT_USDT_ACCOUNT_ID,
      money,
      currencies: [money],
      positions: [],
      orders: [],
    };
  }).pipe(
    //
    tap({
      error: (err) => {
        console.error(formatTime(Date.now()), 'spotAccountInfo$', err);
      },
    }),
    retry({ delay: 5000 }),
    repeat({ delay: 1000 }),
    shareReplay(1),
  );
  provideAccountInfo(terminal, spotAccountInfo$);

  terminal.provideService(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: { account_id: { const: FUTURE_USDT_ACCOUNT_ID } },
    },
    (msg) =>
      defer(async () => {
        const order = msg.req;
        const res = await client.postFutureOrders('usdt', {
          contract: order.product_id,
          size:
            order.volume *
            (order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT' ? 1 : -1),
          price: order.order_type === 'MARKET' ? '0' : `${order.price}`,
          tif: order.order_type === 'MARKET' ? 'ioc' : 'gtc',
          reduce_only: order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT',
        });
        if (res.label && res.detail) {
          return { res: { code: 400, message: `${res.label}: ${res.detail}` } };
        }
        return { res: { code: 0, message: 'OK' } };
      }),
  );

  terminal.provideService(
    'CancelOrder',
    {
      required: ['account_id'],
      properties: { account_id: { const: FUTURE_USDT_ACCOUNT_ID } },
    },
    (msg) =>
      defer(async () => {
        const order = msg.req;
        await client.deleteFutureOrders('usdt', order.order_id!);
        return { res: { code: 0, message: 'OK' } };
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
            series_id: { type: 'string', pattern: '^gate/.+' },
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
        const mapProductIdToUsdtFutureProduct = await firstValueFrom(mapProductIdToUsdtFutureProduct$);
        const theProduct = mapProductIdToUsdtFutureProduct.get(product_id);
        if (!theProduct) {
          return { res: { code: 404, message: 'product not found' } };
        }
        const { base_currency, quote_currency } = theProduct;
        if (!base_currency || !quote_currency) {
          return { res: { code: 400, message: 'base_currency and quote_currency is required' } };
        }
        // best effort to get all funding rate history required
        const limit = Math.min(1000, Math.round((end - start) / 3600_000));
        const funding_rate_history = await client.getFutureFundingRate('usdt', {
          contract: product_id,
          limit,
        });

        funding_rate_history.sort((a, b) => a.t - b.t);
        // there will be at most 1000 records, so we don't need to chunk it by bufferCount
        await lastValueFrom(
          from(funding_rate_history).pipe(
            map(
              (v): IFundingRate => ({
                series_id: msg.req.tags!.series_id,
                product_id,
                datasource_id,
                base_currency,
                quote_currency,
                funding_rate: +v.r,
                funding_at: v.t * 1000,
              }),
            ),
            map(wrapFundingRateRecord),
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
  );

  const ACCOUNT_INTERNAL_NETWORK_ID = `Bitget/${uid}/ACCOUNT_INTERNAL`;
  addAccountTransferAddress({
    terminal,
    account_id: SPOT_USDT_ACCOUNT_ID,
    network_id: ACCOUNT_INTERNAL_NETWORK_ID,
    currency: 'USDT',
    address: 'SPOT',
    onApply: {
      INIT: async (order) => {
        const transferResult = await client.postWalletTransfer({
          currency: 'USDT',
          from: 'spot',
          to: 'futures',
          amount: `${order.current_amount}`,
          settle: 'usdt',
        });
        if (transferResult.tx_id !== undefined) {
          return { state: 'COMPLETE', transaction_id: transferResult.tx_id };
        }
        return { state: 'INIT', message: `${transferResult}` };
      },
    },
    onEval: async (transferOrder) => {
      return { state: 'COMPLETE', received_amount: transferOrder.current_amount };
    },
  });
  addAccountTransferAddress({
    terminal,
    account_id: FUTURE_USDT_ACCOUNT_ID,
    network_id: ACCOUNT_INTERNAL_NETWORK_ID,
    currency: 'USDT',
    address: 'USDT_FUTURE',
    onApply: {
      INIT: async (order) => {
        const transferResult = await client.postWalletTransfer({
          currency: 'USDT',
          from: 'futures',
          to: 'spot',
          amount: `${order.current_amount}`,
          settle: 'usdt',
        });
        if (transferResult.tx_id !== undefined) {
          return { state: 'COMPLETE', transaction_id: transferResult.tx_id };
        }
        return { state: 'INIT', message: `${transferResult}` };
      },
    },
    onEval: async (transferOrder) => {
      return { state: 'COMPLETE', received_amount: transferOrder.current_amount };
    },
  });

  const subAccountsResult = await client.getSubAccountList({ type: '0' });
  // TODO: test what happens if we were sub accounts
  const isMainAccount = true;
  if (isMainAccount) {
    const depositAddressRes = await client.getDepositAddress({ currency: 'USDT' });
    console.info(formatTime(Date.now()), 'DepositAddress', JSON.stringify(depositAddressRes));
    const addresses = depositAddressRes.multichain_addresses.filter((v) => v.chain === 'TRX');
    for (const address of addresses) {
      addAccountTransferAddress({
        terminal,
        account_id: SPOT_USDT_ACCOUNT_ID,
        network_id: 'TRC20',
        currency: 'USDT',
        address: address.address,
        onApply: {
          // TODO: test this one
          INIT: async (transferOrder) => {
            const transferResult = await client.postWithdrawals({
              amount: '' + transferOrder.current_amount!,
              currency: 'USDT',
              address: transferOrder.current_rx_address!,
              chain: 'TRX',
            });
            const { txid, withdraw_order_id } = transferResult;
            if (txid && txid.length > 0) {
              return { state: 'COMPLETE', transaction_id: txid };
            }
            return { state: 'PENDING', context: withdraw_order_id };
          },
          PENDING: async (transferOrder) => {
            const wdId = transferOrder.current_tx_context;
            const withdrawalRecordsResult = await client.getWithdrawalHistory();
            const withdrawalRecord = withdrawalRecordsResult.find((v) => v.withdraw_order_id === wdId);
            if (withdrawalRecord && withdrawalRecord.txid && withdrawalRecord.txid.length > 0) {
              return { state: 'COMPLETE', transaction_id: withdrawalRecord.txid };
            }
            return { state: 'PENDING', context: wdId };
          },
        },
        onEval: async (transferOrder) => {
          const checkResult = await client.getDepositHistory({
            currency: 'USDT',
          });
          const depositRecord = checkResult.find((v) => v.txid === transferOrder.current_transaction_id);
          if (depositRecord && depositRecord.status === 'DONE') {
            return { state: 'COMPLETE', received_amount: +depositRecord.amount };
          }
          return { state: 'PENDING' };
        },
      });
    }
  }
})();
