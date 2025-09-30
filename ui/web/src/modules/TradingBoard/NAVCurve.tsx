import React from 'react';
import { formatTime } from '@yuants/utils';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';

interface Props {
  accountId: string;
}

export const NAVCurve = (props: Props) => {
  const { accountId } = props;
  if (accountId) return null;
  return (
    <div style={{ width: '100%', minHeight: '400px' }}>
      <TimeSeriesChart
        config={{
          data: [
            {
              type: 'promql',
              query: `sum (account_info_equity{account_id="${accountId}"})`,
              start_time: formatTime(Date.now() - 14 * 24 * 3600 * 1000),
              end_time: formatTime(Date.now()),
              step: '2h',
            },
          ],
          views: [
            {
              name: '账户历史净值监控',
              time_ref: {
                data_index: 0,
                column_name: '__time',
              },
              panes: [
                {
                  series: [
                    {
                      type: 'line',
                      refs: [
                        {
                          data_index: 0,
                          column_name: '{}',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }}
        onConfigChange={() => {}}
      />
    </div>
  );
};
