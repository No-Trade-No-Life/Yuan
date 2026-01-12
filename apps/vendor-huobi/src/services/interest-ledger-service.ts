import { IInterestLedger } from '@yuants/data-interest-rate';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { provideInterestLedgerService } from '@yuants/exchange';
import { getAccountBills, getAccountFinancialRecordExact } from '../api/private-api';

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
  if (req.ledger_type === 'FUNDING_FEE') {
    const params = {
      end_time: req.time,
      start_time: req.time - WINDOW_MS,
      direct: 'prev',
      limit: 100,
    };
    const res = await getAccountBills(req.credential.payload, params);
    return (res.data ?? [])
      .filter((x) => x.type === '30' || x.type === '31')
      .map((v): IInterestLedger => {
        const ms = +v.created_time;
        return {
          id: v.id.toString(),
          product_id: encodePath('HTX', 'SWAP', v.contract_code),
          amount: v.amount.toString(),
          account_id: req.account_id,
          currency: v.currency,
          created_at: formatTime(ms),
        } as IInterestLedger;
      })
      .filter((x) => Date.parse(x.created_at!) <= req.time);
  }
  return [];
};

const fetchInterestRateLedgerForward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  if (req.ledger_type === 'FUNDING_FEE') {
    const params = {
      start_time: req.time,
      end_time: req.time + WINDOW_MS,
      direct: 'prev', //  next 返回数据按照时间从小到大排列，且先返回小的 prev 则相反 从大到小排列，先返回小的
      limit: 100,
    };
    const res = await getAccountBills(req.credential.payload, params);
    return (res.data ?? [])
      .filter((x) => x.type === '30' || x.type === '31')
      .map((v): IInterestLedger => {
        const ms = +v.created_time;
        return {
          id: v.id.toString(),
          product_id: encodePath('HTX', 'SWAP', v.contract_code),
          amount: v.amount.toString(),
          account_id: req.account_id,
          currency: v.currency,
          created_at: formatTime(ms),
        } as IInterestLedger;
      })
      .filter((x) => Date.parse(x.created_at!) >= req.time);
  }
  return [];
};

provideInterestLedgerService(
  terminal,
  {
    direction: 'backward',
    type: 'HTX',
    ledger_type: ['FUNDING_FEE'],
  },
  fetchInterestRateLedgerBackward,
);

provideInterestLedgerService(
  terminal,
  {
    direction: 'forward',
    type: 'HTX',
    ledger_type: ['FUNDING_FEE'],
  },
  fetchInterestRateLedgerForward,
);
