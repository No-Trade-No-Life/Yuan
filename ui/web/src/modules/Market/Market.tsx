import { IconDownload } from '@douyinfe/semi-icons';
import { Layout, Space, Toast } from '@douyinfe/semi-ui';
import '@yuants/data-series';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { defer, filter, firstValueFrom, lastValueFrom, map, retry, shareReplay, switchMap, tap } from 'rxjs';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';
import { executeCommand, registerCommand } from '../CommandCenter';
import { showForm } from '../Form';
import { AutoComplete, Button } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { seriesIdList$ } from '../OHLC';

registerPage('Market', () => {
  const seriesIdList = useObservableState(seriesIdList$);
  const [seriesId, setSeriesId] = useState('');
  const [datasource_id, product_id, duration = ''] = decodePath(seriesId);

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
              <Button
                icon={<IconDownload />}
                onClick={() => executeCommand('fetchOHLCV', { datasource_id, product_id, duration })}
              >
                拉取历史
              </Button>
            </>
          }
          config={{
            data: [
              {
                type: 'sql',
                query: `select * from ohlc_v2 where series_id = ${escapeSQL(
                  seriesId,
                )} order by created_at desc limit 50000`,
                time_column_name: 'created_at',
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
                ],
              },
            ],
          }}
        />
        {/* <ChartGroup key={cnt}>
          <Chart>
            <CandlestickSeries title={periodKey} data={periods} />
          </Chart>
        </ChartGroup> */}
      </Layout.Content>
    </Layout>
  );
});

registerCommand('fetchOHLCV', async (params) => {
  const { datasource_id, product_id, duration, start_time, end_time } = await showForm<{
    datasource_id: string;
    product_id: string;
    duration: string;
    start_time: string;
    end_time: string;
  }>(
    {
      type: 'object',
      properties: {
        datasource_id: { type: 'string' },
        product_id: { type: 'string' },
        duration: { type: 'string' },
        start_time: { type: 'string', format: 'datetime' },
        end_time: { type: 'string', format: 'datetime' },
      },
    },
    params,
  );
  const _start_time = new Date(start_time).getTime();
  const _end_time = new Date(end_time || Date.now()).getTime();

  const terminal = await firstValueFrom(terminal$.pipe(filter((x): x is Exclude<typeof x, null> => !!x)));
  Toast.info(`开始拉取 ${datasource_id} / ${product_id} / ${duration} 历史数据...`);
  await lastValueFrom(
    terminal.client
      .requestService('CollectSeries', {
        table_name: 'ohlc',
        series_id: encodePath(datasource_id, product_id, duration),
        started_at: _start_time,
        ended_at: _end_time,
      })
      .pipe(
        tap({
          next: (x) => {
            if (x.frame) {
              const { fetched, fetched_at, saved, saved_at } = x.frame as any;
              Toast.info(
                `拉取到 ${fetched} 条数据 (${formatTime(fetched_at)})，已存储到 ${saved} 条数据 (${formatTime(
                  saved_at,
                )})`,
              );
            }
          },
          complete: () => {
            Toast.success(t('common:succeed'));
          },
          error: (err) => {
            Toast.error(t('common:failed') + `: ${err}`);
          },
        }),
      ),
  );
});
