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

const WINDOW_MS = 48 * 3600_000;
const fetchInterestRateLedgerBackward = async (req: {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}): Promise<IInterestLedger[]> => {
  if (req.ledger_type === 'FUNDING_FEE') {
    const time = Math.max(req.time, Date.now() - 3600_000 * 24 * 88);
    const params = {
      category: 'USDT-FUTURES',
      endTime: time.toString(),
      startTime: (time - WINDOW_MS).toString(),
      type: 'CONTRACT_MAIN_SETTLE_FEE_USER_IN',
    };
    const outParams = {
      category: 'USDT-FUTURES',
      endTime: time.toString(),
      startTime: (time - WINDOW_MS).toString(),
      type: 'CONTRACT_MAIN_SETTLE_FEE_USER_OUT',
    };
    const [res, outRes] = await Promise.all([
      getAccountFinancialRecords(req.credential.payload, params),
      getAccountFinancialRecords(req.credential.payload, outParams),
    ]);
    if (res.code !== '00000' || outRes.code !== '00000') {
      throw new Error(`${res.msg} || ${outRes.msg}`);
    }
    const lastInRecord = res.data.list?.[(res.data.list?.length ?? 0) - 1];
    const lastOutRecord = outRes.data.list?.[(outRes.data.list?.length ?? 0) - 1];
    const minStartTime = Math.min(
      Number(lastInRecord?.ts ?? params.startTime),
      Number(lastOutRecord?.ts ?? params.startTime),
    );
    const filteredInRecord = res.data.list?.filter((v) => Number(v.ts) >= minStartTime);
    const filteredOutRecord = outRes.data.list?.filter((v) => Number(v.ts) >= minStartTime);
    return [...filteredInRecord, ...filteredOutRecord]
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
      .filter((x) => Date.parse(x.created_at!) <= time);
  }
  return [];
};

provideInterestLedgerService(
  terminal,
  {
    direction: 'backward',
    type: 'BITGET',
    ledger_type: ['FUNDING_FEE'],
  },
  fetchInterestRateLedgerBackward,
);
