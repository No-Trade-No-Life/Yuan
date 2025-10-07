import { ITrade } from '@yuants/data-trade';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { defer, filter, firstValueFrom, Subject, switchMap } from 'rxjs';
import { terminal$ } from '../Network';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { IProduct } from '@yuants/data-product';
import { useEffect } from 'react';

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

export interface IOrderBooks {
  asks: [price: string, volume: string, seqId: string][];
  bids: [price: string, volume: string, seqId: string][];
}

// const sub = new Subject<{ bis: []; ask: [] }>();

export const mapUniqueProductIdToOrderBookSubject = new Map<string, Subject<IOrderBooks>>();

export const useOrderBooks = (uniqueProductId: string) => {
  useEffect(() => {
    const [datasource_id, product_id] = decodePath(uniqueProductId);
    mapUniqueProductIdToOrderBookSubject.set(uniqueProductId, new Subject<IOrderBooks>());
    if (datasource_id === 'OKX' && product_id) {
      const orderBook = useOKXOrderBooks(product_id);
      // return orderBook;
    }

    return () => {
      mapUniqueProductIdToOrderBookSubject.delete(uniqueProductId);
    };
  }, [uniqueProductId]);

  return mapUniqueProductIdToOrderBookSubject.get(uniqueProductId);
};

export const useOKXOrderBooks = (product_id: string) => {
  const initBooks$ = defer(async () => {
    const terminal = await firstValueFrom(terminal$);
    if (terminal) {
      return terminal.client.requestForResponseData<
        {
          product_id: string;
          datasource_id: string;
          sz: string;
        },
        {
          asks: [price: string, volume: string, abandon: string, order_number: string][];
          bids: [price: string, volume: string, abandon: string, order_number: string][];
          ts: string;
        }[]
      >('QueryMarketBooks', {
        product_id,
        datasource_id: 'OKX',
        sz: '50',
      });
    }
    return null;
  });

  const books$ = terminal$.pipe(
    //
    filter((x): x is Exclude<typeof x, undefined | null> => !!x),
    switchMap((terminal) =>
      terminal.channel.subscribeChannel<
        {
          asks: [price: string, volume: string, abandon: string, order_number: string][];
          bids: [price: string, volume: string, abandon: string, order_number: string][];
          ts: string;
          prevSeqId: number;
          seqId: number;
          checksum: number;
        }[]
      >('MarketBooks', encodePath('OKX', product_id)),
    ),
  );
};
