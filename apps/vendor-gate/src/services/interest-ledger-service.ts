import { IInterestLedger } from '@yuants/data-interest-rate';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { provideInterestLedgerService } from '@yuants/exchange';
import { getFutureAccountsBook } from '../api/private-api';

interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

// const WINDOW_MS = 2 * 24 * 3600_000;
const fetchInterestRateLedgerBackward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  if (req.ledger_type === 'FUNDING_FEE') {
    const time = Math.max(req.time, Date.now() - 3600_000 * 24 * 365);
    const params = {
      settle: 'usdt',
      to: ~~(time / 1000) + 100,
      limit: 500,
      type: 'fund',
    };
    const res = await getFutureAccountsBook(req.credential.payload, params);
    if (!Array.isArray(res)) {
      throw new Error('getAccountIncome failed');
    }
    return (res ?? [])
      .map((v): IInterestLedger => {
        const ms = Number(v.time * 1000);
        return {
          id: v.id,
          product_id: encodePath('GATE', 'FUTURE', v.contract),
          amount: v.change,
          account_id: req.account_id,
          currency: 'USDT',
          created_at: formatTime(ms),
        } as IInterestLedger;
      })
      .filter((x) => Date.parse(x.created_at!) <= ~~(time / 1000) * 1000);
  }
  return [];
};

provideInterestLedgerService(
  terminal,
  {
    direction: 'backward',
    type: 'GATE',
    ledger_type: ['FUNDING_FEE'],
  },
  fetchInterestRateLedgerBackward,
);
