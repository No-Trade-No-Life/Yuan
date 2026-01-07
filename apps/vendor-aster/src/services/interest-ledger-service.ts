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

const WINDOW_MS = 10 * 24 * 3600_000;

const fetchInterestRateLedgerForward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  const params = {
    startTime: req.time,
    endTime: req.time + WINDOW_MS,
    limit: 10,
    incomeType: req.ledger_type,
    timestamp: Date.now(),
  };
  const res = await getAccountIncome(req.credential.payload, params);
  return (res ?? [])
    .map((v): IInterestLedger => {
      const ms = Number(v.time);
      return {
        id: v.tranId,
        product_id: encodePath('ASTER', 'PERP', v.symbol),
        amount: v.income,
        account_id: req.account_id,
        currency: v.asset,
        created_at: formatTime(ms),
      } as IInterestLedger;
    })
    .filter((x) => Date.parse(x.created_at!) >= req.time);
};

provideInterestLedgerService(
  terminal,
  {
    direction: 'forward',
    type: 'ASTER',
  },
  fetchInterestRateLedgerForward,
);
