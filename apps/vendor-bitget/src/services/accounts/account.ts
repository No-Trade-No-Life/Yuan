import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { getAccountAssets, getCurrentPosition, IUtaPosition } from '../../api/private-api';
import { getTickers } from '../../api/public-api';
import { ICredential } from '../../api/types';

const mapDerivativePosition = (position: IUtaPosition): IPosition => ({
  position_id: `${position.symbol}-${position.posSide}`,
  datasource_id: 'BITGET',
  product_id: encodePath('BITGET', position.category, position.symbol),
  direction: position.posSide === 'long' ? 'LONG' : 'SHORT',
  volume: +position.total,
  free_volume: +(position.available ?? 0),
  position_price: +position.avgPrice,
  closable_price: +(position.markPrice ?? 0),
  floating_profit: +(position.unrealisedPnl ?? 0),
  valuation: +position.total * +(position.markPrice ?? 0),
});

export const getAccountInfo = async (credential: ICredential): Promise<IPosition[]> => {
  const categories = ['USDT-FUTURES', 'COIN-FUTURES'];
  const [assetsRes, positionsResList, spotTickersRes] = await Promise.all([
    getAccountAssets(credential),
    Promise.all(categories.map((category) => getCurrentPosition(credential, { category }))),
    getTickers({ category: 'SPOT' }),
  ]);

  if (assetsRes.msg !== 'success') {
    throw new Error(assetsRes.msg);
  }
  if (spotTickersRes.msg !== 'success') {
    throw new Error(spotTickersRes.msg);
  }

  const spotPriceMap = new Map<string, number>(
    (spotTickersRes.data ?? []).map((ticker) => [ticker.symbol, Number(ticker.lastPrice)]),
  );

  const derivativePositions = positionsResList.flatMap((res, idx) => {
    if (res.msg !== 'success') {
      throw new Error(res.msg);
    }
    const category = categories[idx];
    return (res.data?.list ?? []).map((position) => mapDerivativePosition({ ...position, category }));
  });

  const spotPositions =
    assetsRes.data?.assets?.map((asset) =>
      makeSpotPosition({
        position_id: asset.coin,
        product_id: encodePath('BITGET', 'SPOT', `${asset.coin}USDT`),
        volume: +asset.balance,
        free_volume: +asset.available,
        closable_price: spotPriceMap.get(`${asset.coin}USDT`) ?? 1,
      }),
    ) ?? [];

  return [...derivativePositions, ...spotPositions];
};
