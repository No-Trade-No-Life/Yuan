import { IAccountMoney, IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { defer, firstValueFrom, map, repeat, retry, shareReplay } from 'rxjs';
import { ICredential, getAccountBalance, getAccountPositions } from '../api';
import { productService } from '../product';
import { getMarketIndexTicker } from '../public-api';
import { IAccountInfoCore } from './types';

export const marketIndexTickerUSDT$ = defer(() => getMarketIndexTicker({ quoteCcy: 'USDT' })).pipe(
  map((x) => {
    const mapInstIdToPrice = new Map<string, number>();
    x.data.forEach((inst: any) => mapInstIdToPrice.set(inst.instId, Number(inst.idxPx)));
    return mapInstIdToPrice;
  }),
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

export const getTradingAccountInfo = async (credential: ICredential): Promise<IAccountInfoCore> => {
  const [positionsApi, balanceApi, mapProductIdToProduct, marketIndexTickerUSDT] = await Promise.all([
    getAccountPositions(credential, {}),
    getAccountBalance(credential, {}),
    firstValueFrom(productService.mapProductIdToProduct$),
    firstValueFrom(marketIndexTickerUSDT$),
  ]);

  let totalEquity = 0;
  let totalFree = 0;
  const positions: IPosition[] = [];

  balanceApi.data[0]?.details.forEach((detail) => {
    if (detail.ccy === 'USDT') {
      const balance = +(detail.cashBal ?? 0);
      const free = Math.min(
        balance, // free should no more than balance if there is much profits
        +(detail.availEq ?? 0),
      );
      const equity = +(detail.eq ?? 0) - +(detail.stgyEq ?? 0);
      totalEquity += equity;
      totalFree += free;
    } else {
      const volume = +(detail.cashBal ?? 0);
      const free_volume = Math.min(
        volume, // free should no more than balance if there is much profits
        +(detail.availEq ?? 0),
      );
      const closable_price = marketIndexTickerUSDT.get(detail.ccy + '-USDT') || 0;
      const delta_equity = volume * closable_price || 0;
      const delta_profit = +detail.totalPnl || 0;

      const product_id = encodePath('SPOT', `${detail.ccy}-USDT`);
      positions.push({
        position_id: product_id,
        datasource_id: 'OKX',
        product_id: product_id,
        direction: 'LONG',
        volume: volume,
        free_volume: free_volume,
        position_price: +detail.accAvgPx,
        floating_profit: delta_profit,
        closable_price: closable_price,
        valuation: delta_equity,
      });

      totalEquity += delta_equity;
    }
  });
  positionsApi.data.forEach((x) => {
    const direction =
      x.posSide === 'long' ? 'LONG' : x.posSide === 'short' ? 'SHORT' : +x.pos > 0 ? 'LONG' : 'SHORT';
    const volume = Math.abs(+x.pos);
    const product_id = encodePath(x.instType, x.instId);
    const closable_price = +x.last;
    const valuation =
      (mapProductIdToProduct.get(product_id)?.value_scale ?? 1) * volume * closable_price || 0;

    positions.push({
      position_id: x.posId,
      datasource_id: 'OKX',
      product_id,
      direction,
      volume: volume,
      free_volume: +x.availPos,
      closable_price,
      position_price: +x.avgPx,
      floating_profit: +x.upl,
      valuation,
    });
  });
  return {
    money: {
      currency: 'USDT',
      equity: totalEquity,
      free: totalFree,
    },
    positions: positions,
  };
};
