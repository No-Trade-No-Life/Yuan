import { IActionHandlerOfListAccounts } from '@yuants/data-account';
import { ICredential } from '../api/private-api';
import { getAccountIds } from '../uid';

export const listAccounts: IActionHandlerOfListAccounts<ICredential> = async (credential) => {
  const accounts = await getAccountIds(JSON.stringify(credential));
  if (!accounts) throw new Error('Failed to get Account IDs');

  return [{ account_id: accounts.spot }, { account_id: accounts.superMargin }, { account_id: accounts.swap }];
};
