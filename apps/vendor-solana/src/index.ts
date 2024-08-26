import { IAccountInfo, IAccountMoney, UUID, formatTime } from '@yuants/data-model';
import { Terminal, provideAccountInfo } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import { defer, map, repeat, retry, shareReplay } from 'rxjs';

const solanaAddress = process.env.PUBLIC_KEY?.split(',') || [];
const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `solana/${UUID()}`,
  name: 'SOLANA',
});

const getAccountInfo = async (
  address: string,
): Promise<{
  jsonrpc: string;
  result: {
    context: {
      apiVersion: string;
      slot: number;
    };
    value: {
      data: string[];
      executable: boolean;
      lamports: number;
      owner: string;
      rentEpoch: number;
      space: number;
    };
  };
  id: number;
}> =>
  fetch('https://api.mainnet-beta.solana.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [
        address,
        {
          encoding: 'base58',
        },
      ],
    }),
  }).then((res) => res.json());

solanaAddress.forEach((address) => {
  console.info(formatTime(Date.now()), 'INIT', address);
  const accountInfo$ = defer(() => getAccountInfo(address)).pipe(
    map((info): IAccountInfo => {
      console.info(formatTime(Date.now()), 'INFO', info);
      const x = info.result.value.lamports;
      const sol = x / 1e9;
      const money: IAccountMoney = {
        currency: 'SOL',
        equity: sol,
        balance: sol,
        profit: 0,
        free: sol,
        used: 0,
      };
      return {
        updated_at: Date.now(),
        account_id: `SOLANA/${address}`,
        money: money,
        currencies: [money],
        positions: [],
        orders: [],
      };
    }),
    repeat({ delay: 1000 * 10 }),
    retry({ delay: 1000 * 10 }),
    shareReplay(1),
  );
  provideAccountInfo(terminal, accountInfo$);
});
