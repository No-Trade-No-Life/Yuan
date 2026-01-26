import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { provideTradeHistoryService } from '@yuants/exchange';
import { getAccountBillsArchive } from '../api/private-api';
import { ITradeHistory } from '@yuants/data-trade';
import { createClientProductCache } from '@yuants/data-product';
interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

const productsCache = createClientProductCache(terminal, { expire: 7200_000 });

const WINDOW_MS = 10 * 24 * 3600_000;
const fetchTradeHistoryBackward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  trade_type: string;
}): Promise<ITradeHistory[]> => {
  if (req.trade_type === 'USDT_SWAP') {
    const res = await getAccountBillsArchive(req.credential.payload, {
      type: '2',
      instType: 'SWAP',
      end: req.time.toString(),
      begin: (req.time - WINDOW_MS).toString(),
    });
    return (
      await Promise.all(
        (res.data ?? []).map(async (v): Promise<ITradeHistory | undefined> => {
          const ms = Number(v.ts);
          let direction = 'OPEN_LONG';
          if (v.subType === '1') direction = 'OPEN_LONG';
          if (v.subType === '2') direction = 'CLOSE_LONG';
          if (v.subType === '3') direction = 'OPEN_LONG';
          if (v.subType === '4') direction = 'OPEN_SHORT';
          if (v.subType === '5') direction = 'CLOSE_LONG';
          if (v.subType === '6') direction = 'CLOSE_SHORT';
          const product_id = encodePath('OKX', v.instType, v.instId);
          const product = await productsCache.query(product_id);
          if (!product) return;
          const size = (Number(v.sz) * Number(product.value_scale)).toString();
          return {
            id: v.billId,
            product_id,
            size,
            account_id: req.account_id,
            direction,
            price: v.px,
            fee: v.fee,
            fee_currency: v.ccy,
            pnl: v.pnl,
            created_at: formatTime(ms),
          } as ITradeHistory;
        }),
      )
    ).filter((x): x is Exclude<typeof x, undefined> => !!x && Date.parse(x.created_at!) <= req.time);
  }
  return [];
};

provideTradeHistoryService(
  terminal,
  {
    direction: 'backward',
    type: 'OKX',
    trade_type: ['USDT_SWAP'],
  },
  fetchTradeHistoryBackward,
);
