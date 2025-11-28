import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { getApiV1Account, getApiV1TickerPrice, getFApiV4Account, ICredential } from '../../api/private-api';
import { encodePath } from '@yuants/utils';

export const getSpotAccountInfo = async (credential: ICredential) => {
  const [x, prices, prep] = await Promise.all([
    getApiV1Account(credential, {}),
    getApiV1TickerPrice(credential, {}),
    getFApiV4Account(credential, {}),
  ]);

  const positions = x.balances.map((b): IPosition => {
    const thePrice = b.asset === 'USDT' ? 1 : prices.find((p) => p.symbol === b.asset + 'USDT')?.price ?? 0;
    return makeSpotPosition({
      position_id: b.asset,
      datasource_id: 'ASTER',
      product_id: encodePath('ASTER', 'SPOT', b.asset),
      volume: +b.free + +b.locked,
      free_volume: +b.free,
      closable_price: +thePrice,
    });
  });
  const walletAssets = prep.assets
    .filter((xx) => +xx.walletBalance > 0)
    .map((b): IPosition => {
      const thePrice = b.asset === 'USDT' ? 1 : prices.find((p) => p.symbol === b.asset + 'USDT')?.price ?? 0;
      return makeSpotPosition({
        position_id: encodePath(b.asset, 'ASSET'),
        datasource_id: 'ASTER',
        product_id: encodePath('ASTER', 'PERP-ASSET', b.asset),
        volume: +b.walletBalance,
        free_volume: +b.walletBalance,
        closable_price: +thePrice,
      });
    });

  return [...positions, ...walletAssets];
};
