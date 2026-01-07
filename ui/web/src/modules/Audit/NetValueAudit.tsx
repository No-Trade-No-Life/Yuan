import { DatePicker, Layout, Space } from '@douyinfe/semi-ui';
import { decodeOHLCSeriesId, IOHLC } from '@yuants/data-ohlc';
import { IProduct } from '@yuants/data-product';
import '@yuants/data-series';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import {
  catchError,
  defer,
  filter,
  firstValueFrom,
  map,
  of,
  pipe,
  retry,
  shareReplay,
  switchMap,
} from 'rxjs';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';
import { loadTimeSeriesData } from '../Chart/components/utils';
import { createFileSystemBehaviorSubject } from '../FileSystem';
import { AutoComplete } from '../Interactive';
import { seriesIdList$ } from '../OHLC';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { generateNetValue } from './CalculateAccountNetValue';

type IOHLCV2Row = Omit<IOHLC, 'datasource_id' | 'product_id' | 'duration'>;

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

export const accountId$ = createFileSystemBehaviorSubject('net-value-audit-account-id', '');

export const seriesId$ = createFileSystemBehaviorSubject<string>('net-value-audit-series-id', '');

// export const startTime$ = createFileSystemBehaviorSubject('net-value-audit-start-time', '');

// export const endTime$ = createFileSystemBehaviorSubject('net-value-audit-end-time', '');

registerPage('NetValueAudit', () => {
  const seriesIdList = useObservableState(seriesIdList$);
  const accountIds = useObservableState(accountIds$);
  const [timeRange, setTimeRange] = useState<[startTime: string, endTime: string]>();
  const seriesId = useObservableState(seriesId$);
  const accountId = useObservableState(accountId$);
  const config$ = useObservable(
    pipe(
      //
      switchMap(async ([seriesId, timeRange, accountId]) => {
        const terminal = await firstValueFrom(terminal$);
        if (!timeRange || !seriesId || !accountId || !terminal || !timeRange[0] || !timeRange[1])
          return { data: [], views: [] };
        const { product_id, duration } = decodeOHLCSeriesId(seriesId);
        const [datasource_id = ''] = decodePath(product_id);
        const productInfoList = await requestSQL<IProduct[]>(
          terminal,
          `select * from product where product_id = ${escapeSQL(product_id)}`,
        );
        const ohlc = await loadTimeSeriesData({
          type: 'sql' as const,
          query: `select * from ohlc_v2 where series_id = ${escapeSQL(seriesId)} and created_at>=${escapeSQL(
            formatTime(timeRange[0]),
          )} and created_at<=${escapeSQL(formatTime(timeRange[1]))} order by created_at`,
          time_column_name: 'created_at',
        });
        const ohlcRows = await requestSQL<IOHLCV2Row[]>(
          terminal,
          `select * from ohlc_v2 where series_id = ${escapeSQL(seriesId)} and created_at>=${escapeSQL(
            formatTime(timeRange[0]),
          )} and created_at<=${escapeSQL(formatTime(timeRange[1]))} order by created_at`,
        );
        const originOHLC = ohlcRows.map((row) => ({
          ...row,
          datasource_id,
          product_id,
          duration,
        }));
        const [netValueList, volumeList] = await generateNetValue(
          originOHLC,
          timeRange[0],
          timeRange[1],
          productInfoList[0],
          accountId,
        );
        const netValueSeries = new Map<string, any[]>();
        netValueSeries.set('created_at', ohlc.series.get('created_at') ?? []);
        netValueSeries.set('net_value', netValueList);
        netValueSeries.set('volume', volumeList);

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
              time_column_name: 'created_at',
              series: netValueSeries,
              name: '模拟账户净值曲线',
              data_length: netValueList.length,
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
                      name: '净值曲线',
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
                      type: 'baseline',
                      name: '持仓',
                      refs: [
                        {
                          data_index: 1,
                          column_name: 'volume',
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
      catchError((e) => {
        console.log(e);
        return of({ data: [], views: [] });
      }),
    ),
    [seriesId, timeRange, accountId],
  );

  const config = useObservableState(config$);

  const onTimeRangeChange = (time?: string | string[] | Date | Date[]) => {
    if (time) {
      setTimeRange(time as [string, string]);
    }
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
                value={seriesId ?? ''}
                onChange={(v) => {
                  seriesId$.next(v);
                }}
                placeholder="请输入或选择K线品种/周期"
              />
              <AutoComplete
                data={accountIds?.map((id) => ({ label: id, value: id }))}
                value={accountId ?? ''}
                onChange={(v) => {
                  accountId$.next(v);
                }}
                placeholder="请输入或选择账户id"
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
