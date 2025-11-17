import { provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { type ICredential } from '../api/private-api';
import { getFuturesAccountInfo } from './accounts/futures';
import { getSpotAccountInfo } from './accounts/spot';
import { resolveAccountProfile } from './accounts/profile';

const terminal = Terminal.fromNodeEnv();

const listAccounts = async (credential: ICredential) => {
  const profile = await resolveAccountProfile(credential);
  return [
    { account_id: `bitget/${profile.uid}/futures/USDT` },
    { account_id: `bitget/${profile.uid}/spot/USDT` },
  ];
};

const getAccountInfo = async (credential: ICredential, accountId: string) => {
  if (accountId.endsWith('/futures/USDT')) {
    return getFuturesAccountInfo(credential, accountId);
  }
  if (accountId.endsWith('/spot/USDT')) {
    return getSpotAccountInfo(credential, accountId);
  }
  throw new Error(`Unsupported account_id: ${accountId}`);
};

provideAccountActionsWithCredential<ICredential>(
  terminal,
  'BITGET',
  {
    type: 'object',
    required: ['access_key', 'secret_key', 'passphrase'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
      passphrase: { type: 'string' },
    },
  },
  {
    listAccounts,
    getAccountInfo,
  },
);
