import { IInterestLedger } from '@yuants/data-interest-rate';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { provideInterestLedgerService } from '@yuants/exchange';
import { getAccountBillsArchive } from '../api/private-api';

interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

const WINDOW_MS = 365 * 24 * 3600_000;

const fetchInterestRateLedgerBackward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  if (req.ledger_type === 'FUNDING_FEE') {
    const params: Record<string, string | number> = {};
    params.end = req.time.toString();
    params.begin = (req.time - WINDOW_MS).toString();
    params.limit = 100;
    params.type = '8';
    const res = await getAccountBillsArchive(req.credential.payload, params);
    return (res.data ?? [])
      .map((v): IInterestLedger => {
        const ms = Number(v.ts);
        return {
          id: v.billId,
          product_id: encodePath('OKX', v.instType, v.instId),
          amount: v.balChg,
          account_id: req.account_id,
          currency: v.ccy,
          created_at: formatTime(ms),
        } as IInterestLedger;
      })
      .filter((x) => Date.parse(x.created_at!) <= req.time);
  }
  return [];
};

provideInterestLedgerService(
  terminal,
  {
    direction: 'backward',
    type: 'OKX',
    ledger_type: ['FUNDING_FEE'],
  },
  fetchInterestRateLedgerBackward,
);
