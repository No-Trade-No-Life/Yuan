import { IAccountPerformance } from '@yuants/kernel';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ITimeSeriesChartConfig } from './components/model';
import { TimeSeriesChart } from './components/TimeSeriesChart';
import { loadObjectArrayData } from './components/utils';

export const WeeklyEquityChart = React.memo((props: { accountPerformance?: IAccountPerformance }) => {
  const [t] = useTranslation('WeeklyEquityChart');
  const accountPerformance: IAccountPerformance | undefined = props.accountPerformance;

  const config = useMemo((): ITimeSeriesChartConfig | undefined => {
    if (!accountPerformance) return;

    const data = accountPerformance._history_weekly_equity.map((v, i) => ({
      time: accountPerformance._weekly_first_timestamp[i],
      open: accountPerformance._weekly_equity[i],
      close: accountPerformance._weekly_equity[i + 1] ?? accountPerformance.equity,
      low: v.low,
      high: v.high,
    }));

    return {
      data: [
        {
          ...loadObjectArrayData(data, 'time'),
          type: 'data',
          name: '',
        },
      ],
      views: [
        {
          name: t('weekly_equity_chart'),
          time_ref: {
            data_index: 0,
            column_name: 'time',
          },
          panes: [
            {
              series: [
                {
                  type: 'ohlc',
                  refs: [
                    {
                      data_index: 0,
                      column_name: 'open',
                    },
                    {
                      data_index: 0,
                      column_name: 'high',
                    },
                    {
                      data_index: 0,
                      column_name: 'low',
                    },
                    {
                      data_index: 0,
                      column_name: 'close',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }, [accountPerformance, t]);

  if (!config) return null;

  return (
    <div style={{ width: '100%', height: 400 }}>
      <TimeSeriesChart config={config} />
    </div>
  );
});
