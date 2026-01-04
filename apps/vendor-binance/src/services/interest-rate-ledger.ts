import { IInterestRateLedger } from '@yuants/data-interest-rate';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { getAccountIncome, ICredential } from '../api/private-api';
import { provideInterestRateLedgerService } from '@yuants/exchange';

const terminal = Terminal.fromNodeEnv();

const WINDOW_MS = 365 * 24 * 3600_000;

const fetchInterestRateLedgerForward = async (req: {
  credential: ICredential;
  account_id: string;
  time: number;
}): Promise<IInterestRateLedger[]> => {
  const startTime = req.time;
  const res = await getAccountIncome(req.credential, {
    startTime,
    endTime: startTime + WINDOW_MS,
    limit: 1000,
    incomeType: 'FUNDING_FEE',
  });

  return (res ?? [])
    .map((v): IInterestRateLedger => {
      const ms = Number(v.time);
      return {
        id: v.tranId,
        product_id: v.symbol,
        amount: v.income,
        account_id: req.account_id,
        currency: 'USDT',
        created_at: formatTime(ms),
      } as IInterestRateLedger;
    })
    .filter((x) => Date.parse(x.created_at!) >= startTime);
};

provideInterestRateLedgerService(
  terminal,
  {
    direction: 'forward',
  },
  fetchInterestRateLedgerForward,
);
