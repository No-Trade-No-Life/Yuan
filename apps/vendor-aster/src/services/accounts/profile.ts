import { encodePath } from '@yuants/utils';
import { ICredential } from '../../api/private-api';

export const getCredentialId = async (credential: ICredential): Promise<string> => {
  return encodePath('ASTER', credential.address);
};
