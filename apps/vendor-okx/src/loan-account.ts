import { IAccountInfo, IPosition, publishAccountInfo } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { defer, filter, firstValueFrom, map, repeat, retry } from 'rxjs';
import { accountUid$ } from './account';
import { client } from './api';

defer(async () => {
  const uid = await firstValueFrom(accountUid$);
  const loanAccountId = `okx/${uid}/loan/USDT`;

  publishAccountInfo(
    Terminal.fromNodeEnv(),
    loanAccountId,
    defer(() => client.getFlexibleLoanInfo())
      .pipe(
        filter((x) => x.data && x.data.length > 0),
        map((x) => x.data[0]),
        retry({ delay: 1_000 }),
        repeat({ delay: 1_000 }),
      )
      .pipe(
        map((x): IAccountInfo => {
          const positions: IPosition[] = [];
          for (const loan of x.loanData) {
            positions.push({
              datasource_id: 'OKX',
              product_id: `SPOT/${loan.ccy}-USDT`,
              volume: +loan.amt,
              free_volume: +loan.amt,
              position_id: encodePath('loan', loan.ccy),
              direction: 'SHORT',
              position_price: 0,
              closable_price: 0,
              floating_profit: 0,
              valuation: 0,
            });
          }
          for (const collateral of x.collateralData) {
            positions.push({
              datasource_id: 'OKX',
              product_id: `SPOT/${collateral.ccy}-USDT`,
              volume: +collateral.amt,
              free_volume: +collateral.amt,
              position_id: encodePath('collateral', collateral.ccy),
              direction: 'LONG',
              position_price: 0,
              closable_price: 0,
              floating_profit: 0,
              valuation: 0,
            });
          }
          const equity = +x.collateralNotionalUsd - +x.loanNotionalUsd;
          const balance = +x.collateralNotionalUsd;
          const profit = equity - balance;
          const used = balance;
          const free = equity - used;
          return {
            account_id: `okx/${uid}/loan/USDT`,
            updated_at: Date.now(),
            money: {
              currency: 'USDT',
              equity,
              balance,
              used,
              free,
              profit,
            },
            positions,
          };
        }),
      ),
  );
}).subscribe();
