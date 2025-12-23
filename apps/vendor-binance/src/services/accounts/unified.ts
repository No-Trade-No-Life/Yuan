import { createCache } from '@yuants/cache';
import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { encodePath } from '@yuants/utils';
import { isApiError } from '../../api/client';
import {
  getFundingAsset,
  getSpotAccountInfo,
  getUnifiedAccountBalance,
  getUnifiedUmAccount,
  ICredential,
} from '../../api/private-api';

const terminal = Terminal.fromNodeEnv();

const quoteCache = createCache<IQuote>(
  async (product_id) => {
    const sql = `select * from quote where product_id = ${escapeSQL(product_id)}`;
    const [quote] = await requestSQL<IQuote[]>(terminal, sql);
    return quote;
  },
  { expire: 10_000 },
);

export const getPositions = async (credential: ICredential): Promise<IPosition[]> => {
  const [balanceRes, umAccountRes, res, fundingAsset] = await Promise.all([
    getUnifiedAccountBalance(credential),
    getUnifiedUmAccount(credential),
    getSpotAccountInfo(credential, { omitZeroBalances: true }),
    getFundingAsset(credential, {
      timestamp: Date.now(),
    }),
  ]);
  if (isApiError(balanceRes)) {
    throw new Error(balanceRes.msg);
  }
  if (isApiError(umAccountRes)) {
    throw new Error(umAccountRes.msg);
  }
  if (isApiError(res)) {
    throw new Error(res.msg);
  }
  if (isApiError(fundingAsset)) {
    throw new Error(fundingAsset.msg);
  }

  const positions: IPosition[] = [];

  for (const balance of [...res.balances, ...fundingAsset]) {
    const volume = +balance.free + +balance.locked;
    if (!volume) continue;
    positions.push(
      makeSpotPosition({
        position_id: `spot/${balance.asset}`,
        datasource_id: 'BINANCE',
        product_id: encodePath('BINANCE', 'SPOT', `${balance.asset}`),
        volume,
        free_volume: +balance.free,
        closable_price:
          balance.asset === 'USDT'
            ? 1
            : +(
                (await quoteCache.query(encodePath('BINANCE', 'SPOT', `${balance.asset}USDT`)))?.last_price ||
                0
              ),
      }),
    );
  }

  for (const position of umAccountRes.positions) {
    if (+position.positionAmt === 0) continue;
    positions.push({
      position_id: `${position.symbol}/${position.positionSide}`,
      datasource_id: 'BINANCE',
      product_id: encodePath('BINANCE', 'USDT-FUTURE', position.symbol),
      direction:
        position.positionSide === 'LONG'
          ? 'LONG'
          : position.positionSide === 'SHORT'
          ? 'SHORT'
          : position.positionSide === 'BOTH'
          ? 'BOTH'
          : 'UNKNOWN',
      volume: Math.abs(+position.positionAmt),
      free_volume: Math.abs(+position.positionAmt),
      position_price: +position.entryPrice,
      // ISSUE: positionAmt 有正负，这里计算有个 trick，不需要区分仓位方向
      closable_price: +position.entryPrice + +position.unrealizedProfit / +position.positionAmt,
      floating_profit: +position.unrealizedProfit,
      valuation:
        +position.positionAmt *
        (+position.entryPrice +
          (+position.positionAmt === 0 ? 0 : +position.unrealizedProfit / +position.positionAmt)),
    });
  }

  for (const position of balanceRes) {
    if (+position.totalWalletBalance === 0) continue;
    positions.push(
      makeSpotPosition({
        position_id: `UNIFIED-SPOT/${position.asset}`,
        datasource_id: 'BINANCE',
        product_id: encodePath('BINANCE', 'UNIFIED-SPOT', position.asset),
        volume: +position.totalWalletBalance,
        free_volume: +position.crossMarginFree,
        closable_price:
          position.asset === 'USDT'
            ? 1
            : +(
                (await quoteCache.query(encodePath('BINANCE', 'SPOT', `${position.asset}USDT`)))
                  ?.last_price || 0
              ),
      }),
    );
  }

  return positions;
};
