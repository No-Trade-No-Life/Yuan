import { provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { ICredential } from '../api/private-api';
import { resolveAccountProfile } from './accounts/profile';
import { getUnifiedAccountInfo } from './accounts/unified';
import { getSpotAccountInfoSnapshot } from './accounts/spot';

const terminal = Terminal.fromNodeEnv();

const listAccounts = async (credential: ICredential) => {
  const profile = await resolveAccountProfile(credential);
  return [
    { account_id: `binance/${profile.uid}/unified/usdt` },
    { account_id: `binance/${profile.uid}/spot/usdt` },
  ];
};

const getAccountInfo = async (credential: ICredential, accountId: string) => {
  if (accountId.includes('/unified/')) {
    return getUnifiedAccountInfo(credential, accountId);
  }
  if (accountId.includes('/spot/')) {
    return getSpotAccountInfoSnapshot(credential, accountId);
  }
  throw new Error(`Unsupported account_id: ${accountId}`);
};

provideAccountActionsWithCredential<ICredential>(
  terminal,
  'BINANCE',
  {
    type: 'object',
    required: ['access_key', 'secret_key'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
    },
  },
  {
    listAccounts,
    getAccountInfo,
  },
);
