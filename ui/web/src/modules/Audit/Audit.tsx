import { IconDownload } from '@douyinfe/semi-icons';
import { DatePicker, Layout, Space, Toast } from '@douyinfe/semi-ui';
import '@yuants/data-series';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { convertDurationToOffset, decodePath, encodePath, formatTime } from '@yuants/utils';
import { t } from 'i18next';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import {
  defer,
  filter,
  firstValueFrom,
  lastValueFrom,
  map,
  pipe,
  retry,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';
import { executeCommand, registerCommand } from '../CommandCenter';
import { showForm } from '../Form';
import { AutoComplete, Button } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { loadSqlData } from '../Chart/components/utils';
import { generateSimulateAccountNetValue } from './GenerateSimilateAccountNetValue';

const DURATION_TO_OKX_STEP: Record<string, string> = {
  PT1M: '1m',
  PT3M: '3m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',

  PT1H: '1h',
  PT2H: '2h',
  PT4H: '4h',
  PT6H: '6h',
  PT12H: '12h',

  P1D: '1d',
  P1W: '1w',
  P1M: '1M',
};

const seriesIdList$ = terminal$.pipe(
  filter((x): x is Exclude<typeof x, null> => !!x),
  switchMap((terminal) =>
    defer(() => requestSQL<{ series_id: string }[]>(terminal, `select distinct(series_id) from ohlc`)).pipe(
      retry({ delay: 10_000 }),
      map((x) => x.map((v) => v.series_id)),
    ),
  ),
  shareReplay(1),
);

const accountIds$ = terminal$.pipe(
  filter((x): x is Exclude<typeof x, null> => !!x),
  switchMap((terminal) =>
    defer(() =>
      requestSQL<{ account_id: string }[]>(terminal, `select distinct(account_id) from trade`),
    ).pipe(
      retry({ delay: 10_000 }),
      map((x) => x.map((v) => v.account_id)),
    ),
  ),
  shareReplay(1),
);

registerPage('Audit', () => {
  const seriesIdList = useObservableState(seriesIdList$);
  const accountIds = useObservableState(accountIds$);
  const [timeRange, setTimeRange] = useState<[startTime: string, endTime: string]>();
  const [seriesId, setSeriesId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [expectedAccountId, setExpectedAccountId] = useState('');

  const [datasource_id, product_id, duration = ''] = decodePath(seriesId);

  const config$ = useObservable(
    pipe(
      //
      switchMap(async ([seriesId, timeRange, accountId, expectedAccountId]) => {
        const [datasource_id, product_id, duration] = decodePath(seriesId);
        if (!timeRange || !seriesId || !accountId) return { data: [], views: [] };
        const step = convertDurationToOffset(duration) / 1000;
        const ohlc = await loadSqlData(
          {
            type: 'sql' as const,
            query: `select * from ohlc where series_id = ${escapeSQL(seriesId)} and created_at>=${escapeSQL(
              formatTime(timeRange[0]),
            )} and created_at<=${escapeSQL(formatTime(timeRange[1]))} order by created_at`,
            time_column_name: 'created_at',
          },
          0,
        );
        const netSeries = await generateSimulateAccountNetValue(
          ohlc.series.get('created_at') ?? [],
          ohlc.series.get('close') ?? [],
          accountId,
          timeRange[0],
          timeRange[1],
          product_id,
        );
        return {
          data: [
            {
              type: 'data' as const,
              // query: `select * from ohlc where series_id = ${escapeSQL(seriesId)} and created_at>=${escapeSQL(
              //   formatTime(timeRange[0]),
              // )} and created_at<=${escapeSQL(formatTime(timeRange[1]))} order by created_at`,
              time_column_name: 'created_at',
              series: ohlc.series,
              name: ohlc.filename,
              data_length: ohlc.data_length,
            },
            {
              type: 'promql' as const,
              query: `sum (account_info_equity{account_id="${accountId}"})`,
              start_time: formatTime(timeRange[0]),
              end_time: formatTime(timeRange[1]),
              step: step.toString(),
            },
            {
              type: 'data' as const,
              time_column_name: '_time',
              series: netSeries,
              name: '模拟账户净值曲线',
              data_length: ohlc.data_length,
            },
          ],
          views: [
            {
              name: '主视图',
              time_ref: {
                data_index: 0,
                column_name: 'created_at',
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
                {
                  series: [
                    {
                      type: 'line',
                      refs: [
                        {
                          data_index: 1,
                          column_name: '{}',
                        },
                      ],
                    },
                  ],
                },
                {
                  series: [
                    {
                      type: 'line',
                      refs: [
                        {
                          data_index: 2,
                          column_name: 'net_value',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        };
      }),
    ),
    [seriesId, timeRange, accountId, expectedAccountId],
  );

  const config = useObservableState(config$);

  const onTimeRangeChange = (time?: string | string[] | Date | Date[]) => {
    if (time) setTimeRange(time as [string, string]);
  };

  console.log({ config });
  return (
    <Layout style={{ width: '100%', height: '100%' }}>
      <Layout.Header>
        <Space></Space>
      </Layout.Header>
      <Layout.Content>
        <TimeSeriesChart
          topSlot={
            <>
              <AutoComplete
                data={seriesIdList?.map((id) => ({ label: id, value: id }))}
                value={seriesId}
                onChange={setSeriesId}
                placeholder="请输入或选择K线品种/周期"
              />
              <AutoComplete
                data={accountIds?.map((id) => ({ label: id, value: id }))}
                value={accountId}
                onChange={setAccountId}
                placeholder="请输入或选择账户id"
              />
              <AutoComplete
                data={accountIds?.map((id) => ({ label: id, value: id }))}
                value={expectedAccountId}
                onChange={setExpectedAccountId}
                placeholder="请输入或选择模拟账户id"
              />
              <DatePicker value={timeRange} type="dateTimeRange" onChange={onTimeRangeChange} />
            </>
          }
          config={config}
        />
        {/* <ChartGroup key={cnt}>
          <Chart>
            <stickSeries title={periodKey} data={periods} />
          </Chart>
        </ChartGroup> */}
      </Layout.Content>
    </Layout>
  );
});
