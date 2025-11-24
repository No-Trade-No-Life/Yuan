import { provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import {
  getEarningAccountInfo,
  getFundingAccountInfo,
  getLoanAccountInfo,
  getStrategyAccountInfo,
  getTradingAccountInfo,
} from './accountInfos';
import { getAccountIds } from './accountInfos/uid';
import { ICredential } from './api/private-api';

provideAccountActionsWithCredential<ICredential>(
  Terminal.fromNodeEnv(),
  'OKX',
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
    listAccounts: async (credential) => {
      const accountIds = await getAccountIds(credential);
      if (!accountIds) throw new Error('Failed to get account IDs');
      return Object.values(accountIds).map((account_id) => ({ account_id }));
    },
    getAccountInfo: async (credential, account_id) => {
      const accountIds = await getAccountIds(credential);
      if (!accountIds) throw new Error('Failed to get account IDs');
      switch (account_id) {
        case accountIds.trading:
          return getTradingAccountInfo(credential, account_id);
        case accountIds.funding:
          return getFundingAccountInfo(credential, account_id);
        case accountIds.earning:
          return getEarningAccountInfo(credential, account_id);
        case accountIds.loan:
          return getLoanAccountInfo(credential, account_id);
        case accountIds.strategy:
          return getStrategyAccountInfo(credential, account_id);
      }
      throw new Error(`Unsupported account_id: ${account_id}`);
    },
  },
);
