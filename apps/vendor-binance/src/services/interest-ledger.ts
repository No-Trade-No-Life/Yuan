import { IInterestLedger } from '@yuants/data-interest-rate';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { getAccountIncome, ICredential } from '../api/private-api';
import { provideInterestLedgerService } from '@yuants/exchange';

interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

const WINDOW_MS = 365 * 24 * 3600_000;

const fetchInterestRateLedgerForward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  const startTime = req.time;
  const res = await getAccountIncome(req.credential.payload, {
    startTime,
    endTime: startTime + WINDOW_MS,
    limit: 1000,
    incomeType: req.ledger_type,
  });

  return (res ?? [])
    .map((v): IInterestLedger => {
      const ms = Number(v.time);
      return {
        id: v.tranId,
        product_id: v.symbol,
        amount: v.income,
        account_id: req.account_id,
        currency: 'USDT',
        created_at: formatTime(ms),
      } as IInterestLedger;
    })
    .filter((x) => Date.parse(x.created_at!) >= startTime);
};

provideInterestLedgerService(
  terminal,
  {
    direction: 'forward',
    type: 'BINANCE',
  },
  fetchInterestRateLedgerForward,
);
