import { IProduct } from '@yuants/data-product';
import { ITrade } from '@yuants/data-trade';
import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { encodePath, formatTime } from '@yuants/utils';
import { defer, repeat, retry, tap, timeout } from 'rxjs';
import { getAccountBillsArchive, getDefaultCredential } from './api/private-api';
import { getTradingAccountId } from './accountInfos/uid';

const credential = getDefaultCredential();

const tradeParser = async (accountId: string, params: Record<string, string>): Promise<ITrade[]> => {
  const tradeList: ITrade[] = [];
  const result = await getAccountBillsArchive(credential, params);
  const productIdToProduct = new Map<string, IProduct>();
  const productIdSet = new Set<string>();
  if (result.code === '0' && result.data) {
    const data = result.data;
    const mapTradeIdToBillList = new Map<string, typeof data>();
    data.forEach((item) => {
      productIdSet.add(encodePath('OKX', item.instType, item.instId));
      mapTradeIdToBillList.set(item.tradeId, [...(mapTradeIdToBillList.get(item.tradeId) ?? []), item]);
    });
    if (productIdSet.size > 0) {
      const productList = await requestSQL<IProduct[]>(
        Terminal.fromNodeEnv(),
        `
        select * from product where product_id in (${Array.from(productIdSet)
          .map((productId) => escapeSQL(productId))
          .join(',')})
      `,
      );
      if (productList.length > 0) {
        productList.forEach((p) => productIdToProduct.set(p.product_id, p));
      }
    }
    for (const [tradeId, v] of mapTradeIdToBillList) {
      if (!((v[0].instType === 'SPOT' && v.length === 2) || v[0].instType === 'SWAP')) continue;
      const trade: ITrade = {
        id: tradeId,
        account_id: accountId,
        product_id: '',
        direction: '',
        traded_volume: '',
        traded_price: '',
        traded_value: '',
        post_volume: '',
        fee: '',
        fee_currency: '',
        created_at: '0',
      };

      v.forEach((bill) => {
        trade.created_at = Math.max(Number(trade.created_at), Number(bill.ts)).toString();
        trade.product_id = encodePath('OKX', bill.instType, bill.instId);
        trade.traded_price = bill.px;
        if (bill.instType === 'SWAP') {
          if (bill.subType === '1') trade.direction = 'OPEN_LONG';
          if (bill.subType === '2') trade.direction = 'CLOSE_LONG';
          if (bill.subType === '3') trade.direction = 'OPEN_LONG';
          if (bill.subType === '4') trade.direction = 'OPEN_SHORT';
          if (bill.subType === '5') trade.direction = 'CLOSE_LONG';
          if (bill.subType === '6') trade.direction = 'CLOSE_SHORT';
          trade.traded_volume = bill.sz;
          trade.traded_value = (Number(bill.sz) * Number(bill.px)).toString();
        }
        if (bill.instType === 'SPOT') {
          if (bill.subType === '1') {
            if (bill.ccy !== 'USDT') {
              trade.direction = 'OPEN_LONG';
            } else {
              trade.direction = 'CLOSE_LONG';
            }
          }

          if (bill.ccy !== 'USDT') {
            trade.traded_volume = bill.sz;
          }
          if (bill.ccy === 'USDT') {
            trade.traded_value = bill.sz;
          }
        }
        // fee
        if (bill.fee !== '0') {
          trade.fee = Math.abs(Number(bill.fee)).toString();
          trade.fee_currency = bill.ccy;
        }
      });
      trade.created_at = formatTime(Number(trade.created_at));
      if (productIdToProduct.has(trade.product_id)) {
        trade.traded_value = (
          +trade.traded_value * +(productIdToProduct.get(trade.product_id)?.value_scale ?? 1)
        ).toString();
      } else {
        throw new Error(`Not Found Product With Product Id: ${trade.product_id}`);
      }
      tradeList.push(trade);
    }
  }
  return tradeList;
};

const getAccountTradeWithAccountId = async (accountId: string) => {
  const currentTrade = await requestSQL<ITrade[]>(
    Terminal.fromNodeEnv(),
    `
    select * from trade where account_id=${escapeSQL(accountId)} order by created_at desc limit 1;
  `,
  );
  const params: Record<string, string> = {
    type: '2',
    begin: (new Date().getTime() - 1000 * 60 * 60 * 24 * 30 * 3).toString(),
  };
  if (currentTrade.length === 1) {
    params['begin'] = new Date(currentTrade[0].created_at ?? 0).getTime().toString();
  }
  console.log(formatTime(Date.now()), 'getAccountTrade', `params: ${JSON.stringify(params)}`);
  const tradeList = await tradeParser(accountId, params);
  console.log(formatTime(Date.now()), 'getAccountTrade', `tradeList: ${JSON.stringify(tradeList)}`);
  await requestSQL(
    Terminal.fromNodeEnv(),
    buildInsertManyIntoTableSQL(tradeList, 'trade', {
      columns: [
        'id',
        'account_id',
        'product_id',
        'traded_volume',
        'traded_value',
        'traded_price',
        'direction',
        'fee',
        'fee_currency',
        'created_at',
      ],
      conflictKeys: ['id'],
    }),
  );
};

(async () => {
  const account_id = await getTradingAccountId(credential);
  console.log(formatTime(Date.now()), 'getAccountTrade', `AccountID: ${account_id}`);
  defer(() => getAccountTradeWithAccountId(account_id))
    .pipe(
      //
      timeout(10_000), //  超时设定：10 秒
      tap({
        error: (err) => {
          console.error(formatTime(Date.now()), 'getAccountTradeError', err);
        },
      }),
      repeat({ delay: 30_000 }),
      retry({ delay: 5000 }),
    )
    .subscribe();
})();
