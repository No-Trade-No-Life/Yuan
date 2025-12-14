import { encodePath, newError } from '@yuants/utils';
import { getAccountDetail, ICredential } from '../../api/private-api';

export const getCredentialId = async (credential: ICredential): Promise<string> => {
  const res = await getAccountDetail(credential);
  if (!res.user_id) throw newError('GATE_GET_UID_FAILED', { res });
  return encodePath('GATE', res.user_id);
};
