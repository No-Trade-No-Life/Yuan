import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { provideTradeHistoryService } from '@yuants/exchange';
import { getAccountFinancialRecords, getAccountTradeFills } from '../api/private-api';
import { ITradeHistory } from '@yuants/data-trade';
interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

const WINDOW_MS = 2 * 24 * 3600_000;
const fetchTradeHistoryBackward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  trade_type: string;
}): Promise<ITradeHistory[]> => {
  if (req.trade_type === 'USDT_SWAP') {
    const params = {
      category: 'USDT-FUTURES',
      endTime: req.time.toString(),
      startTime: (req.time - WINDOW_MS).toString(),
    };
    const res = await getAccountTradeFills(req.credential.payload, params);
    return (res.data.list ?? [])
      .map((v): ITradeHistory => {
        const ms = Number(v.createdTime);
        let direction = 'OPEN_LONG';
        if (v.side === 'buy') {
          if (v.tradeSide.toLowerCase().includes('close')) {
            direction = 'CLOSE_SHORT';
          }
        } else {
          if (v.tradeSide.toLowerCase().includes('close')) {
            direction = 'CLOSE_LONG';
          } else {
            direction = 'OPEN_SHORT';
          }
        }
        return {
          id: v.execId,
          product_id: encodePath('BITGET', 'USDT-FUTURES', v.symbol),
          size: v.execQty,
          account_id: req.account_id,
          direction,
          price: v.execPrice,
          fee: v.feeDetail?.[0]?.fee,
          fee_currency: v.feeDetail?.[0]?.feeCoin,
          pnl: v.execPnl,
          created_at: formatTime(ms),
        } as ITradeHistory;
      })
      .filter((x) => Date.parse(x.created_at!) <= req.time);
  }
  return [];
};

provideTradeHistoryService(
  terminal,
  {
    direction: 'backward',
    type: 'BITGET',
    trade_type: ['USDT_SWAP'],
  },
  fetchTradeHistoryBackward,
);
