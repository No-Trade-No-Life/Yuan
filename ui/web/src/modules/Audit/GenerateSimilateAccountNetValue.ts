import { ITrade } from '@yuants/data-trade';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { firstValueFrom } from 'rxjs';
import { terminal$ } from '../Network';
import { formatTime } from '@yuants/utils';

export const generateSimulateAccountNetValue = async (
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
  let cashBalance = 0;
  const position = { long: { volume: 0, avgPrice: 0 }, short: { volume: 0, avgPrice: 0 } };
  const xxx: { time: number; value: number }[] = [];
  const netValueList: number[] = [];
  let timelineIndex = 0;

  if (terminal) {
    const tradeList = await requestSQL<ITrade[]>(
      terminal,
      `
        select * from trade where account_id=${escapeSQL(simulateAccountId)} and created_at>=${escapeSQL(
        formatTime(startTime),
      )} and created_at<=${escapeSQL(formatTime(endTime))} order by created_at;
            `,
    );

    if (tradeList?.length > 0) {
      for (const trade of tradeList) {
        const { direction, fee, traded_price, traded_value, traded_volume, created_at, id } = trade;
        if (created_at) {
          const createdAtInSecond = ~~(new Date(created_at).getTime() / 1000);
          for (; timelineIndex < timeline.length; timelineIndex++) {
            const timeInSecond = ~~(timeline[timelineIndex] / 1000);
            if (timeInSecond <= createdAtInSecond) {
              let positionValue = 0;
              if (position.long.volume > 0) {
                positionValue += position.long.volume * Number(close[timelineIndex]);
              }
              if (position.short.volume > 0) {
                positionValue -= position.short.volume * Number(close[timelineIndex]);
              }
              const netValue = positionValue + cashBalance;
              xxx.push({ time: timeline[timelineIndex], value: netValue });
              netValueList.push(netValue);
            } else {
              break;
            }
          }
        }
        if (direction === 'OPEN_LONG') {
          cashBalance -= +traded_value + +fee;
          position.long.avgPrice =
            (position.long.volume * position.long.avgPrice + +traded_volume * +traded_price) /
            (position.long.volume + +traded_volume);
          position.long.volume += +traded_volume;
        }
        if (direction === 'CLOSE_LONG') {
          cashBalance += +traded_value - +fee;
          position.long.volume -= +traded_volume;
          if (position.long.volume === 0) position.long.avgPrice = 0;
        }
        if (direction === 'OPEN_SHORT') {
          cashBalance += +traded_value - +fee;
          position.short.avgPrice =
            (position.short.volume * position.short.avgPrice + +traded_volume * +traded_price) /
            (position.short.volume + +traded_volume);
        }
        if (direction === 'CLOSE_SHORT') {
          cashBalance -= +traded_value + +fee;
          position.short.volume -= +traded_volume;
          if (position.short.volume === 0) position.short.avgPrice = 0;
        }
        let positionValue = 0;
        if (position.long.volume > 0) {
          positionValue += position.long.volume * position.long.avgPrice;
        }
        if (position.short.volume > 0) {
          positionValue -= position.short.volume * position.short.avgPrice;
        }
        const netValue = positionValue + cashBalance;
        console.log({ trade, position, cashBalance, netValue });
      }
    }
  }
  for (; timelineIndex < timeline.length; timelineIndex++) {
    xxx.push({ time: timeline[timelineIndex], value: xxx[xxx.length - 1]?.value ?? 0 });
    netValueList.push(netValueList[netValueList.length - 1] ?? 0);
  }
  series.set('_time', timeline);
  series.set('net_value', netValueList);
  return series;
};
