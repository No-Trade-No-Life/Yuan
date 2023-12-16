import { IconTestScoreStroked } from '@douyinfe/semi-icons';
import { Card, Space, Table, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { IBatchAgentResultItem } from '../../Agent/utils';
import { IMessageCardProps } from '../model';

// TODO: hackathon code, refine later
export default ({
  payload,
}: IMessageCardProps<{
  results: IBatchAgentResultItem[];
}>) => {
  const { t } = useTranslation(['Copilot', 'AccountPerformancePanel']);

  return (
    <Card
      title={
        <Space>
          <IconTestScoreStroked />
          <Typography.Text strong>{t('Copilot:SystemBatchBacktestResult:title')}</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
    >
      <Space vertical align="start" style={{ width: '100%', flexWrap: 'wrap' }}>
        <Typography.Title heading={3}>批量回测结果</Typography.Title>
        <Typography.Text>
          我们针对 Copilot 的参数备选项进行了全量的批量回测，并按照收益率倒序排列
        </Typography.Text>
        <Table
          dataSource={payload.results}
          rowKey={(e) => e?.accountInfo.account_id ?? ''}
          // }}
          scroll={{ y: 300 }}
          columns={[
            {
              title: '净值曲线缩略图',
              width: 200,
              render: (_, x) => (
                <img style={{ margin: -16, height: 80, width: '100%' }} src={x.equityImageSrc}></img>
              ),
            },
            {
              title: '账户',
              render: (_, x) => x.accountInfo.account_id,
            },
            {
              title: '回溯历史',
              dataIndex: 'duration_of_trades_in_day',
              // ISSUE: NaN 转 JSON 会变成 null，再转回来调用 toFixed 会报错，所以这里需要先转成数字
              render: (_, x) => (+x.performance.total_days).toFixed(1) + '天',
            },
            {
              title: '周收益率',
              dataIndex: 'weekly_return_ratio',
              render: (_, x) => `${(+x.performance.weekly_return_ratio * 100).toFixed(2)}%`,
            },
            {
              title: '最大维持保证金',
              dataIndex: 'max_margin',
              render: (_, x) => (+x.performance.max_maintenance_margin).toFixed(2),
            },

            {
              title: '收益回撤比',
              dataIndex: 'net_profit_max_drawdown_profit_ratio',
              render: (_, x) => (+x.performance.profit_drawdown_ratio).toFixed(5),
            },
            {
              title: '资本回报期',
              dataIndex: 'pp',
              render: (_, x) => `${(+x.performance.payback_period_in_days).toFixed(1)}天`,
            },
            {
              title: '周夏普比率',
              dataIndex: 'weekly_sharpe_ratio',
              render: (_, x) =>
                (+x.performance.weekly_sharpe_ratio).toLocaleString(undefined, {
                  style: 'percent',
                  minimumFractionDigits: 2,
                }),
            },
            {
              title: '资金占用率',
              dataIndex: 'capital_occupancy_rate',
              render: (_, x) =>
                (+x.performance.capital_occupancy_rate).toLocaleString(undefined, {
                  style: 'percent',
                  minimumFractionDigits: 2,
                }),
            },
            {
              title: '净值',
              dataIndex: 'equity',
              render: (_, x) => (+x.performance.equity).toFixed(2),
            },
            {
              title: '持仓次数',
              dataIndex: 'total_positions',
              render: (_, x) => +x.performance.total_positions,
            },
          ]}
        ></Table>
      </Space>
    </Card>
  );
};
