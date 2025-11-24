import { IActionHandlerOfGetAccountInfo, IPosition, makeSpotPosition } from '@yuants/data-account';
import { getApiV1Account, getApiV1TickerPrice, ICredential } from '../../api/private-api';

export const getSpotAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (
  credential,
  account_id,
) => {
  const [x, prices] = await Promise.all([
    getApiV1Account(credential, {}),
    getApiV1TickerPrice(credential, {}),
  ]);

  const positions = x.balances.map((b): IPosition => {
    const thePrice = b.asset === 'USDT' ? 1 : prices.find((p) => p.symbol === b.asset + 'USDT')?.price ?? 0;

    return makeSpotPosition({
      position_id: b.asset,
      datasource_id: 'ASTER',
      product_id: b.asset,
      volume: +b.free + +b.locked,
      free_volume: +b.free,
      closable_price: +thePrice,
    });
  });

  return positions;
};
