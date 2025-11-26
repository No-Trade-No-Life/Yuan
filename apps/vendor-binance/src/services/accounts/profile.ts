import { encodePath } from '@yuants/utils';
import { isApiError } from '../../api/client';
import { getSpotAccountInfo, ICredential } from '../../api/private-api';

export const getCredentialId = async (credential: ICredential): Promise<string> => {
  const spotAccountInfo = await getSpotAccountInfo(credential);
  if (isApiError(spotAccountInfo)) {
    throw new Error(spotAccountInfo.msg);
  }
  return encodePath('BINANCE', spotAccountInfo.uid);
};
