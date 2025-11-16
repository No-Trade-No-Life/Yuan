import { provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { listAccounts } from './accounts/list';
import { getSpotAccountInfo } from './accounts/spot';
import { getSuperMarginAccountInfo } from './accounts/super-margin';
import { getSwapAccountInfo } from './accounts/swap';
import { getAccountIds } from './uid';

provideAccountActionsWithCredential(
  Terminal.fromNodeEnv(),
  'HTX',
  {
    type: 'object',
    required: ['access_key', 'secret_key'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
    },
  },
  {
    listAccounts: listAccounts,
    getAccountInfo: async (credential, account_id) => {
      const accounts = await getAccountIds(JSON.stringify(credential));
      switch (account_id) {
        case accounts.spot:
          return getSpotAccountInfo(credential, account_id);
        case accounts.superMargin:
          return getSuperMarginAccountInfo(credential, account_id);
        case accounts.swap:
          return getSwapAccountInfo(credential, account_id);
      }
      throw new Error(`Unsupported account_id: ${account_id}`);
    },
  },
);
