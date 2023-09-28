import { Button, Descriptions, List, Space, Spin, Typography } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/kernel';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import { useAccountInfo } from '../../common/source';
import { layoutModel$ } from '../../layout-model';
import { executeCommand } from '../CommandCenter/CommandCenter';

export const AccountInfoItem = React.memo((props: { account_id: string }) => {
  const accountInfo = useObservableState(useAccountInfo(props.account_id));
  const model = useObservableState(layoutModel$);
  const timeLag = Date.now() - (accountInfo?.timestamp_in_us ?? NaN) / 1000;
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
                信息更新于 {formatTime(accountInfo.timestamp_in_us / 1000)}，已经{' '}
                {(timeLag / 1000).toFixed(0)} 秒未更新，可能已经失去响应
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
