import { Toast } from '@douyinfe/semi-ui';
import { t } from 'i18next';
import { executeCommand } from '../CommandCenter';
import { authState$ } from '../SupaBase';

export const ensureAuthenticated = async () => {
  const authState = authState$.value;
  if (authState) return;
  Toast.info(t('common:need_login'));
  executeCommand('Login');
  throw new Error('Login required');
};
