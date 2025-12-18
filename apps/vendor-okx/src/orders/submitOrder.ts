import { IOrder } from '@yuants/data-order';
import { decodePath, formatTime, newError, roundToStep } from '@yuants/utils';
import { firstValueFrom, map } from 'rxjs';
import { accountConfigCache } from '../accountInfos/uid';
import { ICredential, postTradeOrder } from '../api/private-api';
import { productService } from '../public-data/product';
import { spotMarketTickers$ } from '../public-data/quote';

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

const mapOrderTypeToOrdType = (order_type?: string) => {
  switch (order_type) {
    case 'LIMIT':
      return 'limit';
    case 'MARKET':
      return 'market';
    case 'MAKER':
      return 'post_only';
  }
  throw new Error(`Unknown order type: ${order_type}`);
};

export const submitOrder = async (credential: ICredential, order: IOrder): Promise<{ order_id: string }> => {
  const accountConfigRes = await accountConfigCache.query(JSON.stringify(credential));
  if (!accountConfigRes) throw newError('ACCOUNT_CONFIG_FETCH_ERROR', { accountConfigRes });
  if (!accountConfigRes.data?.[0]) throw newError('ACCOUNT_CONFIG_FETCH_ERROR', { accountConfigRes });

  /**
   * 是否为组合保证金模式
   */
  const isPortfolioMarginMode = accountConfigRes.data[0].acctLv === '4';
  /**
   * 是否为单向持仓模式(买卖模式)
   */
  const isSingleSideMode = accountConfigRes.data[0].posMode === 'net_mode';

  const [instType, instId] = decodePath(order.product_id).slice(-2);

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
      if (order.order_type === 'MAKER') {
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
          productService.mapProductIdToProduct$.pipe(map((x) => x.get(order.product_id))),
        );
        if (!theProduct) {
          throw new Error(`Unknown product: ${order.position_id}`);
        }
        return roundToStep(order.volume * price, theProduct.volume_step!);
      }

      return 0;
    }

    if (instType === 'SPOT') {
      return order.volume;
    }

    throw new Error(`Unknown instType: ${instType}`);
  };

  const mapOrderDirectionToPosSide = (direction?: string) => {
    if (isPortfolioMarginMode) return undefined;
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

  const params = {
    instId,
    tdMode: instType === 'SPOT' ? 'cash' : 'cross',
    side: mapOrderDirectionToSide(order.order_direction),
    posSide:
      isSingleSideMode || instType === 'MARGIN' || instType === 'SPOT'
        ? undefined
        : mapOrderDirectionToPosSide(order.order_direction),
    ordType: mapOrderTypeToOrdType(order.order_type),
    sz: (await mapOrderVolumeToSz(order)).toString(),
    tgtCcy: instType === 'SPOT' && order.order_type === 'MARKET' ? 'base_ccy' : undefined,
    reduceOnly:
      instType === 'MARGIN' && ['CLOSE_LONG', 'CLOSE_SHORT'].includes(order.order_direction ?? '')
        ? 'true'
        : undefined,
    px: order.order_type === 'LIMIT' || order.order_type === 'MAKER' ? order.price!.toString() : undefined,
    ccy: instType === 'MARGIN' ? 'USDT' : undefined,
    tag: process.env.BROKER_CODE,
  };
  console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));
  const res = await postTradeOrder(credential, params);
  if (res.code === '0' && res.data?.[0]?.ordId) {
    return { order_id: res.data[0].ordId };
  }
  throw `Failed to submit order: ${res.code} ${res.msg}: ${res.data
    .map((x) => `${x.sCode} ${x.sMsg}`)
    .join('; ')}`;
};
