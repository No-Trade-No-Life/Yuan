import { provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { ICredential } from '../api/private-api';
import { getPerpAccountInfo } from './accounts/perp';
import { getSpotAccountInfo } from './accounts/spot';

provideAccountActionsWithCredential<ICredential>(
  Terminal.fromNodeEnv(),
  'ASTER',
  {
    type: 'object',
    required: ['address', 'api_key', 'secret_key'],
    properties: {
      address: { type: 'string' },
      api_key: { type: 'string' },
      secret_key: { type: 'string' },
    },
  },
  {
    listAccounts: async (credential) => {
      return [
        {
          account_id: `ASTER/${credential.address}/PERP`,
        },
        {
          account_id: `ASTER/${credential.address}/SPOT`,
        },
      ];
    },
    getAccountInfo: async (credential, account_id) => {
      if (account_id.endsWith('/PERP')) {
        return getPerpAccountInfo(credential, account_id);
      }
      if (account_id.endsWith('/SPOT')) {
        return getSpotAccountInfo(credential, account_id);
      }
      throw new Error(`Unsupported account type for account_id: ${account_id}`);
    },
  },
);
