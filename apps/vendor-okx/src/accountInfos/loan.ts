import { IActionHandlerOfGetAccountInfo, IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { ICredential, getFlexibleLoanInfo } from '../api/private-api';
import { getSpotPrice } from './trading';

export const getLoanAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const res = await getFlexibleLoanInfo(credential);
  const data = res.data[0];
  if (!data) return [];

  const positions: IPosition[] = [];

  const loanData = data.loanData || [];
  for (const loan of loanData) {
    positions.push({
      datasource_id: 'OKX',
      product_id: `SPOT/${loan.ccy}-USDT`,
      volume: +loan.amt,
      free_volume: +loan.amt,
      position_id: encodePath('loan', loan.ccy),
      direction: 'SHORT',
      position_price: 0,
      closable_price: getSpotPrice(loan.ccy),
      floating_profit: -getSpotPrice(loan.ccy) * +loan.amt,
      valuation: getSpotPrice(loan.ccy) * +loan.amt,
    });
  }
  const collateralData = data.collateralData || [];
  for (const collateral of collateralData) {
    positions.push(
      makeSpotPosition({
        position_id: encodePath('collateral', collateral.ccy),
        datasource_id: 'OKX',
        product_id: `SPOT/${collateral.ccy}-USDT`,
        volume: +collateral.amt,
        free_volume: +collateral.amt,
        closable_price: getSpotPrice(collateral.ccy),
      }),
    );
  }

  return positions;
};
