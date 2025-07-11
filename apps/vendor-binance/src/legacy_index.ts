import { IAccountInfo, IAccountMoney, IPosition, publishAccountInfo } from '@yuants/data-account';
import { ITick } from '@yuants/data-model';
import { provideTicks } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import { addAccountTransferAddress } from '@yuants/transfer';
import '@yuants/transfer/lib/services';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import {
  EMPTY,
  combineLatest,
  combineLatestWith,
  defer,
  from,
  map,
  mergeMap,
  repeat,
  retry,
  shareReplay,
  tap,
  toArray,
} from 'rxjs';
import { client, isError } from './api';
import { terminal } from './terminal';

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

const mapSymbolToFuturePremiumIndex$ = defer(() => client.getFuturePremiumIndex({})).pipe(
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  mergeMap((x) =>
    from(x).pipe(
      map((v) => [v.symbol, v] as const),
      toArray(),
      map((v) => new Map(v)),
    ),
  ),
  shareReplay(1),
);

const mapSymbolToFutureBookTicker$ = defer(() => client.getFutureBookTicker({})).pipe(
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  mergeMap((x) =>
    from(x).pipe(
      map((v) => [v.symbol, v] as const),
      toArray(),
      map((v) => new Map(v)),
    ),
  ),
  shareReplay(1),
);

const _mapSymbolToOpenInterest: Record<string, { value: number; updated_at: number }> = {};
const getOpenInterest = async (symbol: string) => {
  const expired_at = Date.now() - 600_000; // 10min expired
  const cache = _mapSymbolToOpenInterest[symbol];
  if (cache) {
    if (cache.updated_at > expired_at) {
      return cache.value;
    }
  }
  const data = await client.getFutureOpenInterest({ symbol });
  const value = +data.openInterest || 0;
  _mapSymbolToOpenInterest[symbol] = { value, updated_at: Date.now() };
  return value;
};

provideTicks(terminal, 'binance', (product_id) => {
  const [instType, symbol] = decodePath(product_id);
  if (instType === 'usdt-future') {
    return combineLatest([mapSymbolToFuturePremiumIndex$, mapSymbolToFutureBookTicker$]).pipe(
      combineLatestWith(defer(() => getOpenInterest(symbol))),
      map(([[mapSymbolToFuturePremiumIndex, mapSymbolToFutureBookTicker], openInterestVolume]): ITick => {
        const premiumIndex = mapSymbolToFuturePremiumIndex.get(symbol);
        const bookTicker = mapSymbolToFutureBookTicker.get(symbol);
        if (!premiumIndex) {
          throw new Error(`Premium Index Not Found: ${symbol}`);
        }
        if (!bookTicker) {
          throw new Error(`Book Ticker Not Found: ${symbol}`);
        }
        return {
          datasource_id: 'binance',
          product_id,
          updated_at: Date.now(),
          price: +premiumIndex.markPrice,
          ask: +bookTicker.askPrice,
          bid: +bookTicker.bidPrice,
          interest_rate_for_long: -+premiumIndex.lastFundingRate,
          interest_rate_for_short: +premiumIndex.lastFundingRate,
          settlement_scheduled_at: premiumIndex.nextFundingTime,
          open_interest: openInterestVolume,
        };
      }),
    );
  }
  return EMPTY;
});

(async () => {
  const spotAccountInfo = await client.getSpotAccountInfo();
  if (isError(spotAccountInfo)) {
    throw new Error(spotAccountInfo.msg);
  }
  const uid = spotAccountInfo.uid;

  const SPOT_ACCOUNT_ID = `binance/${uid}/spot/usdt`;
  const UNIFIED_ACCOUNT_ID = `binance/${uid}/unified/usdt`;

  {
    // unified accountInfo
    const unifiedAccountInfo$ = defer(async (): Promise<IAccountInfo> => {
      const accountResult = await client.getUnifiedAccountBalance();
      if (isError(accountResult)) {
        throw new Error(accountResult.msg);
      }
      const usdtAssets = accountResult.find((v) => v.asset === 'USDT');
      if (!usdtAssets) {
        throw new Error('USDT not found');
      }
      const umAccountResult = await client.getUnifiedUmAccount();
      if (isError(umAccountResult)) {
        throw new Error(umAccountResult.msg);
      }
      const usdtUmAssets = umAccountResult.assets.find((v) => v.asset === 'USDT');
      if (!usdtUmAssets) {
        throw new Error('um USDT not found');
      }
      const money: IAccountMoney = {
        currency: 'USDT',
        leverage: 1,
        equity: +usdtAssets.totalWalletBalance + +usdtAssets.umUnrealizedPNL,
        balance: +usdtAssets.totalWalletBalance,
        profit: +usdtAssets.umUnrealizedPNL,
        used: +usdtUmAssets.initialMargin,
        free: +usdtAssets.totalWalletBalance + +usdtAssets.umUnrealizedPNL - +usdtUmAssets.initialMargin,
      };

      const positions = umAccountResult.positions
        .filter((v) => +v.positionAmt !== 0)
        .map((v): IPosition => {
          return {
            position_id: `${v.symbol}/${v.positionSide}`,
            datasource_id: 'BINANCE',
            product_id: encodePath('usdt-future', v.symbol),
            direction: v.positionSide,
            volume: +v.positionAmt,
            free_volume: +v.positionAmt,
            position_price: +v.entryPrice,
            closable_price: +v.entryPrice + +v.unrealizedProfit / +v.positionAmt,
            floating_profit: +v.unrealizedProfit,
            valuation: +v.positionAmt * (+v.entryPrice + +v.unrealizedProfit / +v.positionAmt),
          };
        });

      return {
        updated_at: Date.now(),
        account_id: UNIFIED_ACCOUNT_ID,
        money,
        currencies: [money],
        positions,
        orders: [],
      };
    }).pipe(
      tap({
        error: (err) => {
          console.error(formatTime(Date.now()), 'unifiedAccountInfo$', err);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 1000 }),
    );
    publishAccountInfo(terminal, UNIFIED_ACCOUNT_ID, unifiedAccountInfo$);
  }

  {
    // spot account info
    const spotAccountInfo$ = defer(async (): Promise<IAccountInfo> => {
      const spotAccountResult = await client.getSpotAccountInfo({ omitZeroBalances: true });
      if (isError(spotAccountResult)) {
        throw new Error(spotAccountResult.msg);
      }
      const usdtAssets = spotAccountResult.balances.find((v) => v.asset === 'USDT');
      const money: IAccountMoney = {
        currency: 'USDT',
        leverage: 1,
        equity: +(usdtAssets?.free || 0),
        balance: +(usdtAssets?.free || 0),
        profit: 0,
        used: 0,
        free: +(usdtAssets?.free || 0),
      };

      return {
        updated_at: Date.now(),
        account_id: SPOT_ACCOUNT_ID,
        money,
        currencies: [money],
        positions: [],
        orders: [],
      };
    }).pipe(
      tap({
        error: (err) => {
          console.error(formatTime(Date.now()), 'unifiedAccountInfo$', err);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 1000 }),
    );

    publishAccountInfo(terminal, SPOT_ACCOUNT_ID, spotAccountInfo$);
  }

  // transfer
  {
    // spot -> unified
    const SPOT_UNIFIED_NETWORK_ID = `binance/${uid}/spot/unified`;
    addAccountTransferAddress({
      terminal,
      account_id: SPOT_ACCOUNT_ID,
      network_id: SPOT_UNIFIED_NETWORK_ID,
      currency: 'USDT',
      address: `unified`,
      onApply: {
        INIT: async (order) => {
          const transferResult = await client.postAssetTransfer({
            type: 'MAIN_PORTFOLIO_MARGIN',
            asset: 'USDT',
            amount: order.current_amount!,
          });
          if (isError(transferResult)) {
            return { state: 'INIT', message: transferResult.msg };
          }
          return { state: 'COMPLETE', transaction_id: '' + transferResult.tranId };
        },
      },
      onEval: async (order) => {
        return { state: 'COMPLETE', received_amount: order.current_amount };
      },
    });

    // unified -> spot
    addAccountTransferAddress({
      terminal,
      account_id: UNIFIED_ACCOUNT_ID,
      network_id: SPOT_UNIFIED_NETWORK_ID,
      currency: 'USDT',
      address: `spot`,
      onApply: {
        INIT: async (order) => {
          const transferResult = await client.postAssetTransfer({
            type: 'PORTFOLIO_MARGIN_MAIN',
            asset: 'USDT',
            amount: order.current_amount!,
          });
          if (isError(transferResult)) {
            return { state: 'INIT', message: transferResult.msg };
          }
          return { state: 'COMPLETE', transaction_id: '' + transferResult.tranId };
        },
      },
      onEval: async (order) => {
        return { state: 'COMPLETE', received_amount: order.current_amount };
      },
    });

    const subAccountsResult = await client.getSubAccountList();
    const isMain = !isError(subAccountsResult);
    // main -> sub
    // TODO...

    // blockchain
    if (isMain) {
      const depositAddressResult = await client.getDepositAddress({ coin: 'USDT', network: 'TRX' });
      addAccountTransferAddress({
        terminal,
        account_id: SPOT_ACCOUNT_ID,
        network_id: 'TRC20',
        currency: 'USDT',
        address: depositAddressResult.address,
        onApply: {
          INIT: async (order) => {
            const transferResult = await client.postWithdraw({
              coin: 'USDT',
              network: 'TRX',
              address: order.current_rx_address!,
              amount: order.current_amount!,
            });
            if (isError(transferResult)) {
              return { state: 'ERROR', message: transferResult.msg };
            }
            const wdId = transferResult.id;
            return { state: 'PENDING', context: wdId };
          },
          PENDING: async (order) => {
            const wdId = order.current_tx_context;
            const withdrawResult = await client.getWithdrawHistory({ coin: 'USDT' });
            const record = withdrawResult?.find((v) => v.id === wdId);
            const txId = record?.txId;
            if (!txId) {
              return { state: 'PENDING', context: wdId };
            }
            return { state: 'COMPLETE', transaction_id: txId };
          },
        },
        onEval: async (order) => {
          const checkResult = await client.getDepositHistory({
            coin: 'USDT',
            txId: order.current_transaction_id,
          });
          if (checkResult?.[0]?.status !== 1) {
            return { state: 'PENDING' };
          }
          const received_amount = +checkResult[0].amount;
          return { state: 'COMPLETE', received_amount };
        },
      });
    }
  }

  // order related
  {
    terminal.provideService(
      'SubmitOrder',
      {
        required: ['account_id'],
        properties: {
          account_id: { const: UNIFIED_ACCOUNT_ID },
        },
      },
      async (msg) => {
        console.info(formatTime(Date.now()), 'SubmitOrder', msg.req);
        const order = msg.req;
        const [instType, symbol] = decodePath(order.product_id);
        if (instType === 'usdt-future') {
          const mapOrderDirectionToSide = (direction?: string) => {
            switch (direction) {
              case 'OPEN_LONG':
              case 'CLOSE_SHORT':
                return 'BUY';
              case 'OPEN_SHORT':
              case 'CLOSE_LONG':
                return 'SELL';
            }
            throw new Error(`Unknown direction: ${direction}`);
          };
          const mapOrderDirectionToPosSide = (direction?: string) => {
            switch (direction) {
              case 'OPEN_LONG':
              case 'CLOSE_LONG':
                return 'LONG';
              case 'CLOSE_SHORT':
              case 'OPEN_SHORT':
                return 'SHORT';
            }
            throw new Error(`Unknown direction: ${direction}`);
          };
          const mapOrderTypeToOrdType = (order_type?: string) => {
            switch (order_type) {
              case 'LIMIT':
                return 'LIMIT';
              case 'MARKET':
                return 'MARKET';
            }
            throw new Error(`Unknown order type: ${order_type}`);
          };
          // return
          const params = {
            symbol,
            side: mapOrderDirectionToSide(order.order_direction),
            positionSide: mapOrderDirectionToPosSide(order.order_direction),
            type: mapOrderTypeToOrdType(order.order_type),
            timeInForce: order.order_type === 'LIMIT' ? 'GTC' : undefined,
            quantity: order.volume,
            price: order.price,
          };

          console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));
          const orderResult = await client.postUmOrder(params);
          if (isError(orderResult)) {
            return { res: { code: orderResult.code, message: orderResult.msg } };
          }
          return { res: { code: 0, message: 'OK', order_id: orderResult.orderId } };
        }
        return { res: { code: 400, message: `unsupported type: ${instType}` } };
      },
    );
  }
})();
