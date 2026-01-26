import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { provideTradeHistoryService } from '@yuants/exchange';
import { getFutureAccountsTrades } from '../api/private-api';
import { ITradeHistory } from '@yuants/data-trade';
import { createClientProductCache } from '@yuants/data-product';
interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();
const productsCache = createClientProductCache(terminal, { expire: 7200_000 });

const WINDOW_MS = 2 * 24 * 3600_000;
const fetchTradeHistoryBackward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  trade_type: string;
}): Promise<ITradeHistory[]> => {
  if (req.trade_type === 'USDT_SWAP') {
    const time = Math.max(req.time, Date.now() - 3600_000 * 24 * 365);
    const params = {
      settle: 'usdt',
      to: ~~(time / 1000) + 10,
      from: ~~((time - WINDOW_MS) / 1000),
      limit: 500,
    };
    const res = await getFutureAccountsTrades(req.credential.payload, params);
    if (!Array.isArray(res)) {
      throw new Error('getAccountIncome failed');
    }
    return (
      await Promise.all(
        (res ?? []).map(async (v): Promise<ITradeHistory | undefined> => {
          const product_id = encodePath('GATE', 'FUTURE', v.contract);
          const product = await productsCache.query(product_id);
          if (!product) return;
          const ms = Number(v.create_time) * 1000;
          let direction = 'OPEN_LONG';
          const numberSize = +v.size;
          const numberCloseSize = +v.close_size;
          if (numberCloseSize === 0) {
            if (numberSize > 0) {
              direction = 'OPEN_LONG';
            } else {
              direction = 'OPEN_SHORT';
            }
          }
          if (numberCloseSize > 0 && numberSize > 0) {
            direction = 'CLOSE_SHORT';
          }
          if (numberCloseSize < 0 && numberSize < 0) {
            direction = 'CLOSE_LONG';
          }

          return {
            id: v.trade_id,
            product_id,
            size: Math.abs(numberSize * (product.value_scale ?? 1)).toString(),
            account_id: req.account_id,
            direction,
            price: v.price,
            fee: v.fee,
            fee_currency: 'USDT',
            created_at: formatTime(ms),
            origin: v as any,
          } as ITradeHistory;
        }),
      )
    ).filter(
      (x): x is Exclude<typeof x, undefined> =>
        !!x && Date.parse(x.created_at!) <= ~~(time / 1000 + 10) * 1000,
    );
  }
  return [];
};

provideTradeHistoryService(
  terminal,
  {
    direction: 'backward',
    type: 'GATE',
    trade_type: ['USDT_SWAP'],
  },
  fetchTradeHistoryBackward,
);
