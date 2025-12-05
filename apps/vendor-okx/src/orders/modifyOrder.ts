import { IOrder } from '@yuants/data-order';
import { formatTime, decodePath, roundToStep } from '@yuants/utils';
import { firstValueFrom, map } from 'rxjs';
import { ICredential, postTradeAmendOrder } from '../api/private-api';
import { productService } from '../public-data/product';
import { spotMarketTickers$ } from '../public-data/quote';

export const modifyOrder = async (credential: ICredential, order: IOrder) => {
  const [instType, instId] = decodePath(order.product_id).slice(-2);
  const params: {
    instId: string;
    ordId: string;
    newPx?: string;
    newSz?: string;
  } = {
    instId,
    ordId: order.order_id!, // 使用现有订单ID
  };

  // 如果需要修改价格
  if (order.price !== undefined) {
    params.newPx = order.price.toString();
  }

  // 如果需要修改数量
  if (order.volume !== undefined) {
    // 处理数量修改，类似于 SubmitOrder 中的逻辑
    if (instType === 'SWAP') {
      params.newSz = order.volume.toString();
    } else if (instType === 'SPOT') {
      params.newSz = order.volume.toString();
    } else if (instType === 'MARGIN') {
      if (order.order_type === 'LIMIT') {
        params.newSz = order.volume.toString();
      }
      if (order.order_type === 'MAKER') {
        params.newSz = order.volume.toString();
      }
      if (order.order_type === 'MARKET') {
        // 对于市价单，可能需要根据当前价格计算新的数量
        const price = await firstValueFrom(
          spotMarketTickers$.pipe(
            map((x) =>
              order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT'
                ? +x[instId].askPx
                : +x[instId].bidPx,
            ),
          ),
        );
        if (!price) {
          throw new Error(`invalid tick: ${price}`);
        }
        console.info(formatTime(Date.now()), 'ModifyOrder', 'price', price);
        const theProduct = await firstValueFrom(
          productService.mapProductIdToProduct$.pipe(map((x) => x.get(order.product_id))),
        );
        if (!theProduct) {
          throw new Error(`Unknown product: ${order.position_id}`);
        }
        params.newSz = roundToStep(order.volume * price, theProduct.volume_step!).toString();
      }
    } else {
      throw new Error(`Unknown instType: ${instType}`);
    }
  }

  console.info(formatTime(Date.now()), 'ModifyOrder', 'params', JSON.stringify(params));

  const res = await postTradeAmendOrder(credential, params);
  if (res.code !== '0') {
    throw new Error(`ModifyOrder failed: code=${res.code}, msg=${res.msg}`);
  }
};
