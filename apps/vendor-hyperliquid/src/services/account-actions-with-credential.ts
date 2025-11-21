import { provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { ICredential, getAddressFromCredential } from '../api/types';

import { getPerpAccountInfo } from './accounts/perp';
import { getSpotAccountInfo } from './accounts/spot';

provideAccountActionsWithCredential<ICredential>(
  Terminal.fromNodeEnv(),
  'HYPERLIQUID',
  {
    type: 'object',
    required: ['private_key'],
    properties: {
      private_key: { type: 'string' },
    },
  },
  {
    listAccounts: async (credential) => {
      console.info(
        `[${formatTime(Date.now())}] Listing accounts for ${getAddressFromCredential(credential)}`,
      );
      return [
        {
          account_id: `hyperliquid/${getAddressFromCredential(credential)}/perp`,
        },
        {
          account_id: `hyperliquid/${getAddressFromCredential(credential)}/spot`,
        },
      ];
    },
    getAccountInfo: async (credential, account_id) => {
      console.info(`[${formatTime(Date.now())}] Getting account info for ${account_id}`);

      if (account_id.endsWith('/perp')) {
        return getPerpAccountInfo(credential, account_id);
      }
      if (account_id.endsWith('/spot')) {
        return getSpotAccountInfo(credential, account_id);
      }
      throw new Error(`Unsupported account type for account_id: ${account_id}`);
    },
  },
);
