import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { isApiError } from '../../api/client';
import { getFundingAsset, getSpotAccountInfo, ICredential } from '../../api/private-api';
import { getSpotTickerPrice } from '../../api/public-api';

export const getSpotAccountInfoSnapshot = async (credential: ICredential): Promise<IPosition[]> => {
  const [res, fundingAsset] = await Promise.all([
    getSpotAccountInfo(credential, { omitZeroBalances: true }),
    getFundingAsset(credential, {
      timestamp: Date.now(),
    }),
  ]);

  if (isApiError(res)) {
    throw new Error(res.msg);
  }
  if (isApiError(fundingAsset)) {
    throw new Error(fundingAsset.msg);
  }

  const prices = await getSpotTickerPrice({
    symbols: JSON.stringify([
      ...new Set([
        ...res.balances
          .map((balance) => {
            const match = balance.asset.match(/^LD(\w+)$/);
            let symbol = balance.asset;
            if (match) {
              symbol = match[1];
            }
            if (symbol === 'USDT') return '';
            return `${symbol}USDT`;
          })
          .filter(Boolean),
        ...fundingAsset.map((item) => `${item.asset}USDT`),
      ]),
    ]),
  });

  const positions = [...res.balances, ...fundingAsset]
    .map((balance) => {
      const volume = +balance.free + +balance.locked;
      if (!volume) return undefined;
      const position: IPosition = makeSpotPosition({
        position_id: `spot/${balance.asset}`,
        datasource_id: 'BINANCE',
        product_id: encodePath('BINANCE', 'SPOT', `${balance.asset}`),
        volume,
        free_volume: +balance.free,
        closable_price:
          balance.asset === 'USDT'
            ? 1
            : Array.isArray(prices)
            ? +(prices.find((item) => item.symbol === `${balance.asset}USDT`)?.price ?? 0)
            : 0,
      });
      return position;
    })
    .filter((position): position is IPosition => Boolean(position));
  return positions;
};
