import { Space } from '@douyinfe/semi-ui';
import { escapeSQL, requestSQL } from '@yuants/sql';
import * as FlexLayout from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import { useEffect, useMemo, useState } from 'react';
import { defer, EMPTY, filter, map, retry, shareReplay, Subject, switchMap, tap } from 'rxjs';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { AutoComplete } from '../Interactive';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';
import { ManualTradePanelContent } from './ManualTradePanelContent';
import { decodePath } from '@yuants/utils';
import { IOHLC } from '@yuants/data-ohlc';
import { AccountInfo } from './AccountInfo';

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

const layoutJson: FlexLayout.IJsonModel = {
  global: {
    tabEnableClose: false,
    tabEnableRename: false,
    tabEnableFloat: false,
  },
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'row',
        weight: 80,
        children: [
          {
            type: 'tabset',
            weight: 70,
            enableDeleteWhenEmpty: false,
            enableTabStrip: false,
            children: [
              {
                type: 'tab',
                component: 'left-top',
              },
            ],
          },
          {
            type: 'tabset',
            weight: 30,
            enableDeleteWhenEmpty: false,
            enableTabStrip: false,
            children: [
              {
                type: 'tab',
                component: 'left-bottom',
              },
            ],
          },
        ],
      },
      {
        type: 'tabset',
        weight: 20,
        enableDeleteWhenEmpty: false,
        enableTabStrip: false,
        children: [
          {
            type: 'tab',
            component: 'right-panel',
          },
        ],
      },
    ],
  },
};

const ohlc$ = new Subject<IOHLC | undefined>();

registerPage('TradingBoard', () => {
  const model = useMemo(() => FlexLayout.Model.fromJson(layoutJson), []);
  const seriesIdList = useObservableState(seriesIdList$);
  const accountIds = useObservableState(accountIds$);

  const [seriesId, setSeriesId] = useState('');
  const [accountId, setAccountId] = useState('');

  const [datasource_id, product_id, duration = ''] = useMemo(() => {
    // const [datasource_id, product_id, duration = ''] = decodePath(seriesId);
    return decodePath(seriesId);
  }, [seriesId]);
  useEffect(() => {
    if (seriesId) {
      console.log({ data: 'data', seriesId });
      const sub = terminal$
        .pipe(
          switchMap((terminal) => {
            if (!terminal) return EMPTY;
            return terminal.channel.subscribeChannel<IOHLC>('ohlc1', seriesId).pipe(
              tap((data) => {
                console.log({ data });
                ohlc$.next(data);
              }),
            );
          }),
        )
        .subscribe();
      return () => {
        ohlc$.next(undefined);
        sub.unsubscribe();
      };
    }
  }, [seriesId]);

  return (
    <FlexLayout.Layout
      model={model}
      factory={(node) => {
        const component = node.getComponent();
        switch (component) {
          case 'left-top':
            return (
              <Space style={{ height: '100%', width: '100%' }}>
                <TimeSeriesChart
                  topSlot={
                    <>
                      <AutoComplete
                        data={accountIds?.map((id) => ({ label: id, value: id }))}
                        value={accountId}
                        onChange={setAccountId}
                        placeholder="请输入或选择账户id"
                      />
                      <AutoComplete
                        data={seriesIdList?.map((id) => ({ label: id, value: id }))}
                        value={seriesId}
                        onChange={setSeriesId}
                        placeholder="请输入或选择K线品种/周期"
                      />
                    </>
                  }
                  config={{
                    data: [
                      {
                        type: 'sql',
                        query: `select * from ohlc where series_id = ${escapeSQL(
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
                                options: {
                                  realtimeSeriesId: seriesId,
                                },
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  }}
                />
              </Space>
            );
          case 'left-bottom':
            return <AccountInfo accountId={accountId} />;
          case 'right-panel':
            return <ManualTradePanelContent />;
          default:
            return null;
        }
      }}
    />
  );
});
