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

const WINDOW_MS = 10 * 24 * 3600_000;

const fetchInterestRateLedgerBackward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  const params = {
    settle: 'usdt',
    to: ~~(req.time / 1000),
    from: ~~((req.time - WINDOW_MS) / 1000),
    limit: 100,
    type: req.ledger_type,
  };
  const res = await getFutureAccountsBook(req.credential.payload, params);
  return (res ?? [])
    .map((v): IInterestLedger => {
      const ms = Number(v.time * 1000);
      return {
        id: v.id,
        product_id: encodePath('OKX', 'FUTURE', v.contract),
        amount: v.change,
        account_id: req.account_id,
        currency: 'USDT',
        created_at: formatTime(ms),
      } as IInterestLedger;
    })
    .filter((x) => Date.parse(x.created_at!) <= req.time);
};

provideInterestLedgerService(
  terminal,
  {
    direction: 'backward',
    type: 'GATE',
  },
  fetchInterestRateLedgerBackward,
);
