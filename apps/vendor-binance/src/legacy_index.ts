import { addAccountMarket, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { addAccountTransferAddress } from '@yuants/transfer';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { defer, from, map, mergeMap, repeat, retry, shareReplay, toArray } from 'rxjs';
import { createHash } from 'crypto';
import { client, isError } from './api';

const terminal = Terminal.fromNodeEnv();

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
    case 'OPEN_SHORT':
    case 'CLOSE_SHORT':
      return 'SHORT';
  }
  throw new Error(`Unknown direction: ${direction}`);
};

const mapOrderTypeToOrdType = (order_type?: string) => {
  switch (order_type) {
    case 'LIMIT':
    case 'MAKER':
      return 'LIMIT';
    case 'MARKET':
      return 'MARKET';
  }
  throw new Error(`Unknown order type: ${order_type}`);
};

const mapBinanceOrderTypeToYuants = (binanceType?: string): IOrder['order_type'] => {
  switch (binanceType) {
    case 'LIMIT':
      return 'LIMIT';
    case 'MARKET':
      return 'MARKET';
    default:
      return 'LIMIT';
  }
};

const mapBinanceSideToYuantsDirection = (
  side?: string,
  positionSide?: string,
): IOrder['order_direction'] | undefined => {
  if (!side || !positionSide) {
    return undefined;
  }
  if (positionSide === 'LONG') {
    return side === 'BUY' ? 'OPEN_LONG' : 'CLOSE_LONG';
  }
  if (positionSide === 'SHORT') {
    return side === 'SELL' ? 'OPEN_SHORT' : 'CLOSE_SHORT';
  }
  return undefined;
};

const deriveClientOrderId = (order: IOrder) => {
  if (order.order_id) return `${order.order_id}`;
  if (order.comment) return order.comment;
  const payload = JSON.stringify({
    account_id: order.account_id,
    product_id: order.product_id,
    order_direction: order.order_direction,
    order_type: order.order_type,
    price: order.price,
    volume: order.volume,
  });
  return `YUANTS${createHash('sha256').update(payload).digest('hex').slice(0, 24)}`;
};

// provideTicks(terminal, 'binance', (product_id) => {
//   const [instType, symbol] = decodePath(product_id);
//   if (instType === 'usdt-future') {
//     return combineLatest([mapSymbolToFuturePremiumIndex$, mapSymbolToFutureBookTicker$]).pipe(
//       combineLatestWith(defer(() => getOpenInterest(symbol))),
//       map(([[mapSymbolToFuturePremiumIndex, mapSymbolToFutureBookTicker], openInterestVolume]): ITick => {
//         const premiumIndex = mapSymbolToFuturePremiumIndex.get(symbol);
//         const bookTicker = mapSymbolToFutureBookTicker.get(symbol);
//         if (!premiumIndex) {
//           throw new Error(`Premium Index Not Found: ${symbol}`);
//         }
//         if (!bookTicker) {
//           throw new Error(`Book Ticker Not Found: ${symbol}`);
//         }
//         return {
//           datasource_id: 'binance',
//           product_id,
//           updated_at: Date.now(),
//           price: +premiumIndex.markPrice,
//           ask: +bookTicker.askPrice,
//           bid: +bookTicker.bidPrice,
//           interest_rate_for_long: -+premiumIndex.lastFundingRate,
//           interest_rate_for_short: +premiumIndex.lastFundingRate,
//           settlement_scheduled_at: premiumIndex.nextFundingTime,
//           open_interest: openInterestVolume,
//         };
//       }),
//     );
//   }
//   return EMPTY;
// });

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

    provideAccountInfoService(
      terminal,
      UNIFIED_ACCOUNT_ID,
      async () => {
        const [accountResult, umAccountResult] = await Promise.all([
          client.getUnifiedAccountBalance(),
          client.getUnifiedUmAccount(),
        ]);
        if (isError(accountResult)) {
          throw new Error(accountResult.msg);
        }
        const usdtAssets = accountResult.find((v) => v.asset === 'USDT');
        if (!usdtAssets) {
          throw new Error('USDT not found');
        }
        if (isError(umAccountResult)) {
          throw new Error(umAccountResult.msg);
        }
        const usdtUmAssets = umAccountResult.assets.find((v) => v.asset === 'USDT');
        if (!usdtUmAssets) {
          throw new Error('um USDT not found');
        }
        const equity = +usdtAssets.totalWalletBalance + +usdtAssets.umUnrealizedPNL;
        const free = equity - +usdtUmAssets.initialMargin;

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
          money: {
            currency: 'USDT',
            equity,
            free,
          },
          positions,
        };
      },
      { auto_refresh_interval: 1000 },
    );

    addAccountMarket(terminal, { account_id: UNIFIED_ACCOUNT_ID, market_id: 'BINANCE/UNIFIED' });
  }

  {
    // spot account info

    provideAccountInfoService(terminal, SPOT_ACCOUNT_ID, async () => {
      const spotAccountResult = await client.getSpotAccountInfo({ omitZeroBalances: true });
      if (isError(spotAccountResult)) {
        throw new Error(spotAccountResult.msg);
      }
      const usdtAssets = spotAccountResult.balances.find((v) => v.asset === 'USDT');
      return {
        money: {
          currency: 'USDT',
          equity: +(usdtAssets?.free || 0),
          free: +(usdtAssets?.free || 0),
        },
        positions: [],
      };
    });

    addAccountMarket(terminal, { account_id: SPOT_ACCOUNT_ID, market_id: 'BINANCE/SPOT' });
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
    providePendingOrdersService(
      terminal,
      UNIFIED_ACCOUNT_ID,
      async () => {
        const openOrders = await client.getUnifiedUmOpenOrders();
        return openOrders.map((order): IOrder => {
          const order_direction =
            mapBinanceSideToYuantsDirection(order.side, order.positionSide) ?? 'OPEN_LONG';
          return {
            order_id: `${order.orderId}`,
            account_id: UNIFIED_ACCOUNT_ID,
            product_id: encodePath('usdt-future', order.symbol),
            order_type: mapBinanceOrderTypeToYuants(order.type),
            order_direction,
            volume: +order.origQty,
            traded_volume: +order.executedQty,
            price: order.price === undefined ? undefined : +order.price,
            submit_at: order.time,
            updated_at: new Date(order.updateTime).toISOString(),
            order_status: order.status,
          };
        });
      },
      { auto_refresh_interval: 1000 },
    );

    terminal.server.provideService<IOrder>(
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
          const params = {
            symbol,
            side: mapOrderDirectionToSide(order.order_direction),
            positionSide: mapOrderDirectionToPosSide(order.order_direction),
            type: mapOrderTypeToOrdType(order.order_type),
            timeInForce:
              order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined,
            quantity: order.volume,
            price: order.price,
            newClientOrderId: deriveClientOrderId(order),
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

  {
    terminal.server.provideService<IOrder>(
      'CancelOrder',
      {
        required: ['account_id', 'order_id', 'product_id'],
        properties: {
          account_id: { const: UNIFIED_ACCOUNT_ID },
        },
      },
      async (msg) => {
        const order = msg.req;
        if (!order.order_id) {
          return { res: { code: 400, message: 'order_id is required' } };
        }
        const [instType, symbol] = decodePath(order.product_id);
        if (instType !== 'usdt-future') {
          return { res: { code: 400, message: `unsupported type: ${instType}` } };
        }
        const cancelResult = await client.deleteUmOrder({
          symbol,
          orderId: order.order_id,
        });
        if (isError(cancelResult)) {
          return { res: { code: cancelResult.code, message: cancelResult.msg } };
        }
        return { res: { code: 0, message: 'OK' } };
      },
    );
  }
})();
