import { IProduct } from '@yuants/data-product';
import { ITrade } from '@yuants/data-trade';
import { firstValueFrom } from 'rxjs';
import { terminal$ } from '../Network';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { IOHLC } from '@yuants/data-ohlc';

export const generatePositions = (tradeList: ITrade[]) => {
  let cashBalance = 0;
  const position = { volume: 0, avgPrice: 0 };

  const result: {
    cashBalance: number;
    volume: number;
    avgPrice: number;
    time: number;
    tt: string;
  }[] = [];

  for (const trade of tradeList) {
    const { direction, fee, traded_price, traded_value, traded_volume, created_at, id } = trade;

    if (direction === 'OPEN_LONG' || direction === 'CLOSE_SHORT') {
      cashBalance -= parseFloat(traded_value) + +fee;
      const preVolume = position.volume;
      position.volume += parseFloat(traded_volume);
      if (position.volume === 0) position.avgPrice = 0;
      if (position.volume > 0) {
        if (preVolume <= 0) {
          position.avgPrice = parseFloat(traded_price);
        } else {
          position.avgPrice =
            (Math.abs(preVolume * position.avgPrice) + parseFloat(traded_price) * parseFloat(traded_volume)) /
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
            (Math.abs(preVolume * position.avgPrice) + parseFloat(traded_price) * parseFloat(traded_volume)) /
            Math.abs(position.volume);
        }
      }
    }
    result.push({
      ...position,
      cashBalance,
      time: ~~(new Date(created_at ?? '').getTime() / 1000),
      tt: new Date(created_at ?? '').toLocaleString(),
    });
  }
  return result;
};

export const generateNetValue = async (
  ohlc: IOHLC[],
  startTime: string,
  endTime: string,
  productInfo: IProduct,
  accountId: string,
) => {
  const terminal = await firstValueFrom(terminal$);
  const netValueList: number[] = [];
  const volumeList: number[] = [];
  if (terminal) {
    const originTradeList = await requestSQL<ITrade[]>(
      terminal,
      `
         select * from trade where account_id=${escapeSQL(accountId)} and product_id=${escapeSQL(
        productInfo.product_id,
      )} and created_at>=${escapeSQL(formatTime(startTime))} and created_at<=${escapeSQL(
        formatTime(endTime),
      )} order by created_at;
             `,
    );

    const startIndex = originTradeList.findIndex((trade) => parseFloat(trade.post_volume) === 0);
    if (startIndex === -1) {
      return [netValueList, volumeList];
    }
    const tradeList = originTradeList.slice(startIndex + 1);
    const positions = generatePositions(tradeList);
    let currentPositionIndex = 0;
    for (let i = 0; i < ohlc.length; i++) {
      const currentOHLC = ohlc[i];
      const ohlcTimeOpenInSecond = ~~(new Date(currentOHLC.created_at ?? '').getTime() / 1000);
      const ohlcTimeCloseInSecond = ~~(new Date(currentOHLC.closed_at ?? '').getTime() / 1000);
      if (ohlcTimeCloseInSecond < positions[0].time) {
        netValueList.push(0);
        volumeList.push(0);
        continue;
      }
      while (
        currentPositionIndex + 1 < positions.length &&
        positions[currentPositionIndex + 1].time >= ohlcTimeOpenInSecond &&
        positions[currentPositionIndex + 1].time < ohlcTimeCloseInSecond
      ) {
        currentPositionIndex++;
      }
      const position = positions[currentPositionIndex];
      const netValue = position.cashBalance + position.volume * +currentOHLC.close;
      netValueList.push(netValue);
      volumeList.push(position.volume);
    }
  }
  return [netValueList, volumeList];
};
