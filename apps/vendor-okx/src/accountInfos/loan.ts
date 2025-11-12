import { IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { ICredential, getFlexibleLoanInfo } from '../api';
import { IAccountInfoCore } from './types';

export const getLoanAccountInfo = async (credential: ICredential): Promise<IAccountInfoCore> => {
  const res = await getFlexibleLoanInfo(credential);
  const data = res.data[0];

  const positions: IPosition[] = [];
  for (const loan of data.loanData) {
    positions.push({
      datasource_id: 'OKX',
      product_id: `SPOT/${loan.ccy}-USDT`,
      volume: +loan.amt,
      free_volume: +loan.amt,
      position_id: encodePath('loan', loan.ccy),
      direction: 'SHORT',
      position_price: 0,
      closable_price: 0,
      floating_profit: 0,
      valuation: 0,
    });
  }
  for (const collateral of data.collateralData) {
    positions.push({
      datasource_id: 'OKX',
      product_id: `SPOT/${collateral.ccy}-USDT`,
      volume: +collateral.amt,
      free_volume: +collateral.amt,
      position_id: encodePath('collateral', collateral.ccy),
      direction: 'LONG',
      position_price: 0,
      closable_price: 0,
      floating_profit: 0,
      valuation: 0,
    });
  }
  const equity = +data.collateralNotionalUsd - +data.loanNotionalUsd;
  const free = equity - +data.collateralNotionalUsd;

  return {
    money: {
      currency: 'USDT',
      equity,
      free,
    },
    positions,
  };
};
