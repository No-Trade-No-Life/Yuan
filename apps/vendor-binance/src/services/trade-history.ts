import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime, resourcePool } from '@yuants/utils';
import { ICredential, isApiError } from '../api/client';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { ITradeHistory } from '@yuants/data-trade';
import { getSpotAccountInfo, getUmAccountTradeList } from '../api/private-api';
import { Subject, groupBy, mergeMap, debounceTime, tap, EMPTY, catchError } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

interface IFetchTradeHistoryRequest {
  credential: ICredential;
  accountId: string;
  productId: string;
  symbol: string;
}

const queueMap = new Map<string, boolean>();
const mapCredentialToAccountId = new Map<string, string>();

const request$ = new Subject<IFetchTradeHistoryRequest>();

request$
  .pipe(
    groupBy((req) => `${req.accountId}-${req.productId}`),
    mergeMap((group) => group.pipe(debounceTime(10000))),
    mergeMap((req) =>
      fetchTradeHistoryActual(req.credential, req.accountId, req.productId, req.symbol).catch((e) => {
        console.error(formatTime(Date.now()), 'FetchTradeHistoryError', e);
      }),
    ),
  )
  .subscribe();

export const fetchTradeHistory = async (credential: ICredential, productId: string, symbol: string) => {
  if (!mapCredentialToAccountId.has(encodePath(credential.access_key, credential.secret_key))) {
    const spotAccountInfo = await getSpotAccountInfo(credential);
    if (isApiError(spotAccountInfo)) {
      throw new Error(spotAccountInfo.msg);
    }
    const accountId = encodePath('BINANCE', spotAccountInfo.uid);
    mapCredentialToAccountId.set(encodePath(credential.access_key, credential.secret_key), accountId);
  }
  const accountId = mapCredentialToAccountId.get(encodePath(credential.access_key, credential.secret_key));
  if (!accountId) {
    throw new Error('AccountIdNotFound');
  }
  request$.next({ credential, accountId, productId, symbol });
};

const fetchTradeHistoryActual = async (
  credential: ICredential,
  accountId: string,
  productId: string,
  symbol: string,
) => {
  try {
    resourcePool(`${accountId}-${productId}`, { capacity: 1 }).acquireSync(1);
    await fetchTradeData(credential, accountId, productId, symbol).finally(() => {
      resourcePool(`${accountId}-${productId}`, { capacity: 1 }).release(1);
      if (queueMap.get(`${accountId}-${productId}`)) {
        request$.next({ credential, accountId, productId, symbol });
        queueMap.delete(`${accountId}-${productId}`);
      }
    });
  } catch (error) {
    queueMap.set(`${accountId}-${productId}`, true);
    console.error(
      formatTime(Date.now()),
      'FetchTradeHistoryActualError',
      error instanceof Error ? error.message : error,
    );
  }
};

const fetchTradeData = async (
  credential: ICredential,
  accountId: string,
  productId: string,
  symbol: string,
  fromId?: number,
) => {
  try {
    const params: any = {
      symbol,
      limit: 1000,
      timestamp: Date.now(),
    };

    if (fromId) {
      params.fromId = fromId;
    } else {
      const lastTrade = await requestSQL<ITradeHistory[]>(
        terminal,
        `select origin from trade_history where account_id = ${escapeSQL(
          accountId,
        )} and product_id = ${escapeSQL(productId)} order by created_at desc limit 1`,
      );

      if (lastTrade && lastTrade[0]) {
        params.fromId = Number(lastTrade[0].origin.id);
      }
    }

    const trades = await getUmAccountTradeList(credential, params);
    if (!Array.isArray(trades)) {
      throw new Error('GetUmAccountTradeListFailed');
    }
    const formatTrades = trades.map((v) => {
      let direction = 'OPEN_LONG';
      if (v.side === 'SELL') {
        if (v.positionSide === 'LONG') {
          direction = 'CLOSE_LONG';
        } else if (v.positionSide === 'SHORT') {
          direction = 'OPEN_SHORT';
        } else if (v.positionSide === 'BOTH') {
          direction = 'CLOSE_LONG';
        } else {
          direction = 'OPEN_SHORT';
        }
      } else {
        if (v.positionSide === 'LONG') {
          direction = 'OPEN_LONG';
        } else if (v.positionSide === 'SHORT') {
          direction = 'CLOSE_SHORT';
        } else if (v.positionSide === 'BOTH') {
          direction = 'OPEN_LONG';
        } else {
          direction = 'CLOSE_SHORT';
        }
      }
      return {
        id: String(v.id),
        account_id: accountId,
        product_id: productId,
        size: v.qty,
        price: v.price,
        created_at: formatTime(Number(v.time)),
        pnl: v.realizedPnl,
        fee: v.commission,
        fee_currency: v.commissionAsset,
        direction,
        origin: v,
      };
    });
    await requestSQL(
      terminal,
      buildInsertManyIntoTableSQL(formatTrades, 'trade_history', {
        columns: [
          'id',
          'account_id',
          'product_id',
          'size',
          'price',
          'created_at',
          'pnl',
          'fee',
          'fee_currency',
          'direction',
          'origin',
        ],
        conflictKeys: ['id', 'account_id'],
      }),
    );
    if (trades.length === params.limit) {
      await fetchTradeData(credential, accountId, productId, symbol, trades[trades.length - 1].id);
    }
  } catch (e) {
    console.error(formatTime(Date.now()), 'FetchTradeDataError', e instanceof Error ? e.message : e);
  }
};
