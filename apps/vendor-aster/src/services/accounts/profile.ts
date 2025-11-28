import { encodePath } from '@yuants/utils';
import { getFApiV2Balance, ICredential } from '../../api/private-api';

export const getCredentialId = async (credential: ICredential): Promise<string> => {
  const accountBalance = await getFApiV2Balance(credential, {});
  if (!accountBalance?.[0]) {
    throw new Error('No Account Balance');
  }
  return encodePath('ASTER', accountBalance[0].accountAlias);
};
