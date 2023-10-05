import EChartsReact from 'echarts-for-react';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { accountPerformance$ } from '../AccountInfo/model';

export const WeeklyProfitChart = React.memo(() => {
  const [t] = useTranslation('WeeklyProfitChart');
  const accountPerformance = useObservableState(accountPerformance$);

  return (
    <EChartsReact
      style={{ width: '100%', height: '100%', minHeight: 400 }}
      option={{
        title: {
          text: t('weekly_pnl_distribution_chart'),
        },
        xAxis: {
          type: 'value',
        },
        yAxis: {
          type: 'value',
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            return `Week #${params?.[0]?.value?.[0]}: ${params?.[0]?.value?.[1]}`;
          },
        },

        series: [
          {
            type: 'bar',
            data: accountPerformance._weekly_return_ratio_list.map((v, i) => ({ value: [i, v] })),
          },
        ],
      }}
    />
  );
});
