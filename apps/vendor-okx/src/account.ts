import { addAccountMarket, provideAccountInfoService } from '@yuants/data-account';
import { providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { defer } from 'rxjs';
import {
  getEarningAccountInfo,
  getFundingAccountInfo,
  getLoanAccountInfo,
  getTradingAccountInfo,
  marketIndexTickerUSDT$,
} from './accountInfos';
import {
  getEarningAccountId,
  getFundingAccountId,
  getLoanAccountId,
  getTradingAccountId,
} from './accountInfos/uid';
import { getDefaultCredential } from './api/private-api';
import { listOrders } from './orders/listOrders';

const terminal = Terminal.fromNodeEnv();

const credential = getDefaultCredential();

defer(async () => {
  const account_id = await getTradingAccountId(credential);
  providePendingOrdersService(terminal, account_id, async () => listOrders(credential, account_id), {
    auto_refresh_interval: 5000,
  });
}).subscribe();

defer(async () => {
  const tradingAccountId = await getTradingAccountId(credential);
  addAccountMarket(terminal, { account_id: tradingAccountId, market_id: 'OKX' });

  provideAccountInfoService(
    terminal,
    tradingAccountId,
    () => getTradingAccountInfo(credential, tradingAccountId),
    {
      auto_refresh_interval: 1000,
    },
  );
}).subscribe();

defer(async () => {
  const fundingAccountId = await getFundingAccountId(credential);

  provideAccountInfoService(
    terminal,
    fundingAccountId,
    () => getFundingAccountInfo(credential, fundingAccountId),
    {
      auto_refresh_interval: 1000,
    },
  );
}).subscribe();

defer(async () => {
  const earningAccountId = await getEarningAccountId(credential);
  provideAccountInfoService(
    terminal,
    earningAccountId,
    () => getEarningAccountInfo(credential, earningAccountId),
    {
      auto_refresh_interval: 5000,
    },
  );
}).subscribe();

defer(async () => {
  const loanAccountId = await getLoanAccountId(credential);
  provideAccountInfoService(
    Terminal.fromNodeEnv(),
    loanAccountId,
    () => getLoanAccountInfo(credential, loanAccountId),
    {
      auto_refresh_interval: 1000,
    },
  );
}).subscribe();

// 导出 marketIndexTickerUSDT$ 供其他模块使用
export { marketIndexTickerUSDT$ };
