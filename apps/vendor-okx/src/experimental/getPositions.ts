import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { getSpotPrice } from '../accountInfos/trading';
import {
  getAccountBalance,
  getAccountPositions,
  getAssetBalances,
  getFinanceSavingsBalance,
  getFlexibleLoanInfo,
  ICredential,
} from '../api/private-api';
import { productCache } from './product';

export const getPositions = async (credential: ICredential): Promise<IPosition[]> => {
  const positions: IPosition[] = [];

  const [positionsApi, balanceApi, assetBalancesApi, offersApi, flexibleLoanInfoApi] = await Promise.all([
    // Trading Accounts
    getAccountPositions(credential, {}),
    getAccountBalance(credential, {}),
    // Funding Accounts
    getAssetBalances(credential, {}),
    // Earning Accounts
    getFinanceSavingsBalance(credential, {}),
    // Loan Accounts
    getFlexibleLoanInfo(credential),
  ]);

  // 现货头寸
  for (const detail of balanceApi.data?.[0]?.details || []) {
    const volume = +(detail.cashBal ?? 0);
    const free_volume = Math.min(
      volume, // free should no more than balance if there is much profits
      +(detail.availEq ?? 0),
    );

    const product_id = encodePath('OKX', 'SPOT', `${detail.ccy}-USDT`);
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
  }
  for (const x of positionsApi.data || []) {
    const direction =
      x.posSide === 'long' ? 'LONG' : x.posSide === 'short' ? 'SHORT' : +x.pos > 0 ? 'LONG' : 'SHORT';
    const volume = Math.abs(+x.pos);
    const product_id = encodePath('OKX', x.instType, x.instId);
    const closable_price = +x.last;
    const theProduct = await productCache.query(product_id);
    const valuation = (theProduct?.value_scale ?? 1) * volume * closable_price || 0;

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
  }

  for (const x of assetBalancesApi.data || []) {
    positions.push(
      makeSpotPosition({
        datasource_id: 'OKX',
        position_id: encodePath('OKX', 'FUNDING-ASSET', `${x.ccy}`),
        product_id: encodePath('OKX', 'FUNDING-ASSET', `${x.ccy}`),
        volume: +x.bal,
        free_volume: +x.bal,
        closable_price: getSpotPrice(x.ccy),
      }),
    );
  }

  for (const offer of offersApi.data || []) {
    positions.push(
      makeSpotPosition({
        position_id: encodePath('OKX', 'EARNING-ASSET', `${offer.ccy}`),
        datasource_id: 'OKX',
        product_id: encodePath('OKX', 'EARNING-ASSET', `${offer.ccy}`),
        volume: +offer.amt,
        free_volume: +offer.amt,
        closable_price: getSpotPrice(offer.ccy),
      }),
    );
  }

  for (const loan of flexibleLoanInfoApi.data?.[0]?.loanData || []) {
    positions.push({
      datasource_id: 'OKX',
      position_id: encodePath('OKX', 'LOAN', `${loan.ccy}`),
      product_id: encodePath('OKX', 'LOAN', `${loan.ccy}`),
      volume: +loan.amt,
      free_volume: +loan.amt,
      direction: 'SHORT',
      position_price: 0,
      closable_price: getSpotPrice(loan.ccy),
      floating_profit: -getSpotPrice(loan.ccy) * +loan.amt,
      valuation: getSpotPrice(loan.ccy) * +loan.amt,
    });
  }

  for (const collateral of flexibleLoanInfoApi.data?.[0]?.collateralData || []) {
    positions.push(
      makeSpotPosition({
        position_id: encodePath('OKX', 'COLLATERAL', `${collateral.ccy}`),
        datasource_id: 'OKX',
        product_id: encodePath('OKX', 'COLLATERAL', `${collateral.ccy}`),
        volume: +collateral.amt,
        free_volume: +collateral.amt,
        closable_price: getSpotPrice(collateral.ccy),
      }),
    );
  }

  return positions;
};
