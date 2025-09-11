import { formatTime } from '@yuants/utils';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';
import { registerPage } from '../Pages';
import { useObservable, useObservableState } from 'observable-hooks';
import { interval } from 'rxjs';

registerPage('HostStatus', () => {
  useObservableState(useObservable(() => interval(10_000)));

  return (
    <TimeSeriesChart
      config={{
        data: [
          {
            type: 'promql',
            query: `sum (rate(nodejs_process_resource_usage{type="userCPUTime"}[1m])) / 1e6`,
            start_time: formatTime(Date.now() - 86400 * 1000),
            end_time: formatTime(Date.now()),
            step: '5m',
          },
          {
            type: 'promql',
            query: `sum (nodejs_process_memory_usage{type="rss"}) / 1024 / 1024 / 1024`,
            start_time: formatTime(Date.now() - 86400 * 1000),
            end_time: formatTime(Date.now()),
            step: '5m',
          },
        ],
        views: [
          {
            name: '主机 NodeJS 计算资源使用情况',
            time_ref: { data_index: 0, column_name: '__time' },
            panes: [
              {
                series: [
                  {
                    type: 'line',
                    name: 'CPU 核心利用率 (核)',
                    refs: [
                      //
                      { data_index: 0, column_name: '{}' },
                    ],
                  },
                ],
              },
              {
                series: [
                  {
                    type: 'line',
                    name: '内存占用 (GB)',
                    refs: [
                      //
                      { data_index: 1, column_name: '{}' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }}
    />
  );
});
