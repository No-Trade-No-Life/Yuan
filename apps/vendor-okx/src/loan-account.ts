import { provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { defer, firstValueFrom } from 'rxjs';
import { accountUid$ } from './account';
import { getDefaultCredential } from './api';
import { getLoanAccountInfo } from './accountInfos';

defer(async () => {
  const uid = await firstValueFrom(accountUid$);
  const loanAccountId = `okx/${uid}/loan/USDT`;
  const credential = getDefaultCredential();

  provideAccountInfoService(Terminal.fromNodeEnv(), loanAccountId, () => getLoanAccountInfo(credential), {
    auto_refresh_interval: 1000,
  });
}).subscribe();
