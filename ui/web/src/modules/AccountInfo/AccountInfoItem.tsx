import { Button, Descriptions, List, Space, Spin, Typography } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/utils';
import { useObservableState } from 'observable-hooks';
import React, { useMemo } from 'react';
import { executeCommand } from '../CommandCenter';
import { useAccountInfo } from './model';

export const AccountInfoItem = React.memo((props: { account_id: string }) => {
  const accountInfo$ = useMemo(() => useAccountInfo(props.account_id), [props.account_id]);
  const accountInfo = useObservableState(accountInfo$);
  const timeLag = Date.now() - (accountInfo?.updated_at ?? NaN);
  return (
    <List.Item>
      <Space vertical align="start">
        <Typography.Title heading={6} copyable>
          {props.account_id}
        </Typography.Title>

        {accountInfo && (
          <>
            <Descriptions
              data={[
                //
                { key: '货币', value: accountInfo.money.currency },
                { key: '净值', value: accountInfo.money.equity },
                { key: '余额', value: accountInfo.money.balance },
                { key: '盈亏', value: accountInfo.money.profit },
              ]}
            ></Descriptions>
            {timeLag > 60_000 && (
              <Typography.Text type="warning">
                信息更新于 {formatTime(accountInfo.updated_at!)}，已经 {(timeLag / 1000).toFixed(0)}{' '}
                秒未更新，可能已经失去响应
              </Typography.Text>
            )}
          </>
        )}
        {!accountInfo && <Spin />}
        <Button
          onClick={() => {
            const account_id = props.account_id;
            executeCommand('AccountInfoPanel', { account_id });
          }}
        >
          详情
        </Button>
      </Space>
    </List.Item>
  );
});
