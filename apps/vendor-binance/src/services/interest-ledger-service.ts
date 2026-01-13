import { IInterestLedger } from '@yuants/data-interest-rate';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { getAccountIncome } from '../api/private-api';
import { provideInterestLedgerService } from '@yuants/exchange';

interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

const WINDOW_MS = 48 * 3600_000;

const fetchInterestRateLedgerForward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  if (req.ledger_type === 'FUNDING_FEE') {
    const time = Math.max(req.time, Date.now() - 3600_000 * 24 * 88);
    const startTime = time;
    const res = await getAccountIncome(req.credential.payload, {
      startTime,
      endTime: startTime + WINDOW_MS,
      limit: 500,
      incomeType: 'FUNDING_FEE',
    });
    if (!Array.isArray(res)) {
      throw new Error('getAccountIncome failed');
    }
    return (res ?? [])
      .map((v): IInterestLedger => {
        const ms = Number(v.time);
        return {
          id: v.tranId,
          product_id: encodePath('BINANCE', 'USDT-FUTURE', v.symbol),
          amount: v.income,
          account_id: req.account_id,
          currency: v.asset,
          created_at: formatTime(ms),
        } as IInterestLedger;
      })
      .filter((x) => Date.parse(x.created_at!) >= startTime);
  }
  return [];
};

provideInterestLedgerService(
  terminal,
  {
    direction: 'forward',
    type: 'BINANCE',
    ledger_type: ['FUNDING_FEE'],
  },
  fetchInterestRateLedgerForward,
);
