import { ITrade } from '@yuants/data-trade';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { BehaviorSubject, defer, filter, firstValueFrom, Subject, switchMap, tap } from 'rxjs';
import { terminal$ } from '../Network';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { IProduct } from '@yuants/data-product';
import { useEffect, useMemo } from 'react';
import { useObservableState } from 'observable-hooks';

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
  asks: Map<string, [price: string, volume: string, seqId: number]>;
  bids: Map<string, [price: string, volume: string, seqId: number]>;
  seqId: number;
}

interface IWSOrderBook {
  asks: [price: string, volume: string, abandon: string, order_number: string][];
  bids: [price: string, volume: string, abandon: string, order_number: string][];
  ts: string;
  prevSeqId: number;
  seqId: number;
  checksum: number;
}

// const sub = new Subject<{ bis: []; ask: [] }>();

export const mapUniqueProductIdToOrderBookSubject = new Map<string, BehaviorSubject<IOrderBooks>>();

export const useOrderBooks = (uniqueProductId: string) => {
  const orderBookMemo$ = useMemo(() => {
    const orderBook$ = new BehaviorSubject<IOrderBooks>({
      bids: new Map(),
      asks: new Map(),
      seqId: 0,
    });
    mapUniqueProductIdToOrderBookSubject.set(uniqueProductId, orderBook$);
    return orderBook$;
  }, [uniqueProductId]);

  useEffect(() => {
    const [datasource_id, product_id] = decodePath(uniqueProductId);
    if (datasource_id === 'OKX' && product_id) {
      const orderBookSub = useOKXOrderBooks(uniqueProductId);
      () => {
        mapUniqueProductIdToOrderBookSubject.delete(uniqueProductId);
        orderBookSub.unsubscribe();
      };
    }

    return () => {
      mapUniqueProductIdToOrderBookSubject.delete(uniqueProductId);
    };
  }, [uniqueProductId]);

  return useObservableState(orderBookMemo$);
};

export const useOKXOrderBooks = (uniqueProductId: string) => {
  const [, product_id] = decodePath(uniqueProductId);

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

  const sub = terminal$
    .pipe(
      //
      filter((x): x is Exclude<typeof x, undefined | null> => !!x),
      switchMap((terminal) =>
        terminal.channel.subscribeChannel<IWSOrderBook>('MarketBooks', encodePath('OKX', product_id)),
      ),
    )
    .pipe(tap((v) => mergeOKXOrderBooks(v, uniqueProductId)))
    .subscribe();

  return sub;
};

function mergeOKXOrderBooks(book: IWSOrderBook, uniqueProductId: string) {
  const orderBook$ = mapUniqueProductIdToOrderBookSubject.get(uniqueProductId);
  if (orderBook$ && book) {
    const currentBooks = orderBook$.value;
    book.bids.forEach((item) => {
      if (item[1] === '0') {
        currentBooks?.bids.delete(item[0]);
      } else {
        currentBooks?.bids.set(item[0], [item[0], item[1], book.seqId]);
      }
    });
    book.asks.forEach((item) => {
      if (item[1] === '0') {
        currentBooks?.asks.delete(item[0]);
      } else {
        currentBooks?.asks.set(item[0], [item[0], item[1], book.seqId]);
      }
    });
    orderBook$.next({ ...currentBooks });
  }
}
