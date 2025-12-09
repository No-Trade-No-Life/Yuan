import { IActionHandlerOfGetAccountInfo, IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { defer, firstValueFrom, map, repeat, retry, shareReplay } from 'rxjs';
import { ICredential, getAccountBalance, getAccountPositions } from '../api/private-api';
import { getMarketIndexTicker } from '../api/public-api';
import { productService } from '../public-data/product';

const priceCache = new Map<string, number>();

export const marketIndexTickerUSDT$ = defer(() => getMarketIndexTicker({ quoteCcy: 'USDT' })).pipe(
  map((x) => {
    const mapInstIdToPrice = new Map<string, number>();
    x.data.forEach((inst: any) => {
      mapInstIdToPrice.set(inst.instId, Number(inst.idxPx));
      priceCache.set(inst.instId, Number(inst.idxPx));
    });
    return mapInstIdToPrice;
  }),
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

marketIndexTickerUSDT$.subscribe();

export const getSpotPrice = (ccy: string) => {
  if (ccy === 'USDT') return 1;
  return priceCache.get(`${ccy}-USDT`) || 0;
};

export const getTradingAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const [positionsApi, balanceApi, mapProductIdToProduct] = await Promise.all([
    getAccountPositions(credential, {}),
    getAccountBalance(credential, {}),
    firstValueFrom(productService.mapProductIdToProduct$),
  ]);

  const positions: IPosition[] = [];

  // 现货头寸
  balanceApi.data[0]?.details.forEach((detail) => {
    const volume = +(detail.cashBal ?? 0);
    const free_volume = Math.min(
      volume, // free should no more than balance if there is much profits
      +(detail.availEq ?? 0),
    );

    const product_id = encodePath('SPOT', `${detail.ccy}-USDT`);
    positions.push(
      makeSpotPosition({
        position_id: product_id,
        datasource_id: 'OKX',
        product_id: product_id,
        volume: volume,
        free_volume: free_volume,
        closable_price: getSpotPrice(detail.ccy),
      }),
    );
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
      liquidation_price: x.liqPx,
      valuation,
    });
  });
  return positions;
};
