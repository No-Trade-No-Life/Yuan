import { provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { defer } from 'rxjs';
import { accountUidCache } from './account';
import { getLoanAccountInfo } from './accountInfos';
import { getDefaultCredential } from './api';

defer(async () => {
  const uid = await accountUidCache.query('');
  const loanAccountId = `okx/${uid}/loan/USDT`;
  const credential = getDefaultCredential();

  provideAccountInfoService(Terminal.fromNodeEnv(), loanAccountId, () => getLoanAccountInfo(credential), {
    auto_refresh_interval: 1000,
  });
}).subscribe();
