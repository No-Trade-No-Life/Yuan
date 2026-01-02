import { Radio, RadioGroup, Space } from '@douyinfe/semi-ui';
import { escapeSQL, requestSQL } from '@yuants/sql';
import * as FlexLayout from 'flexlayout-react';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import { combineLatestWith, defer, filter, map, pipe, retry, shareReplay, switchMap, tap } from 'rxjs';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { AutoComplete } from '../Interactive';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';
import { ManualTradePanelContent } from './ManualTradePanelContent';
import { decodePath, encodePath } from '@yuants/utils';
import { AccountInfo } from './AccountInfo';
import { RadioChangeEvent } from '@douyinfe/semi-ui/lib/es/radio';
import { useAccountInfo } from '../AccountInfo';
import { AccountProfit } from './AccountProfit';
import { createFileSystemBehaviorSubject } from '../FileSystem';
import { loadTimeSeriesData } from '../Chart/components/utils';
import { generateAccountOrders } from './utils';
import { ITimeSeriesChartConfig } from '../Chart/components/model';
import { seriesIdList$ } from '../OHLC';
import { OrderBook } from './OrderBook';
import { IProduct } from '@yuants/data-product';

const accountIds$ = terminal$.pipe(
  filter((x): x is Exclude<typeof x, null> => !!x),
  switchMap((terminal) =>
    defer(() =>
      requestSQL<{ account_id: string }[]>(terminal, `select distinct(account_id) from account_balance`),
    ).pipe(
      retry({ delay: 10_000 }),
      map((x) => x.map((v) => v.account_id)),
    ),
  ),
  shareReplay(1),
);

const DURATION_TO_OKX_BAR_TYPE: Record<string, number> = {
  PT1M: 60,
  PT3M: 180,
  PT5M: 300,
  PT15M: 900,
  PT30M: 1800,

  PT1H: 3600,
  PT2H: 7200,
  PT4H: 14400,
  PT6H: 21600,
  PT12H: 43200,

  P1D: 86400,
  P1W: 86400 * 7,
  P1M: 86400 * 30,
};

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
            type: 'row',
            weight: 70,
            children: [
              {
                type: 'tabset',
                weight: 80,
                enableDeleteWhenEmpty: false,
                enableTabStrip: false,
                children: [
                  {
                    type: 'tab',
                    component: 'left-top-left',
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
                    component: 'left-top-right',
                  },
                ],
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
        type: 'row',
        weight: 20,
        children: [
          {
            type: 'tabset',
            weight: 70,
            enableDeleteWhenEmpty: false,
            enableTabStrip: false,
            children: [
              {
                type: 'tab',
                component: 'right-top',
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
                component: 'right-bottom',
              },
            ],
          },
        ],
      },
    ],
  },
};

export const accountId$ = createFileSystemBehaviorSubject('account-id', '');

export const uniqueProductId$ = createFileSystemBehaviorSubject('unique-product-id', '');

export const candleDuration$ = createFileSystemBehaviorSubject('candle-duration', '');

registerPage('TradingBoard', () => {
  const model = useMemo(() => FlexLayout.Model.fromJson(layoutJson), []);
  const seriesIdList = useObservableState(seriesIdList$);
  const accountIds = useObservableState(accountIds$);

  const [drawOrders, setDrawOrders] = useState(false);

  const uniqueProductId = useObservableState(uniqueProductId$);
  const accountId = useObservableState(accountId$);
  const candleDuration = useObservableState(candleDuration$);

  const mapUniqueProductIdToDurationListState = useMemo(() => {
    const mapUniqueIdToDurationList = new Map<string, string[]>();
    seriesIdList?.forEach((seriesId) => {
      const [datasource_id, product_id, duration = ''] = decodePath(seriesId);
      const id = encodePath(datasource_id, product_id);
      mapUniqueIdToDurationList.set(
        id,
        [...(mapUniqueIdToDurationList.get(id) ?? []), duration].sort(
          (a, b) => DURATION_TO_OKX_BAR_TYPE[a] - DURATION_TO_OKX_BAR_TYPE[b],
        ),
      );
    });
    return mapUniqueIdToDurationList;
  }, [seriesIdList]);

  const accountInfo$ = useMemo(() => useAccountInfo(accountId ?? ''), [accountId]);
  const accountInfo = useObservableState(accountInfo$);

  const onSelectProduct = (v: string) => {
    uniqueProductId$.next(v);
    const durationList = mapUniqueProductIdToDurationListState.get(v);
    if (!durationList || !durationList.includes(candleDuration ?? '')) {
      candleDuration$.next(mapUniqueProductIdToDurationListState.get(v)?.[0] ?? '');
    }
  };

  const seriesId = useMemo(() => {
    if (uniqueProductId && candleDuration) {
      return encodePath(...decodePath(uniqueProductId), candleDuration);
    }
  }, [uniqueProductId, candleDuration]);

  const [datasourceId, productId] = useMemo(() => {
    if (uniqueProductId) {
      return decodePath(uniqueProductId);
    }
    return [];
  }, [uniqueProductId]);

  const onCandleDurationChange = (e: RadioChangeEvent) => {
    candleDuration$.next(e.target.value);
  };

  const productInfo = useObservableState(
    useObservable(
      pipe(
        combineLatestWith(terminal$),
        switchMap(async ([[uniqueProductId], terminal]) => {
          if (!uniqueProductId) return;
          const [, product_id] = decodePath(uniqueProductId);
          if (!product_id || !terminal) return;

          const result = await requestSQL<IProduct[]>(
            terminal,
            `select * from product where product_id=${escapeSQL(product_id)}`,
          );
          if (result.length > 0) {
            return result[0];
          }
        }),
      ),
      //
      [uniqueProductId],
    ),
  );
  const config$ = useObservable(
    pipe(
      switchMap(async ([seriesId, drawOrders, accountId, productId, productInfo]) => {
        if (!seriesId || !productInfo) return { data: [], views: [] };
        const ohlc = await loadTimeSeriesData({
          type: 'sql' as const,
          query: `select * from ohlc_v2 where series_id = ${escapeSQL(
            seriesId,
          )} order by created_at desc limit 5000`,
          time_column_name: 'created_at',
        });

        const data = [
          {
            type: 'data' as const,
            time_column_name: 'created_at',
            series: ohlc.series,
            name: ohlc.filename,
            data_length: ohlc.data_length,
          },
        ];
        const views: ITimeSeriesChartConfig['views'] = [
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
                      minMove: +productInfo.price_step * 10,
                    },
                  },
                ],
              },
            ],
          },
        ];
        if (drawOrders && accountId) {
          const [series] = await generateAccountOrders(
            accountId,
            ohlc.series.get(ohlc.time_column_name)?.[0] ?? '',
            ohlc.series.get(ohlc.time_column_name)?.[
              (ohlc.series.get(ohlc.time_column_name)?.length ?? 1) - 1
            ] ?? '',
            productId,
            productInfo,
          );
          data.push({
            type: 'data' as const,
            time_column_name: 'traded_at',
            series: series,
            name: '账户订单',
            data_length: series.get('traded_at')?.length ?? 0,
          });
          views[0].panes[0].series.push({
            type: 'order',
            name: '模拟账户订单',
            refs: [
              {
                data_index: 1,
                column_name: 'direction',
              },
              {
                data_index: 1,
                column_name: 'traded_price',
              },
              {
                data_index: 1,
                column_name: 'traded_volume',
              },
            ],
            options: {
              candlePaneIndex: 0,
              candleSeriesIndex: 0,
            },
          });
        }
        return {
          data,
          views,
        };
      }),
    ),
    //
    [seriesId, drawOrders, accountId, productId, productInfo],
  );

  const config = useObservableState(config$);

  return (
    <FlexLayout.Layout
      model={model}
      factory={(node) => {
        const component = node.getComponent();
        switch (component) {
          case 'left-top':
          case 'left-top-left':
            return (
              <Space style={{ height: '100%', width: '100%', padding: '0 8px' }}>
                <TimeSeriesChart
                  hideRefresh={true}
                  hideSettings={true}
                  hideViewSelector={true}
                  topSlot={
                    <>
                      <AutoComplete
                        data={accountIds?.map((id) => ({ label: id, value: id }))}
                        value={accountId ?? ''}
                        onChange={(v: string) => {
                          accountId$.next(v);
                        }}
                        placeholder="请输入或选择账户id"
                      />
                      <AutoComplete
                        data={Array.from(mapUniqueProductIdToDurationListState.keys()).map((id) => {
                          return { label: id, value: id };
                        })}
                        value={uniqueProductId ?? ''}
                        onChange={onSelectProduct}
                        placeholder="请输入或选择K线品种/周期"
                      />
                      <RadioGroup value={candleDuration} onChange={onCandleDurationChange}>
                        {mapUniqueProductIdToDurationListState.get(uniqueProductId ?? '')?.map((id) => (
                          <Radio value={id}>{id}</Radio>
                        ))}
                      </RadioGroup>
                    </>
                  }
                  config={config}
                />
              </Space>
            );
          case 'left-top-right':
            return <OrderBook uniqueProductId={uniqueProductId ?? ''} productInfo={productInfo} />;
          case 'left-bottom':
            return (
              <AccountInfo
                accountId={accountId ?? ''}
                accountInfo={accountInfo}
                setDrawOrders={setDrawOrders}
                drawOrders={drawOrders}
              />
            );
          case 'right-top':
            return <ManualTradePanelContent accountId={accountId ?? ''} productId={productId} />;

          case 'right-bottom':
            return <AccountProfit accountInfo={accountInfo} />;
          default:
            return null;
        }
      }}
    />
  );
});
