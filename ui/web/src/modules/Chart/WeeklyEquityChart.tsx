import { format } from 'date-fns';
import EChartsReact from 'echarts-for-react';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { accountPerformance$ } from '../AccountInfo/model';

export const WeeklyEquityChart = React.memo(() => {
  const [t] = useTranslation('WeeklyEquityChart');
  const accountPerformance = useObservableState(accountPerformance$);

  return (
    <EChartsReact
      style={{ width: '100%', height: '100%', minHeight: 400 }}
      option={{
        title: {
          text: t('weekly_equity_chart'),
        },
        tooltip: {
          trigger: 'axis',
        },
        xAxis: {
          data: accountPerformance._weekly_first_timestamp.map((v) => format(v, 'yyyy-MM-dd')),
        },
        yAxis: {},
        series: [
          {
            type: 'candlestick',
            // O-C-L-H
            data: accountPerformance._history_weekly_equity.map((v, i) => [
              accountPerformance._weekly_equity[i],
              accountPerformance._weekly_equity[i + 1] || accountPerformance.equity,
              v.high,
              v.low,
            ]),
          },
        ],
      }}
    />
  );
});
