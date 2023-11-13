import { Typography } from '@douyinfe/semi-ui';
import React from 'react';
import { executeCommand } from '../CommandCenter';

export const InlineAccountId = React.memo((props: { account_id: string }) => {
  return (
    <Typography.Text
      copyable
      link={{
        onClick: () => {
          executeCommand('AccountInfoPanel', { account_id: props.account_id });
        },
      }}
    >
      {props.account_id}
    </Typography.Text>
  );
});
