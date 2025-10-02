import { IAccountInfo } from '@yuants/data-account';
import { Description } from '../Interactive';
import { Space } from '@douyinfe/semi-ui';

interface Props {
  accountInfo?: IAccountInfo;
}

export const AccountProfit = (props: Props) => {
  const { accountInfo } = props;
  if (!accountInfo) return null;

  const valuation = accountInfo.positions.reduce((acc, cur) => acc + (cur.valuation || 0), 0) ?? 0;
  const actual_leverage =
    (accountInfo?.money.equity ?? 0) > 0 ? valuation / (accountInfo?.money.equity ?? 0) : NaN;

  const total_interest_to_settle =
    accountInfo?.positions.reduce((acc, cur) => acc + (cur.interest_to_settle || 0), 0) || 0;
  return (
    <Space vertical align="start" style={{ width: '100%', padding: '14px 12px', boxSizing: 'border-box' }}>
      <Description
        minColumnWidth={100}
        data={[
          {
            key: '净值',
            value: accountInfo.money.equity.toFixed(2) + ' ' + accountInfo.money.currency,
          },
          {
            key: '余额',
            value: accountInfo.money.balance.toFixed(2) + ' ' + accountInfo.money.currency,
          },
          {
            key: '浮动盈亏',
            value:
              accountInfo.positions.reduce((acc, cur) => acc + cur.floating_profit, 0).toFixed(2) +
              ' ' +
              accountInfo.money.currency,
          },
          {
            key: '浮动收益率',
            value: `${((accountInfo.money.profit / accountInfo.money.balance) * 100).toFixed(2)}%`,
          },
          {
            key: '已用保证金',
            value: accountInfo.money.used.toFixed(2) + ' ' + accountInfo.money.currency,
          },
          {
            key: '可用保证金',
            value: accountInfo.money.free.toFixed(2) + ' ' + accountInfo.money.currency,
          },
          {
            key: '保证金使用率',
            value: `${((accountInfo.money.used / accountInfo.money.equity) * 100).toFixed(2)}%`,
          },
          {
            key: '头寸总估值',
            value: valuation.toFixed(2) + ' ' + accountInfo.money.currency,
          },
          {
            key: '实际杠杆',
            value: actual_leverage.toFixed(2) + 'x',
          },
          {
            key: '总预期利息',
            value: total_interest_to_settle.toFixed(2) + ' ' + accountInfo.money.currency,
          },
        ]}
      />
    </Space>
  );
};
