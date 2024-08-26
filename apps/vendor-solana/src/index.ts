import { Connection, LAMPORTS_PER_SOL, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { IAccountInfo, IAccountMoney, UUID, formatTime } from '@yuants/data-model';
import { Terminal, provideAccountInfo } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import { defer, map, repeat, retry, shareReplay } from 'rxjs';
// import { IGMGN } from './type';

const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

const solanaAddress = process.env.PUBLIC_KEY?.split(',') || [];
const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `solana/${UUID()}`,
  name: 'SOLANA',
});

// const getSolanaBalance = async (address: string): Promise<IGMGN> => {
//   const ret = await fetch(
//     `https://gmgn.ai/defi/quotation/v1/wallet/sol/holdings/${address}?orderby=last_active_timestamp&direction=desc&showsmall=true&sellout=false&limit=50`,
//   );
//   return ret.json();
// };

// const sanitizeString = (input: string) => {
//   const regex = /[^a-zA-Z0-9_]/g;
//   return input.replace(regex, '_');
// };

// solanaAddress.forEach((address) => {
//   const solanaAllTokenBalance$ = defer(() => getSolanaBalance(address))
//     .pipe(repeat({ delay: 1000 * 15 }), retry({ delay: 1000 * 10 }), shareReplay(1))
//     .pipe(
//       map((ret) => ret.data),
//       map((balance): IAccountInfo => {
//         const equity = balance.holdings.reduce((acc, item) => acc + item.usd_value, 0);
//         const profit = balance.holdings.reduce((acc, item) => acc + item.unrealized_profit, 0);
//         const free = +(
//           balance.holdings.find((item) => item.address === 'So11111111111111111111111111111111111111111')
//             ?.usd_value || 0
//         );

//         const money: IAccountMoney = {
//           currency: 'USDT',
//           equity: equity,
//           balance: equity - profit,
//           profit: profit,
//           free: free,
//           used: equity - free,
//         };

//         return {
//           updated_at: Date.now(),
//           account_id: `SOL/${address}`,
//           money: money,
//           currencies: [money],
//           positions: balance.holdings
//             .filter((item) => +item.balance >= 1)
//             .map((item) => {
//               return {
//                 position_id: item.address,
//                 // ISSUE: once a time, the name of the token is `FUCK U:\`, therefore the prometheus saw this: `metrics{label_name="FUCK U:\"}`
//                 //   where \" is recognized as a escaped char by the parser of prometheus, and you'll know.
//                 product_id: encodePath(item.token_address, sanitizeString(item.symbol)),
//                 direction: 'LONG',
//                 volume: +item.balance,
//                 free_volume: +item.balance,
//                 position_price: item.avg_cost,
//                 closable_price: item.price,
//                 floating_profit: item.unrealized_profit,
//                 comment: item.symbol,
//                 valuation: item.usd_value,
//               };
//             }),
//           orders: [],
//         };
//       }),
//     );
//   provideAccountInfo(terminal, solanaAllTokenBalance$);
// });

solanaAddress.forEach((address) => {
  console.info(formatTime(Date.now()), 'INIT', address);
  const publicKey = new PublicKey(address);
  const accountInfo$ = defer(() => connection.getBalance(publicKey)).pipe(
    map((x): IAccountInfo => {
      const money: IAccountMoney = {
        currency: 'SOL',
        equity: x / LAMPORTS_PER_SOL,
        balance: x / LAMPORTS_PER_SOL,
        profit: 0,
        free: x / LAMPORTS_PER_SOL,
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
    repeat({ delay: 1000 }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );
  provideAccountInfo(terminal, accountInfo$);
});
