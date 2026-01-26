import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { provideTradeHistoryService } from '@yuants/exchange';
import { ITradeHistory } from '@yuants/data-trade';
import { getAccountTradeOrderDetail } from '../api/private-api';
import { createClientProductCache } from '@yuants/data-product';
interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();
const productsCache = createClientProductCache(terminal, { expire: 7200_000 });

const WINDOW_MS = 48 * 3600_000;
const fetchTradeHistoryBackward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  trade_type: string;
}): Promise<ITradeHistory[]> => {
  if (req.trade_type === 'USDT_SWAP') {
    const time = Math.max(req.time, Date.now() - 3600_000 * 88);
    const params = {
      limit: 100,
      end_time: time,
      start_time: time - WINDOW_MS,
      direct: 'next', // 这里和 interest-ledger-service 不一样，prev 和 next 返回的数据都是闪照时间从大到小排列，但是 prev 返回的数据是 靠近start， next 靠近end
    };
    const res = await getAccountTradeOrderDetail(req.credential.payload, params);
    if (res.code !== 200) {
      throw new Error(res.message);
    }
    return (
      await Promise.all(
        (res.data ?? []).map(async (v): Promise<ITradeHistory | undefined> => {
          const ms = Number(v.created_time);
          const product_id = encodePath('HTX', 'SWAP', v.contract_code);
          const product = await productsCache.query(product_id);
          if (!product) return;
          let direction = 'OPEN_LONG';
          if (v.side === 'buy') {
            if (v.position_side === 'close') {
              direction = 'CLOSE_SHORT';
            }
          } else {
            if (v.position_side === 'open' || v.position_side === 'both') {
              direction = 'OPEN_SHORT';
            } else {
              direction = 'CLOSE_LONG';
            }
          }
          return {
            id: v.id,
            product_id,
            size: (+v.trade_volume * (product.value_scale ?? 1)).toString(),
            account_id: req.account_id,
            direction,
            price: v.trade_price.toString(),
            fee: v.trade_fee.toString(),
            fee_currency: v.fee_currency,
            pnl: v.profit.toString(),
            created_at: formatTime(ms),
          } as ITradeHistory;
        }),
      )
    ).filter((x): x is Exclude<typeof x, undefined> => !!x && Date.parse(x.created_at!) <= time);
  }
  return [];
};

const fetchTradeHistoryForward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  trade_type: string;
}): Promise<ITradeHistory[]> => {
  if (req.trade_type === 'USDT_SWAP') {
    const time = Math.max(req.time, Date.now() - 3600_000 * 88);
    const params = {
      limit: 100,
      start_time: time,
      end_time: time + WINDOW_MS,
      direct: 'prev', // 这里和 interest-ledger-service 不一样，prev 和 next 返回的数据都是闪照时间从大到小排列，但是 prev 返回的数据是 靠近start， next 靠近end
    };
    const res = await getAccountTradeOrderDetail(req.credential.payload, params);
    if (res.code !== 200) {
      throw new Error(res.message);
    }
    return (
      await Promise.all(
        (res.data ?? []).map(async (v): Promise<ITradeHistory | undefined> => {
          const product_id = encodePath('HTX', 'SWAP', v.contract_code);
          const product = await productsCache.query(product_id);
          if (!product) return;
          const ms = Number(v.created_time);
          let direction = 'OPEN_LONG';
          if (v.side === 'buy') {
            if (v.position_side === 'close') {
              direction = 'CLOSE_SHORT';
            }
          } else {
            if (v.position_side === 'open' || v.position_side === 'both') {
              direction = 'OPEN_SHORT';
            } else {
              direction = 'CLOSE_LONG';
            }
          }
          return {
            id: v.id,
            product_id,
            size: (+v.trade_volume * (product.value_scale ?? 1)).toString(),
            account_id: req.account_id,
            direction,
            price: v.trade_price.toString(),
            fee: v.trade_fee.toString(),
            fee_currency: v.fee_currency,
            pnl: v.profit.toString(),
            created_at: formatTime(ms),
            origin: v as any,
          } as ITradeHistory;
        }),
      )
    ).filter((x): x is Exclude<typeof x, undefined> => !!x && Date.parse(x.created_at!) >= time);
  }
  return [];
};

provideTradeHistoryService(
  terminal,
  {
    direction: 'backward',
    type: 'HTX',
    trade_type: ['USDT_SWAP'],
  },
  fetchTradeHistoryBackward,
);

provideTradeHistoryService(
  terminal,
  {
    direction: 'forward',
    type: 'HTX',
    trade_type: ['USDT_SWAP'],
  },
  fetchTradeHistoryForward,
);
