import { ITrade } from '@yuants/data-trade';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { firstValueFrom } from 'rxjs';
import { terminal$ } from '../Network';
import { decodePath, formatTime } from '@yuants/utils';
import { IProduct } from '@yuants/data-product';

export const generateAccountOrders = async (
  simulateAccountId: string,
  startTime: string,
  endTime: string,
  productId: string,
) => {
  const terminal = await firstValueFrom(terminal$);
  const orderSeries = new Map<string, any[]>();

  const directionList: string[] = [];
  const orderVolumeList: string[] = [];
  const orderTimeline: number[] = [];
  const orderPriceList: string[] = [];
  let productInfo: IProduct | null = null;
  const mapSecondToTrades = new Map<Number, ITrade[]>();

  if (terminal) {
    const productInfoList = await requestSQL<IProduct[]>(
      terminal,
      `select * from product where product_id=${escapeSQL(productId)}`,
    );
    if (productInfoList.length === 1) {
      productInfo = productInfoList[0];
    }
    const tradeList = await requestSQL<ITrade[]>(
      terminal,
      `
        select * from trade where account_id=${escapeSQL(simulateAccountId)} and product_id=${escapeSQL(
        productId,
      )} and created_at>=${escapeSQL(formatTime(startTime))} and created_at<=${escapeSQL(
        formatTime(endTime),
      )} order by created_at;
            `,
    );

    if (tradeList?.length > 0) {
      for (const trade of tradeList) {
        const { created_at } = trade;
        const second = ~~(new Date(created_at ?? 0).getTime() / 1000);
        mapSecondToTrades.get(second)
          ? mapSecondToTrades.get(second)?.push(trade)
          : mapSecondToTrades.set(second, [trade]);
      }
    }
  }

  Array.from(mapSecondToTrades.values())
    .map((trades) => {
      if (trades.length === 1) {
        return trades[0];
      } else {
        let totalValue = 0;
        let totalVolume = 0;
        trades.forEach((trade) => {
          if (trade.direction === 'OPEN_LONG' || trade.direction === 'CLOSE_SHORT') {
            totalVolume += parseFloat(trade.traded_volume);
            totalValue += parseFloat(trade.traded_value);
          } else {
            totalVolume -= parseFloat(trade.traded_volume);
            totalValue -= parseFloat(trade.traded_value);
          }
        });
        return {
          created_at: trades[trades.length - 1].created_at ?? 0,
          direction: totalVolume > 0 ? 'OPEN_LONG' : 'OPEN_SHORT',
          traded_volume: Math.abs(totalVolume),
          traded_price:
            totalVolume !== 0 ? Math.abs(totalValue / (totalVolume * +(productInfo?.value_scale ?? 1))) : 0,
        };
      }
    })
    .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
    .forEach((item) => {
      orderTimeline.push(new Date(item.created_at ?? 0).getTime());
      directionList.push(item.direction);
      orderPriceList.push(item.traded_price.toString());
      orderVolumeList.push(item.traded_volume.toString());
    });

  orderSeries.set('direction', directionList);
  orderSeries.set('traded_at', orderTimeline);
  orderSeries.set('traded_price', orderPriceList);
  orderSeries.set('traded_volume', orderVolumeList);

  return [orderSeries];
};
