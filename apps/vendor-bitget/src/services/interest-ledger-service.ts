import { IInterestLedger } from '@yuants/data-interest-rate';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { provideInterestLedgerService } from '@yuants/exchange';
import { getAccountFinancialRecords } from '../api/private-api';

interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

const WINDOW_MS = 20 * 24 * 3600_000;

const fetchInterestRateLedgerBackward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  const params = {
    category: 'USDT-FUTURES',
    endTime: req.time.toString(),
    startTime: (req.time - WINDOW_MS).toString(),
    type: req.ledger_type,
  };
  const res = await getAccountFinancialRecords(req.credential.payload, params);
  return (res.data.list ?? [])
    .map((v): IInterestLedger => {
      const ms = Number(v.ts);
      return {
        id: v.id,
        product_id: encodePath('BITGET', 'USDT-FUTURES', v.symbol),
        amount: v.amount,
        account_id: req.account_id,
        currency: v.coin,
        created_at: formatTime(ms),
      } as IInterestLedger;
    })
    .filter((x) => Date.parse(x.created_at!) <= req.time);
};

provideInterestLedgerService(
  terminal,
  {
    direction: 'backward',
    type: 'BITGET',
  },
  fetchInterestRateLedgerBackward,
);
