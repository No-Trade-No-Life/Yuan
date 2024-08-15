import { IAccountInfo, IAccountMoney, UUID, encodePath } from '@yuants/data-model';
import { Terminal, provideAccountInfo } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import { defer, map, repeat, retry, shareReplay } from 'rxjs';
import { IGMGN } from './type';

const solanaAddress = process.env.PUBLIC_KEY?.split(',') || [];
const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `solana/${UUID()}`,
  name: 'SOLANA',
});

const getSolanaBalance = async (address: string): Promise<IGMGN> => {
  const ret = await fetch(
    `https://gmgn.ai/defi/quotation/v1/wallet/sol/holdings/${address}?orderby=last_active_timestamp&direction=desc&showsmall=true&sellout=false&limit=50`,
  );
  return ret.json();
};

const sanitizeString = (input: string) => {
  const regex = /[^a-zA-Z0-9_]/g;
  return input.replace(regex, '_');
};

solanaAddress.forEach((address) => {
  const solanaAllTokenBalance$ = defer(() => getSolanaBalance(address))
    .pipe(repeat({ delay: 1000 * 15 }), retry({ delay: 1000 * 10 }), shareReplay(1))
    .pipe(
      map((ret) => ret.data),
      map((balance): IAccountInfo => {
        const equity = balance.holdings.reduce((acc, item) => acc + item.usd_value, 0);
        const profit = balance.holdings.reduce((acc, item) => acc + item.unrealized_profit, 0);
        const free = +(
          balance.holdings.find((item) => item.address === 'So11111111111111111111111111111111111111111')
            ?.usd_value || 0
        );

        const money: IAccountMoney = {
          currency: 'USDT',
          equity: equity,
          balance: equity - profit,
          profit: profit,
          free: free,
          used: equity - free,
        };

        return {
          updated_at: Date.now(),
          account_id: `SOL/${address}`,
          money: money,
          currencies: [money],
          positions: balance.holdings
            .filter((item) => +item.balance >= 1)
            .map((item) => {
              return {
                position_id: item.address,
                product_id: encodePath(item.token_address, sanitizeString(item.symbol)),
                direction: 'LONG',
                volume: +item.balance,
                free_volume: +item.balance,
                position_price: item.avg_cost,
                closable_price: item.price,
                floating_profit: item.unrealized_profit,
                comment: item.symbol,
                valuation: item.usd_value,
              };
            }),
          orders: [],
        };
      }),
    );
  provideAccountInfo(terminal, solanaAllTokenBalance$);
});
