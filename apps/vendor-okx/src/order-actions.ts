import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime, roundToStep } from '@yuants/utils';
import { defer, firstValueFrom, map } from 'rxjs';
import { akToAccountIdCache } from './account';
import { client$ } from './api';
import { productService } from './product';
import { spotMarketTickers$ } from './quote';

const terminal = Terminal.fromNodeEnv();

client$.subscribe(async (client) => {
  const access_key = client.auth.access_key;
  const tradingAccountId = await akToAccountIdCache.query(access_key).then((x) => x!.trading);
  terminal.server.provideService<IOrder, { order_id?: string }>(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    async (msg) => {
      console.info(formatTime(Date.now()), 'SubmitOrder', JSON.stringify(msg));
      const order = msg.req;
      const [instType, instId] = decodePath(order.product_id);

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
      const mapOrderDirectionToPosSide = (direction?: string) => {
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

      const params = {
        instId,
        tdMode: instType === 'SPOT' ? 'cash' : 'cross',
        side: mapOrderDirectionToSide(order.order_direction),
        posSide:
          instType === 'MARGIN' || instType === 'SPOT'
            ? 'net'
            : mapOrderDirectionToPosSide(order.order_direction),
        ordType: mapOrderTypeToOrdType(order.order_type),
        sz: (await mapOrderVolumeToSz(order)).toString(),
        tgtCcy: instType === 'SPOT' && order.order_type === 'MARKET' ? 'base_ccy' : undefined,
        reduceOnly:
          instType === 'MARGIN' && ['CLOSE_LONG', 'CLOSE_SHORT'].includes(order.order_direction ?? '')
            ? 'true'
            : undefined,
        px:
          order.order_type === 'LIMIT' || order.order_type === 'MAKER' ? order.price!.toString() : undefined,
        ccy: instType === 'MARGIN' ? 'USDT' : undefined,
      };
      console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));
      const res = await client.postTradeOrder(params);
      if (res.code === '0' && res.data?.[0]?.ordId) {
        return {
          res: {
            code: 0,
            message: 'OK',
            data: {
              order_id: res.data[0].ordId,
            },
          },
        };
      }
      return { res: { code: +res.code, message: res.msg } };
    },
  );

  terminal.server.provideService<IOrder>(
    'ModifyOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    async (msg) => {
      console.info(formatTime(Date.now()), 'ModifyOrder', JSON.stringify(msg));
      const order = msg.req;
      const [instType, instId] = decodePath(order.product_id);

      const params: any = {
        instId,
        ordId: order.order_id, // 使用现有订单ID
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

      const res = await client.postTradeAmendOrder(params);
      if (res.code !== '0') {
        return {
          res: {
            code: +res.code,
            message: res.msg,
          },
        };
      }

      return { res: { code: 0, message: 'OK' } };
    },
  );

  terminal.server.provideService<IOrder>(
    'CancelOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    (msg) =>
      defer(async () => {
        const order = msg.req;
        const [instType, instId] = decodePath(order.product_id);
        const res = await client.postTradeCancelOrder({
          instId,
          ordId: order.order_id,
        });
        if (res.code !== '0') {
          return { res: { code: +res.code, message: res.msg } };
        }
        return { res: { code: 0, message: 'OK' } };
      }),
  );
});
