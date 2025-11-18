import { provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { getFutureAccountInfo } from './accounts/future';
import { getUnifiedAccountInfo } from './accounts/unified';
import { getSpotAccountInfo } from './accounts/spot';
import { getAccountIds } from './accounts/account-ids';
import { ICredential } from '../api/private-api';

provideAccountActionsWithCredential<ICredential>(
  Terminal.fromNodeEnv(),
  'GATE',
  {
    type: 'object',
    required: ['access_key', 'secret_key'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
    },
  },
  {
    listAccounts: async (credential) => {
      const accountIds = await getAccountIds(credential);
      return [
        { account_id: accountIds.future },
        { account_id: accountIds.unified },
        { account_id: accountIds.spot },
      ];
    },
    getAccountInfo: async (credential, account_id) => {
      const accountIds = await getAccountIds(credential);
      if (account_id === accountIds.future) {
        return getFutureAccountInfo(credential, account_id);
      }
      if (account_id === accountIds.unified) {
        return getUnifiedAccountInfo(credential, account_id);
      }
      if (account_id === accountIds.spot) {
        return getSpotAccountInfo(credential, account_id);
      }
      throw new Error(`Unsupported account_id: ${account_id}`);
    },
  },
);
