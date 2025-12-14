import { makeSpotPosition, type IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { getFuturePositions, getUnifiedAccounts, ICredential } from '../../api/private-api';
import { getSpotTickers } from '../../api/public-api';

const loadFuturePositions = async (credential: ICredential): Promise<IPosition[]> => {
  const positions: IPosition[] = [];
  const positionsRes = await getFuturePositions(credential, 'usdt');

  for (const position of Array.isArray(positionsRes) ? positionsRes : []) {
    if (!(Math.abs(position.size) > 0)) continue;

    const product_id = encodePath('GATE', 'FUTURE', position.contract);
    const volume = Math.abs(position.size);
    const closable_price = Number(position.mark_price);
    const valuation = volume * closable_price;
    positions.push({
      datasource_id: 'GATE',
      position_id: `${position.contract}-${position.leverage}-${position.mode}`,
      product_id,
      direction:
        position.mode === 'dual_long'
          ? 'LONG'
          : position.mode === 'dual_short'
          ? 'SHORT'
          : position.size > 0
          ? 'LONG'
          : 'SHORT',
      volume,
      free_volume: Math.abs(position.size),
      position_price: Number(position.entry_price),
      closable_price,
      floating_profit: Number(position.unrealised_pnl),
      liquidation_price: position.liq_price,
      valuation,
    });
  }

  return positions;
};

export const getUnifiedAccountInfo = async (credential: ICredential) => {
  const [futurePositions, unifiedAccount, spotTickers] = await Promise.all([
    loadFuturePositions(credential),
    getUnifiedAccounts(credential, {}),
    getSpotTickers({}),
  ]);

  const balances = unifiedAccount?.balances ?? {};
  const spotTickerList = Array.isArray(spotTickers) ? spotTickers : [];
  const spotPositions: IPosition[] = Object.keys(balances)
    .map((currency) => {
      let currency_pair = `${currency}_USDT`;
      if (currency === 'SOL2') {
        currency_pair = 'SOL_USDT';
      }
      if (currency === 'GTSOL') {
        currency_pair = 'SOL_USDT';
      }
      const closable_price =
        currency === 'USDT'
          ? 1
          : Number(spotTickerList.find((ticker) => ticker.currency_pair === currency_pair)?.last || 0);
      // TODO: 根据账户模式调整 volume 计算方式
      const volume = Number(balances[currency]?.available || 0);
      const free_volume = Number(balances[currency]?.available || 0);
      if (Math.abs(volume) === 0) return undefined;
      return makeSpotPosition({
        datasource_id: 'GATE',
        position_id: currency,
        product_id: encodePath('GATE', 'SPOT', currency + '_USDT'),
        volume,
        free_volume,
        closable_price,
      });
    })
    .filter((item): item is IPosition => !!item);

  return [...futurePositions, ...spotPositions];
};
