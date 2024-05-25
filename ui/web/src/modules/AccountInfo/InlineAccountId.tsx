import { Card, Descriptions, Empty, Popover, Tooltip, Typography } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import { executeCommand } from '../CommandCenter';
import { useAccountInfo } from './model';

const AccountSummaryCard = React.memo((props: { account_id: string }) => {
  const accountInfo = useObservableState(useAccountInfo(props.account_id));
  if (!accountInfo)
    return (
      <Card title={props.account_id} loading={true}>
        <Card.Meta></Card.Meta>
      </Card>
    );
  const valuation = accountInfo.positions.reduce((acc, cur) => acc + cur.valuation, 0);
  const actual_leverage = valuation / accountInfo.money.equity;
  return (
    <Card title={accountInfo.account_id}>
      <Descriptions
        data={[
          { key: '货币', value: accountInfo.money.currency },
          { key: '净值', value: accountInfo.money.equity },
          {
            key: '余额',
            value: accountInfo.money.balance,
          },
          {
            key: '头寸价值',
            value: valuation,
          },
          {
            key: '实际杠杆',
            value: actual_leverage + 'x',
          },
        ]}
      ></Descriptions>
    </Card>
  );
});

export const InlineAccountId = React.memo((props: { account_id: string }) => {
  return (
    <Popover content={<AccountSummaryCard account_id={props.account_id} />}>
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
    </Popover>
  );
});
