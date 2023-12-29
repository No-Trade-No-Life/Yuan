import { IconComment } from '@douyinfe/semi-icons';
import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { IAccountPerformance } from '@yuants/kernel';
import { format } from 'date-fns';
import EChartsReact from 'echarts-for-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { IMessageCardProps } from '../model';

export default ({
  payload,
  messages,
}: IMessageCardProps<{
  description: string;
  best_mode_id: number;
}>) => {
  const { t } = useTranslation(['Copilot', 'WeeklyEquityChart']);
  const options = useMemo(() => {
    //
    const accountPerformanceList: Record<string, IAccountPerformance>[] = messages
      .filter((msg) => msg.type === 'SystemBacktestResult')
      .map((msg) => msg.payload.account_performance);

    return {
      animation: true,
      animationDuration: 5000,
      title: {
        text: t('WeeklyEquityChart:weekly_equity_chart'),
      },
      tooltip: {
        trigger: 'axis',
      },
      xAxis: {
        data:
          Object.values(accountPerformanceList[0] || {})[0]?._weekly_first_timestamp.map((v) =>
            format(v, 'yyyy-MM-dd'),
          ) || [],
      },
      yAxis: {},
      series: accountPerformanceList.flatMap((performanceMap, i) =>
        Object.entries(performanceMap).map(([accountId, performance]) => ({
          type: 'line',
          name: `Model-${i + 1}-${accountId}`,
          data: performance._weekly_equity,
        })),
      ),
    };
  }, [messages, t]);
  return (
    <Card
      title={
        <Space>
          <IconComment />
          <Typography.Text strong>{t('Copilot:CopilotModelCompareResult:title')}</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
      actions={[]}
    >
      <EChartsReact style={{ width: '100%', height: '100%', minHeight: 400 }} option={options} />
      <Markdown rehypePlugins={[rehypeRaw]}>{payload.description}</Markdown>
    </Card>
  );
};
