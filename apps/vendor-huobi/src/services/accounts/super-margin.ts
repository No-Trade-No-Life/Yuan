import { IActionHandlerOfGetAccountInfo, IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { getSpotAccountBalance, ICredential } from '../../api/private-api';
import { quoteCache } from '../market-data/quote';
import { superMarginAccountUidCache } from '../uid';

/**
 * 全仓杠杆账户 (Super Margin Account)
 */
export const getSuperMarginAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const positions: IPosition[] = [];
  // get account balance
  const superMarginAccountUid = await superMarginAccountUidCache.query(JSON.stringify(credential));
  if (!superMarginAccountUid) throw new Error('Failed to get Super Margin Account UID');
  const accountBalance = await getSpotAccountBalance(credential, superMarginAccountUid);
  const balanceList = accountBalance.data?.list || [];

  // get prices and create positions
  for (const currencyData of balanceList) {
    if (currencyData.balance === '0') continue;
    const product_id = encodePath('HTX', 'SPOT', currencyData.currency + 'usdt');
    const quote = await quoteCache.query(currencyData.currency);
    const closable_price = currencyData.currency === 'usdt' ? 1 : +(quote?.ask_price ?? 0);

    positions.push(
      makeSpotPosition({
        position_id: `${currencyData.currency}/usdt/spot`,
        product_id: product_id,
        volume: +currencyData.balance,
        free_volume: +currencyData.balance,
        closable_price: closable_price,
      }),
    );
  }

  return positions;
};
