import { provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { getAccountDetail, ICredential } from '../api/private-api';
import { getEarningAccountInfo } from './accounts/earning';

/**
 * 获取凭证的唯一 ID（基于用户 ID）
 */
const getCredentialId = async (credential: ICredential): Promise<string> => {
  const res = await getAccountDetail(credential);
  if (!res.user_id) throw new Error(`Failed to get user_id: ${JSON.stringify(res)}`);
  return encodePath('GATE', res.user_id);
};

/**
 * 获取理财账户 ID
 */
const getEarningAccountId = async (credential: ICredential): Promise<string> => {
  const credentialId = await getCredentialId(credential);
  return `${credentialId}/EARNING`;
};

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
      const earningAccountId = await getEarningAccountId(credential);
      return [{ account_id: earningAccountId }];
    },
    getAccountInfo: async (credential, account_id) => {
      const earningAccountId = await getEarningAccountId(credential);
      if (account_id === earningAccountId) {
        return getEarningAccountInfo(credential, account_id);
      }
      throw new Error(`Unsupported account_id: ${account_id}`);
    },
  },
);
