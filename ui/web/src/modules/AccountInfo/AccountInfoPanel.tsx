import { IconClose, IconTaskMoneyStroked } from '@douyinfe/semi-icons';
import { Collapse, Descriptions, Space, Spin, Typography } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IAccountMoney, IPosition, mergeAccountInfoPositions } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { IQuote } from '@yuants/data-quote';
import { encodePath, formatTime } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import {
  combineLatest,
  defer,
  distinctUntilChanged,
  filter,
  first,
  from,
  groupBy,
  map,
  mergeMap,
  of,
  pairwise,
  raceWith,
  reduce,
  shareReplay,
  tap,
  throttleTime,
  timer,
  toArray,
} from 'rxjs';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';
import { executeCommand } from '../CommandCenter';
import { Button, DataView, InlineTime } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';
import { InlineProductId } from '../Products/InlineProductId';
import { terminal$, useTick } from '../Terminals';
import { TradeCopierDetail } from '../TradeCopier';
import { InlineAccountId } from './InlineAccountId';
import { useAccountInfo } from './model';

interface IPositionSummaryItem {
  product_id: string;
  long: IPosition;
  short: IPosition;
  net: IPosition;
}

const createColumnsOfPositionSummaryItem = () => {
  const helper = createColumnHelper<IPositionSummaryItem>();
  return [
    helper.accessor('product_id', {
      header: () => '品种',
    }),
    helper.accessor('net.direction', {
      header: () => '方向',
    }),
    helper.accessor('net.valuation', {
      header: () => '估值',
    }),
    helper.accessor('net.volume', {
      header: () => '持仓量',
    }),
    helper.accessor('net.position_price', {
      header: () => '持仓价',
    }),
    helper.accessor('net.closable_price', {
      header: () => '可平价',
    }),
    helper.accessor('net.floating_profit', {
      header: () => '浮动盈亏',
    }),
    helper.accessor('net.interest_to_settle', {
      header: () => '预计利息',
    }),
  ];
};

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

const useTickMemoized = memoizeMap((datasource_id: string, product_id: string) =>
  useTick(datasource_id, product_id).pipe(shareReplay(1)),
);

registerPage('AccountInfoPanel', () => {
  const terminal = useObservableState(terminal$);
  const { account_id: accountId } = usePageParams<{ account_id: string }>();

  const accountInfo$ = useObservable(() => useAccountInfo(accountId).pipe(throttleTime(100)));

  const accountInfo = useObservableState(accountInfo$);

  useObservableState(
    useObservable(() =>
      defer(() => Notification.requestPermission()).pipe(
        filter((x) => x === 'granted'),
        mergeMap(() =>
          useAccountInfo(accountId).pipe(
            //
            mergeMap((accountInfo) => mergeAccountInfoPositions(accountInfo)),
            mergeMap((accountInfo) => accountInfo.positions),
            groupBy((position) => position.product_id),
            mergeMap((groupByProductId) =>
              groupByProductId.pipe(
                groupBy((position) => position.direction),
                mergeMap((groupByVariant) =>
                  groupByVariant.pipe(
                    //
                    map((position) => position.volume),
                    pairwise(),
                    filter(([x, y]) => x !== y),
                    distinctUntilChanged(),
                    tap(([oldVolume, newVolume]) => {
                      if (Notification.permission === 'granted') {
                        const productId = groupByProductId.key;
                        const direction = groupByVariant.key;
                        new Notification('Position Changed', {
                          body: `Account: ${accountId}\n${productId}(${
                            direction === 'LONG' ? 'LONG' : 'SHORT'
                          }): ${oldVolume}->${newVolume}\n${formatTime(Date.now())}`,
                          // @ts-ignore
                          renotify: true,
                          tag: encodePath('AccountInfoPositionChange', accountId, productId, direction),
                        });
                      }
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  const positionSummary = useMemo(() => {
    let positionSummary: IPositionSummaryItem[] = [];
    {
      from(accountInfo?.positions || [])
        .pipe(
          groupBy((position) => position.product_id),
          mergeMap((group) =>
            group.pipe(
              groupBy((position) => position.direction),
              mergeMap((subGroup) =>
                subGroup.pipe(
                  mergeMap((position) => {
                    // return of(position);
                    if (!position.datasource_id) {
                      return of(position);
                    }
                    return combineLatest([
                      of(position),
                      useTickMemoized(position.datasource_id, position.product_id).pipe(
                        tap((tick) => {
                          position.interest_to_settle =
                            position.direction === 'LONG'
                              ? position.valuation * (Number(tick.interest_rate_long) ?? 0)
                              : position.direction === 'SHORT'
                              ? position.valuation * (Number(tick.interest_rate_short) ?? 0)
                              : 0;
                          position.settlement_scheduled_at = new Date(
                            tick.interest_rate_next_settled_at,
                          ).getTime();
                        }),
                        raceWith(
                          timer(5000).pipe(
                            map(
                              (x): IQuote => ({
                                datasource_id: position.datasource_id!,
                                product_id: position.product_id,
                                updated_at: formatTime(Date.now()),
                                last_price: '',
                                ask_price: '',
                                ask_volume: '',
                                bid_price: '',
                                bid_volume: '',
                                open_interest: '',
                                interest_rate_long: '',
                                interest_rate_short: '',
                                interest_rate_prev_settled_at: '',
                                interest_rate_next_settled_at: '',
                              }),
                            ),
                          ),
                        ),
                        first(),
                      ),
                    ]).pipe(map(([position, tick]) => position));
                  }),
                  reduce(
                    (acc: IPosition, cur: IPosition): IPosition => ({
                      ...acc,
                      volume: acc.volume + cur.volume,
                      free_volume: acc.free_volume + cur.free_volume,
                      position_price:
                        (acc.position_price * acc.volume + cur.position_price * cur.volume) /
                        (acc.volume + cur.volume),
                      floating_profit: acc.floating_profit + cur.floating_profit,
                      closable_price:
                        (acc.closable_price * acc.volume + cur.closable_price * cur.volume) /
                        (acc.volume + cur.volume),
                      valuation: acc.valuation + cur.valuation,
                      interest_to_settle: (acc.interest_to_settle || 0) + (cur.interest_to_settle || 0),
                      comment: '',
                    }),
                  ),
                ),
              ),
              toArray(),
              map((positions) => {
                const long: IPosition = positions.find((p) => p.direction === 'LONG') ?? {
                  position_id: '@long',
                  product_id: group.key,
                  volume: 0,
                  free_volume: 0,
                  closable_price: 0,
                  position_price: 0,
                  floating_profit: 0,
                  valuation: 0,
                };
                const short: IPosition = positions.find((p) => p.direction === 'SHORT') ?? {
                  position_id: '@short',
                  product_id: group.key,
                  volume: 0,
                  free_volume: 0,
                  closable_price: 0,
                  position_price: 0,
                  floating_profit: 0,
                  valuation: 0,
                };

                const net: IPosition = {
                  position_id: '@net',
                  product_id: group.key,
                  direction:
                    long.volume === short.volume
                      ? 'LOCKED'
                      : long.volume - short.volume > 0
                      ? 'LONG'
                      : 'SHORT',
                  volume: Math.abs(long.volume - short.volume),
                  free_volume: Math.abs(long.free_volume - short.free_volume),
                  position_price:
                    (long.position_price * long.volume - short.position_price * short.volume) /
                    (long.volume - short.volume),
                  closable_price:
                    (long.closable_price * long.volume - short.closable_price * short.volume) /
                    (long.volume - short.volume),
                  floating_profit: long.floating_profit + short.floating_profit,
                  valuation: long.valuation + short.valuation,
                  interest_to_settle: (long.interest_to_settle || 0) + (short.interest_to_settle || 0),
                };

                const res: IPositionSummaryItem = { product_id: group.key, long, short, net };
                return res;
              }),
            ),
          ),
          toArray(),
          map((x) => x.sort((a, b) => b.net.valuation - a.net.valuation)),
        )
        .subscribe((_x) => {
          positionSummary = _x;
        });
    }
    return positionSummary;
  }, [accountInfo?.positions]);

  const valuation = accountInfo?.positions.reduce((acc, cur) => acc + (cur.valuation || 0), 0) ?? 0;
  const actual_leverage =
    (accountInfo?.money.equity ?? 0) > 0 ? valuation / (accountInfo?.money.equity ?? 0) : NaN;

  const total_interest_to_settle =
    accountInfo?.positions.reduce((acc, cur) => acc + (cur.interest_to_settle || 0), 0) || 0;

  const updatedAt = accountInfo?.updated_at!;
  const renderedAt = Date.now();

  // const targetTerminalId = Object.entries(terminal?.terminalInfo.subscriptions ?? {}).find(([key, value]) =>
  //   value.includes(encodePath('AccountInfo', accountId)),
  // )?.[0];

  const columns = useMemo(() => createColumnsOfPositionSummaryItem(), []);

  const columnsOfPositions = useMemo(() => {
    const helper = createColumnHelper<IPosition>();
    return [
      helper.accessor('position_id', { header: () => '持仓ID' }),
      helper.accessor('product_id', {
        header: () => '品种',
        cell: (ctx) =>
          ctx.row.original.datasource_id ? (
            <InlineProductId
              datasource_id={ctx.row.original.datasource_id}
              product_id={ctx.row.original.product_id}
            />
          ) : (
            ctx.getValue()
          ),
      }),
      helper.accessor('account_id', {
        header: () => '账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue() || accountId} />,
      }),
      helper.accessor('base_currency', { header: () => '基础货币' }),
      helper.accessor('quote_currency', { header: () => '计价货币' }),
      helper.accessor((pos) => +(pos.size || 0), { id: 'size', header: () => '净持仓' }),
      helper.accessor('direction', { header: () => '方向' }),
      helper.accessor('volume', { header: () => '持仓量' }),
      helper.accessor('position_price', { header: () => '持仓价' }),
      helper.accessor('closable_price', { header: () => '现价' }),
      helper.accessor('floating_profit', { header: () => '盈亏' }),
      helper.accessor('valuation', { header: () => '估值' }),
      helper.accessor('liquidation_price', { header: () => '清算价' }),
      helper.accessor((position): number => (position.interest_to_settle || 0) / position.valuation, {
        id: 'interest_rate',
        header: () => '利率',
        cell: (ctx) => `${ctx.getValue() * 100}%`,
      }),
      helper.accessor('interest_to_settle', { header: () => '预计利息' }),
      helper.accessor('settlement_scheduled_at', {
        header: () => '计息时间',
        cell: (ctx) => formatTime(ctx.getValue()!),
      }),
      helper.accessor('comment', { header: () => '注释' }),
    ];
  }, []);

  const columnsOfOrders = useMemo(() => {
    const helper = createColumnHelper<IOrder>();
    return [
      helper.accessor('order_id', { header: () => '委托单号' }),
      helper.accessor('submit_at', {
        header: () => '提交时间',
        cell: (ctx) => <InlineTime time={ctx.getValue() || NaN} />,
      }),
      helper.accessor('product_id', { header: () => '委托品种' }),
      helper.accessor('order_type', { header: () => '委托类型' }),
      helper.accessor('order_direction', { header: () => '委托方向' }),
      helper.accessor('volume', { header: () => '委托量' }),
      helper.accessor('traded_volume', { header: () => '已成交量' }),
      helper.accessor('price', { header: () => '委托价' }),
      helper.accessor('comment', { header: () => '注释' }),
      helper.display({
        id: 'actions',
        header: () => '操作',
        cell: (ctx) => {
          const order = ctx.row.original;

          return (
            <Space>
              <Button
                icon={<IconClose />}
                onClick={async () => {
                  if (!terminal) return;
                  await terminal.client.requestForResponse('CancelOrder', order);
                }}
              ></Button>
            </Space>
          );
        },
      }),
    ];
  }, []);

  const columnsOfCurrencies = useMemo(() => {
    const helper = createColumnHelper<IAccountMoney>();
    return [
      helper.accessor('currency', { header: () => '货币' }),
      helper.accessor('equity', { header: () => '净值' }),
      helper.accessor('balance', { header: () => '余额' }),
      helper.accessor('profit', { header: () => '浮动盈亏' }),
      helper.accessor('used', { header: () => '已用保证金' }),
      helper.accessor('free', { header: () => '可用保证金' }),
      helper.display({
        id: 'profit_rate',
        header: () => '浮动收益率',
        cell: (ctx) => {
          const money = ctx.row.original;
          return `${((money.profit / money.balance) * 100).toFixed(2)}%`;
        },
      }),
      helper.display({
        id: 'margin_rate',
        header: () => '保证金使用率',
        cell: (ctx) => {
          const money = ctx.row.original;
          return `${((money.used / money.equity) * 100).toFixed(2)}%`;
        },
      }),
    ];
  }, []);

  return (
    <Space vertical align="start" style={{ padding: '1em', width: '100%', boxSizing: 'border-box' }}>
      <h3 style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>{accountId}</h3>
      <Typography.Text>
        最后更新时间: <InlineTime time={updatedAt} /> (Ping {renderedAt - updatedAt}ms){' '}
        {accountInfo ? null : <Spin />}
      </Typography.Text>
      {/* <InlineTerminalId terminal_id={targetTerminalId || ''} /> */}
      <Space>
        <Button
          icon={<IconTaskMoneyStroked />}
          onClick={async () => {
            //
            await executeCommand('Transfer', { credit_account_id: accountId });
          }}
        >
          转账
        </Button>
      </Space>

      {accountInfo && (
        <Descriptions
          align="center"
          size="small"
          row
          style={{ width: '100%' }}
          data={[
            {
              key: '净值',
              value: accountInfo.money.equity.toFixed(2) + ' ' + accountInfo.money.currency,
            },
            {
              key: '余额',
              value: accountInfo.money.balance.toFixed(2) + ' ' + accountInfo.money.currency,
            },
            {
              key: '浮动盈亏',
              value:
                accountInfo.positions.reduce((acc, cur) => acc + cur.floating_profit, 0) +
                ' ' +
                accountInfo.money.currency,
            },
            {
              key: '浮动收益率',
              value: `${((accountInfo.money.profit / accountInfo.money.balance) * 100).toFixed(2)}%`,
            },
            {
              key: '已用保证金',
              value: accountInfo.money.used.toFixed(2) + ' ' + accountInfo.money.currency,
            },
            {
              key: '可用保证金',
              value: accountInfo.money.free.toFixed(2) + ' ' + accountInfo.money.currency,
            },
            {
              key: '保证金使用率',
              value: `${((accountInfo.money.used / accountInfo.money.equity) * 100).toFixed(2)}%`,
            },
            {
              key: '头寸总估值',
              value: valuation.toFixed(2) + ' ' + accountInfo.money.currency,
            },
            {
              key: '实际杠杆',
              value: actual_leverage.toFixed(2) + 'x',
            },
            {
              key: '总预期利息',
              value: total_interest_to_settle.toFixed(2) + ' ' + accountInfo.money.currency,
            },
          ]}
        />
      )}
      <Collapse defaultActiveKey={'通货汇总'} style={{ width: '100%' }}>
        <Collapse.Panel header={`持仓汇总 (${positionSummary.length})`} itemKey="持仓汇总">
          <DataView data={positionSummary} columns={columns} />
        </Collapse.Panel>
        {accountInfo && (
          <Collapse.Panel header={`持仓细节 (${accountInfo.positions.length})`} itemKey="持仓细节">
            <DataView data={accountInfo?.positions ?? []} columns={columnsOfPositions} />
          </Collapse.Panel>
        )}
        {accountId.startsWith('TradeCopier') ? null : (
          <Collapse.Panel header={`跟单配置`} itemKey="跟单配置">
            <TradeCopierDetail account_id={accountId} />
          </Collapse.Panel>
        )}
        <Collapse.Panel header={`监控`} itemKey="监控">
          <div style={{ height: 400, width: '100%', overflow: 'hidden' }}>
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
        </Collapse.Panel>
      </Collapse>
    </Space>
  );
});
