import { List } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import { registerPage } from '../Pages';
import { AccountInfoItem } from './AccountInfoItem';
import { accountIds$ } from './model';

registerPage('AccountList', () => {
  const accountIds = useObservableState(accountIds$, []);

  return (
    <List>
      {accountIds.map((accountId) => (
        <AccountInfoItem key={accountId} account_id={accountId} />
      ))}
    </List>
  );
});
