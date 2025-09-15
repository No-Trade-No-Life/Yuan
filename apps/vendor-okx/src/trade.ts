import { catchError, defer, first, firstValueFrom, interval, of, repeat, retry, timeout } from 'rxjs';
import { client } from './api';
import { ITrade } from '@yuants/data-trade';
import { accountUid$ } from './account';
import { formatTime } from '@yuants/utils';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { Terminal } from '@yuants/protocol';
const tradeParser = async (accountId: string, params: Record<string, string>): Promise<ITrade[]> => {
  const tradeList: ITrade[] = [];
  const result = await client.getAccountBillsArchive(params);

  if (result.code === '0' && result.data) {
    const data = result.data;
    const mapTradeIdToBillList = new Map<string, typeof data>();
    data.forEach((item) =>
      mapTradeIdToBillList.set(item.tradeId, [...(mapTradeIdToBillList.get(item.tradeId) ?? []), item]),
    );
    mapTradeIdToBillList.forEach((v, tradeId) => {
      if (!((v[0].instType === 'SPOT' && v.length === 2) || v[0].instType === 'SWAP')) return;

      const trade: ITrade = {
        id: tradeId,
        account_id: accountId,
        product_id: '',
        direction: '',
        traded_volume: '',
        traded_price: '',
        traded_value: '',
        fee: '',
        fee_currency: '',
        created_at: '0',
      };

      v.forEach((bill) => {
        trade.created_at = Math.max(Number(trade.created_at), Number(bill.ts)).toString();
        trade.product_id = bill.instId;
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
      tradeList.push(trade);
    });
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
  };
  if (currentTrade.length === 1) {
    params['begin'] = new Date(currentTrade[0].created_at ?? 0).getTime().toString();
    params['end'] = Date.now().toString();
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

defer(() => accountUid$)
  .pipe(first())
  .subscribe((uid) => {
    const account_id = `okx/${uid}/trading`;
    console.log(formatTime(Date.now()), 'getAccountTrade', `AccountID: ${account_id}`);
    defer(() => getAccountTradeWithAccountId(account_id))
      .pipe(
        //
        repeat({ delay: 30_000 }),
        retry({ delay: 5000 }),
        timeout(10_000), //  超时设定：10 秒
        catchError((err) => {
          console.error(formatTime(Date.now()), 'getAccountTradeError', err);
          return of([]);
        }),
      )
      .subscribe();
  });
