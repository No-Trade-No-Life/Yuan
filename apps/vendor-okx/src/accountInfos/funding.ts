import { IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { firstValueFrom } from 'rxjs';
import { ICredential, getAssetBalances } from '../api';
import { marketIndexTickerUSDT$ } from './trading';
import { IAccountInfoCore } from './types';

export const getFundingAccountInfo = async (credential: ICredential): Promise<IAccountInfoCore> => {
  const [assetBalances, marketIndexTickerUSDT] = await Promise.all([
    getAssetBalances(credential, {}),
    firstValueFrom(marketIndexTickerUSDT$),
  ]);

  const positions: IPosition[] = [];
  let equity = 0;
  let free = 0;

  assetBalances.data.forEach((x) => {
    if (x.ccy === 'USDT') {
      const balance = +x.bal;
      equity += balance;
      free += balance;
      return;
    }

    const price = marketIndexTickerUSDT.get(`${x.ccy}-USDT`) || 0;
    const valuation = price * +x.bal || 0;
    const productId = encodePath('SPOT', `${x.ccy}-USDT`);

    positions.push({
      datasource_id: 'OKX',
      position_id: productId,
      product_id: productId,
      direction: 'LONG',
      volume: +x.bal,
      free_volume: +x.bal,
      position_price: price,
      floating_profit: 0,
      closable_price: price,
      valuation,
    });

    equity += valuation;
  });

  return {
    money: {
      currency: 'USDT',
      equity,
      free,
    },
    positions,
  };
};
