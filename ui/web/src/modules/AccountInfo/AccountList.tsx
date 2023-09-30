import { List } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import { registerCommand } from '../CommandCenter';
import { openPage } from '../Pages';
import { AccountInfoItem } from './AccountInfoItem';
import { accountIds$ } from './model';

export const AccountList = React.memo(() => {
  const accountIds = useObservableState(accountIds$, []);

  return (
    <List>
      {accountIds.map((accountId) => (
        <AccountInfoItem key={accountId} account_id={accountId} />
      ))}
    </List>
  );
});

registerCommand('AccountList', () => {
  openPage('AccountList');
});
