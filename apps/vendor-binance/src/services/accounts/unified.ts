import { IActionHandlerOfGetAccountInfo, IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { isApiError } from '../../api/client';
import { getUnifiedAccountBalance, getUnifiedUmAccount, ICredential } from '../../api/private-api';

export const getUnifiedAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (
  credential,
  _accountId,
) => {
  const [balanceRes, umAccountRes] = await Promise.all([
    getUnifiedAccountBalance(credential),
    getUnifiedUmAccount(credential),
  ]);
  if (isApiError(balanceRes)) {
    throw new Error(balanceRes.msg);
  }
  if (isApiError(umAccountRes)) {
    throw new Error(umAccountRes.msg);
  }
  const usdtBalance = balanceRes.find((item) => item.asset === 'USDT');
  if (!usdtBalance) {
    throw new Error('USDT balance not found');
  }
  const usdtAsset = umAccountRes.assets.find((item) => item.asset === 'USDT');
  if (!usdtAsset) {
    throw new Error('USDT asset not found in UM account');
  }

  const equity = +usdtBalance.totalWalletBalance + +usdtBalance.umUnrealizedPNL;
  const free = equity - +usdtAsset.initialMargin;

  const positions: IPosition[] = umAccountRes.positions
    .filter((position) => +position.positionAmt !== 0)
    .map((position) => ({
      position_id: `${position.symbol}/${position.positionSide}`,
      datasource_id: 'BINANCE',
      product_id: encodePath('usdt-future', position.symbol),
      direction: position.positionSide === 'LONG' ? 'LONG' : 'SHORT',
      volume: +position.positionAmt,
      free_volume: +position.positionAmt,
      position_price: +position.entryPrice,
      closable_price:
        +position.positionAmt === 0
          ? +position.entryPrice
          : +position.entryPrice + +position.unrealizedProfit / +position.positionAmt,
      floating_profit: +position.unrealizedProfit,
      valuation:
        +position.positionAmt *
        (+position.entryPrice +
          (+position.positionAmt === 0 ? 0 : +position.unrealizedProfit / +position.positionAmt)),
    }));

  return {
    money: {
      currency: 'USDT',
      equity,
      free,
    },
    positions,
  };
};
