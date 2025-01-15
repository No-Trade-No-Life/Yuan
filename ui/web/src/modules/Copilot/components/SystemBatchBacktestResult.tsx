import { IconTestScoreStroked } from '@douyinfe/semi-icons';
import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { IBatchAgentResultItem } from '../../Agent/utils';
import { DataView } from '../../Interactive';
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
        <DataView
          data={payload.results}
          columns={[
            {
              header: '净值曲线缩略图',
              accessorKey: 'equityImageSrc',
              cell: (ctx) => (
                <img style={{ margin: -16, height: 80, width: '100%' }} src={ctx.getValue()}></img>
              ),
            },
            {
              header: '账户',
              accessorKey: 'accountInfo.account_id',
            },
            {
              header: '回溯历史',
              accessorKey: 'performance.total_days',
              cell: (ctx) => `${(+ctx.getValue()).toFixed(1)}天`,
            },
            {
              header: '周收益率',
              accessorKey: 'performance.weekly_return_ratio',
              cell: (ctx) => `${(+ctx.getValue() * 100).toFixed(2)}%`,
            },
            {
              header: '最大维持保证金',
              accessorKey: 'performance.max_maintenance_margin',
              cell: (ctx) => (+ctx.getValue()).toFixed(2),
            },
            {
              header: '收益回撤比',
              accessorKey: 'performance.profit_drawdown_ratio',
              cell: (ctx) => (+ctx.getValue()).toFixed(5),
            },
            {
              header: '资本回报期',
              accessorKey: 'performance.payback_period_in_days',
              cell: (ctx) => `${(+ctx.getValue()).toFixed(1)}天`,
            },
            {
              header: '周夏普比率',
              accessorKey: 'performance.weekly_sharpe_ratio',
              cell: (ctx) =>
                (+ctx.getValue()).toLocaleString(undefined, {
                  style: 'percent',
                  minimumFractionDigits: 2,
                }),
            },
            {
              header: '资金占用率',
              accessorKey: 'performance.capital_occupancy_rate',
              cell: (ctx) =>
                (+ctx.getValue()).toLocaleString(undefined, {
                  style: 'percent',
                  minimumFractionDigits: 2,
                }),
            },
            {
              header: '净值',
              accessorKey: 'performance.equity',
              cell: (ctx) => (+ctx.getValue()).toFixed(2),
            },
            {
              header: '持仓次数',
              accessorKey: 'performance.total_positions',
              cell: (ctx) => +ctx.getValue(),
            },
          ]}
        />
      </Space>
    </Card>
  );
};
