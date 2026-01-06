import { IInterestLedger } from '@yuants/data-interest-rate';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { provideInterestLedgerService } from '@yuants/exchange';
import { getAccountFinancialRecordExact } from '../api/private-api';

interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

const WINDOW_MS = 2 * 24 * 3600_000;

const fetchInterestRateLedgerBackward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  const params = {
    end_time: req.time,
    start_time: req.time - WINDOW_MS,
    type: req.ledger_type,
    direct: 'prev',
    mar_acct: 'USDT',
  };
  const res = await getAccountFinancialRecordExact(req.credential.payload, params);
  return (res.data ?? [])
    .map((v): IInterestLedger => {
      const ms = v.ts;
      return {
        id: v.id.toString(),
        product_id: encodePath('HTX', 'SWAP', v.contract_code),
        amount: v.amount.toString(),
        account_id: req.account_id,
        currency: v.asset,
        created_at: formatTime(ms),
      } as IInterestLedger;
    })
    .filter((x) => Date.parse(x.created_at!) <= req.time);
};

const fetchInterestRateLedgerForward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  const params = {
    end_time: req.time,
    start_time: req.time - WINDOW_MS,
    type: req.ledger_type,
    direct: 'next',
    mar_acct: 'USDT',
  };
  const res = await getAccountFinancialRecordExact(req.credential.payload, params);

  return (res.data ?? [])
    .map((v): IInterestLedger => {
      const ms = v.ts;
      return {
        id: v.id.toString(),
        product_id: encodePath('HTX', 'SWAP', v.contract_code),
        amount: v.amount.toString(),
        account_id: req.account_id,
        currency: v.asset,
        created_at: formatTime(ms),
      } as IInterestLedger;
    })
    .filter((x) => Date.parse(x.created_at!) >= params.start_time);
};

provideInterestLedgerService(
  terminal,
  {
    direction: 'backward',
    type: 'HTX',
  },
  fetchInterestRateLedgerBackward,
);

provideInterestLedgerService(
  terminal,
  {
    direction: 'forward',
    type: 'HTX',
  },
  fetchInterestRateLedgerForward,
);
