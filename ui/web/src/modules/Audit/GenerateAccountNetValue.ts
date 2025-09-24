import { ITrade } from '@yuants/data-trade';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { firstValueFrom } from 'rxjs';
import { terminal$ } from '../Network';
import { decodePath, formatTime } from '@yuants/utils';

export const generateAccountNetValue = async (
  timeline: number[],
  //   open: string[],
  //   hight: string[],
  //   low: string[],
  close: string[],
  simulateAccountId: string,
  startTime: string,
  endTime: string,
  productId: string,
) => {
  const terminal = await firstValueFrom(terminal$);
  const series = new Map<string, any[]>();
  const orderSeries = new Map<string, any[]>();

  let cashBalance = 0;
  const position = { volume: 0, avgPrice: 0 };
  const netValueList: number[] = [];
  const directionList: string[] = [];
  const orderVolumeList: string[] = [];
  const orderTimeline: number[] = [];
  const orderPriceList: string[] = [];
  let timelineIndex = 0;

  const mapSecondToTrades = new Map<Number, ITrade[]>();

  if (terminal) {
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
        const { direction, fee, traded_price, traded_value, traded_volume, created_at, id } = trade;
        const second = ~~(new Date(created_at ?? 0).getTime() / 1000);
        mapSecondToTrades.get(second)
          ? mapSecondToTrades.get(second)?.push(trade)
          : mapSecondToTrades.set(second, [trade]);
        if (created_at) {
          const createdAtInSecond = ~~(new Date(created_at).getTime() / 1000);
          for (; timelineIndex < timeline.length; timelineIndex++) {
            const timeInSecond = ~~(timeline[timelineIndex] / 1000);
            if (timeInSecond <= createdAtInSecond) {
              let positionValue = 0;
              if (position.volume !== 0) {
                positionValue += position.volume * Number(close[timelineIndex]);
              }
              const netValue = positionValue + cashBalance;
              netValueList.push(netValue);
            } else {
              break;
            }
          }
        }
        if (direction === 'OPEN_LONG' || direction === 'CLOSE_SHORT') {
          cashBalance -= parseFloat(traded_value) + +fee;
          position.volume += parseFloat(traded_volume);
          const preVolume = position.volume;
          if (position.volume === 0) position.avgPrice = 0;
          if (position.volume > 0) {
            if (preVolume <= 0) {
              position.avgPrice = parseFloat(traded_price);
            } else {
              position.avgPrice =
                (Math.abs(preVolume * position.avgPrice) + parseFloat(traded_value)) /
                Math.abs(position.volume);
            }
          }
        }
        if (direction === 'CLOSE_LONG' || direction === 'OPEN_SHORT') {
          cashBalance += parseFloat(traded_value) - +fee;
          const preVolume = position.volume;
          position.volume -= parseFloat(traded_volume);
          if (position.volume === 0) position.avgPrice = 0;
          if (position.volume < 0) {
            if (preVolume >= 0) {
              position.avgPrice = parseFloat(traded_price);
            } else {
              position.avgPrice =
                (Math.abs(preVolume * position.avgPrice) + parseFloat(traded_value)) /
                Math.abs(position.volume);
            }
          }
        }
      }
    }
  }
  for (; timelineIndex < timeline.length; timelineIndex++) {
    netValueList.push(netValueList[netValueList.length - 1] ?? 0);
  }
  series.set('_time', timeline);
  series.set('net_value', netValueList);

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
          traded_price: totalVolume !== 0 ? Math.abs(totalValue / totalVolume) : 0,
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

  return [series, orderSeries];
};
