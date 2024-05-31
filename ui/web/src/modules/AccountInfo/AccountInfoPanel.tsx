import { IconClose, IconTaskMoneyStroked } from '@douyinfe/semi-icons';
import { Collapse, Descriptions, Empty, Space, Table, Typography } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ITick, encodePath, formatTime, mergeAccountInfoPositions } from '@yuants/data-model';
import { IPosition } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import {
  combineLatest,
  defer,
  distinctUntilChanged,
  filter,
  first,
  firstValueFrom,
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
import { executeCommand } from '../CommandCenter';
import { Button, DataView } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';
import { terminal$, useTick } from '../Terminals';
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
  const { account_id: accountId } = usePageParams();

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
                        raceWith(
                          timer(5000).pipe(
                            map(
                              (x): ITick => ({
                                datasource_id: position.datasource_id!,
                                product_id: position.product_id,
                                updated_at: Date.now(),
                              }),
                            ),
                          ),
                        ),
                        first(),
                      ),
                    ]).pipe(
                      map(([position, tick]) => ({
                        ...position,
                        settlement_scheduled_at: tick.settlement_scheduled_at,
                        interest_to_settle:
                          position.direction === 'LONG'
                            ? position.valuation * (tick.interest_rate_for_long ?? 0)
                            : position.direction === 'SHORT'
                            ? position.valuation * (tick.interest_rate_for_short ?? 0)
                            : 0,
                      })),
                    );
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

  const total_interest_to_settle = positionSummary.reduce(
    (acc, cur) => acc + (cur.net.interest_to_settle || 0),
    0,
  );

  const updatedAt = accountInfo?.updated_at!;
  const renderedAt = Date.now();

  const targetTerminalId = Object.entries(terminal?.terminalInfo.subscriptions ?? {}).find(([key, value]) =>
    value.includes(encodePath('AccountInfo', accountId)),
  )?.[0];

  const columns = useMemo(() => createColumnsOfPositionSummaryItem(), []);

  const tableOfPositionSummary = useReactTable({
    data: positionSummary,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!accountInfo) {
    return <Empty title={'加载中'}></Empty>;
  }

  return (
    <Space vertical align="start" style={{ padding: '1em', width: '100%' }}>
      <h3 style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>{accountInfo.account_id}</h3>
      <Typography.Text>
        最后更新时间: {formatTime(updatedAt)} (Ping {renderedAt - updatedAt}ms)
      </Typography.Text>
      <Typography.Text copyable={{ content: targetTerminalId }}>终端ID: {targetTerminalId}</Typography.Text>
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
            value: accountInfo.money.profit.toFixed(2) + ' ' + accountInfo.money.currency,
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
      <Collapse defaultActiveKey={'持仓汇总'} style={{ width: '100%' }}>
        <Collapse.Panel header={`持仓汇总 (${positionSummary.length})`} itemKey="持仓汇总">
          <DataView table={tableOfPositionSummary} />
        </Collapse.Panel>
        <Collapse.Panel header={`持仓细节 (${accountInfo.positions.length})`} itemKey="持仓细节">
          <Table
            dataSource={accountInfo.positions}
            pagination={false}
            columns={[
              {
                title: 'ID',
                render: (_, pos) => pos.position_id,
              },
              { title: '持仓品种', render: (_, pos) => pos.product_id },
              {
                title: '持仓方向',
                render: (_, pos) => (({ ['LONG']: '做多', ['SHORT']: '做空' } as any)[pos.direction!]),
              },
              { title: '持仓量', render: (_, pos) => +pos.volume.toFixed(8) },
              {
                title: '持仓价',
                render: (_, pos) => +pos.position_price.toFixed(8),
              },
              { title: '现价', render: (_, pos) => +pos.closable_price?.toFixed(8) },
              {
                title: '盈亏',
                render: (_, pos) => +pos.floating_profit?.toFixed(8),
              },
              {
                title: '估值',
                render: (_, pos) => +pos.valuation?.toFixed(8),
              },
              {
                title: '注释',
                render: (_, pos) => pos.comment,
              },
            ]}
          />
        </Collapse.Panel>
        <Collapse.Panel header={`订单 (${accountInfo.orders.length})`} itemKey="订单">
          <Table
            dataSource={accountInfo.orders}
            pagination={false}
            columns={[
              { title: '委托单号', render: (_, order) => order.order_id },
              {
                title: '更新时间',
                render: (_, order) => formatTime(order.submit_at!),
              },
              { title: '委托品种', render: (_, order) => order.product_id },
              {
                title: '委托类型',
                render: (_, order) => order.order_type,
              },
              {
                title: '委托方向',
                render: (_, order) => order.order_direction,
              },
              { title: '委托量', render: (_, order) => +order.volume.toFixed(8) },
              { title: '已成交量', render: (_, order) => +(order.traded_volume ?? 0).toFixed(8) },
              {
                title: '委托价',
                render: (_, order) => +(order.price?.toFixed(8) ?? 0) ?? '',
              },
              {
                title: '注释',
                render: (_, order) => order.comment,
              },
              {
                title: '操作',
                render: (_, order) => (
                  <Space>
                    <Button
                      icon={<IconClose />}
                      onClick={async () => {
                        if (!terminal) return;
                        await firstValueFrom(terminal.cancelOrder(order));
                      }}
                    ></Button>
                  </Space>
                ),
              },
            ]}
          />
        </Collapse.Panel>
      </Collapse>
    </Space>
  );
});
