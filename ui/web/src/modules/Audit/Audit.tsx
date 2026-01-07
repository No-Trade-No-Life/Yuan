import { DatePicker, Layout, Space } from '@douyinfe/semi-ui';
import '@yuants/data-series';
import { decodeOHLCSeriesId } from '@yuants/data-ohlc';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { defer, filter, map, pipe, retry, shareReplay, switchMap } from 'rxjs';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';
import { loadTimeSeriesData } from '../Chart/components/utils';
import { AutoComplete } from '../Interactive';
import { seriesIdList$ } from '../OHLC';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { generateAccountNetValue } from './GenerateAccountNetValue';

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
  const config$ = useObservable(
    pipe(
      //
      switchMap(async ([seriesId, timeRange, accountId, expectedAccountId]) => {
        if (!timeRange || !seriesId || !accountId) return { data: [], views: [] };
        const { product_id } = decodeOHLCSeriesId(seriesId);
        const ohlc = await loadTimeSeriesData({
          type: 'sql' as const,
          query: `select * from ohlc_v2 where series_id = ${escapeSQL(seriesId)} and created_at>=${escapeSQL(
            formatTime(timeRange[0]),
          )} and created_at<=${escapeSQL(formatTime(timeRange[1]))} order by created_at`,
          time_column_name: 'created_at',
        });
        const [expectedAccountNetSeries, expectedAccountOrderSeries] = await generateAccountNetValue(
          ohlc.series.get('created_at') ?? [],
          ohlc.series.get('close') ?? [],
          expectedAccountId,
          timeRange[0],
          timeRange[1],
          product_id,
        );

        const [accountNetSeries, accountOrderSeries] = await generateAccountNetValue(
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
              time_column_name: 'created_at',
              series: ohlc.series,
              name: ohlc.filename,
              data_length: ohlc.data_length,
            },
            {
              type: 'data' as const,
              time_column_name: '_time',
              series: expectedAccountNetSeries,
              name: '模拟账户净值曲线',
              data_length: ohlc.data_length,
            },
            {
              type: 'data' as const,
              time_column_name: 'traded_at',
              series: expectedAccountOrderSeries,
              name: '模拟账户订单',
              data_length: expectedAccountOrderSeries.get('traded_at')?.length ?? 0,
            },
            {
              type: 'data' as const,
              time_column_name: '_time',
              series: accountNetSeries,
              name: '账户净值曲线',
              data_length: ohlc.data_length,
            },
            {
              type: 'data' as const,
              time_column_name: 'traded_at',
              series: accountOrderSeries,
              name: '账户订单',
              data_length: accountOrderSeries.get('traded_at')?.length ?? 0,
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
                    {
                      type: 'order',
                      name: '模拟账户订单',
                      refs: [
                        {
                          data_index: 2,
                          column_name: 'direction',
                        },
                        {
                          data_index: 2,
                          column_name: 'traded_price',
                        },
                        {
                          data_index: 2,
                          column_name: 'traded_volume',
                        },
                      ],
                    },
                    {
                      type: 'order',
                      name: '账户订单',
                      refs: [
                        {
                          data_index: 4,
                          column_name: 'direction',
                        },
                        {
                          data_index: 4,
                          column_name: 'traded_price',
                        },
                        {
                          data_index: 4,
                          column_name: 'traded_volume',
                        },
                      ],
                    },
                  ],
                },
                {
                  series: [
                    {
                      type: 'line',
                      name: '模拟账户净值曲线',
                      refs: [
                        {
                          data_index: 1,
                          column_name: 'net_value',
                        },
                      ],
                    },
                  ],
                },
                {
                  series: [
                    {
                      type: 'line',
                      name: '账户净值曲线',
                      refs: [
                        {
                          data_index: 3,
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
      </Layout.Content>
    </Layout>
  );
});
