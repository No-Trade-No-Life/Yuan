import { formatTime } from '@yuants/utils';
import { ICredential } from '../api/private-api';

let warned = false;

export const getDefaultCredential = (): ICredential | null => {
  const access_key = process.env.ACCESS_KEY;
  const secret_key = process.env.SECRET_KEY;
  if (!access_key || !secret_key) {
    if (!warned) {
      console.warn(
        formatTime(Date.now()),
        'Missing ACCESS_KEY or SECRET_KEY, skip registering Gate default services',
      );
      warned = true;
    }
    return null;
  }
  return { access_key, secret_key };
};
