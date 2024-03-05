import { IconInfoCircle } from '@douyinfe/semi-icons';
import { Collapse, Descriptions, Empty, Space, Table, Tooltip, Typography } from '@douyinfe/semi-ui';
import { encodePath, formatTime, mergeAccountInfoPositions } from '@yuants/data-model';
import { IPosition, OrderDirection, OrderType, PositionVariant } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import {
  defer,
  distinctUntilChanged,
  filter,
  from,
  groupBy,
  map,
  mergeMap,
  pairwise,
  reduce,
  tap,
  toArray,
} from 'rxjs';
import { registerPage, usePageParams } from '../Pages';
import { terminal$ } from '../Terminals';
import { useAccountInfo } from './model';

registerPage('AccountInfoPanel', () => {
  const terminal = useObservableState(terminal$);
  const { account_id: accountId } = usePageParams();

  const accountInfo$ = useObservable(() => useAccountInfo(accountId));

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
                groupBy((position) => position.variant),
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
                        const variant = groupByVariant.key;
                        new Notification('Position Changed', {
                          body: `Account: ${accountId}\n${productId}(${
                            variant === PositionVariant.LONG ? 'LONG' : 'SHORT'
                          }): ${oldVolume}->${newVolume}\n${formatTime(Date.now())}`,
                          renotify: true,
                          tag: encodePath('AccountInfoPositionChange', accountId, productId, variant),
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

  if (!accountInfo) {
    return <Empty title={'加载中'}></Empty>;
  }

  interface IPositionSummaryItem {
    product_id: string;
    long: IPosition;
    short: IPosition;
    net: IPosition;
  }

  let positionSummary: IPositionSummaryItem[] = [];
  {
    from(accountInfo.positions)
      .pipe(
        groupBy((position) => position.product_id),
        mergeMap((group) =>
          group.pipe(
            groupBy((position) => position.variant),
            mergeMap((subGroup) =>
              subGroup.pipe(
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
                    comment: '',
                  }),
                ),
              ),
            ),
            toArray(),
            map((positions) => {
              const long = positions.find((p) => p.variant === PositionVariant.LONG) ?? {
                position_id: '@long',
                product_id: group.key,
                variant: PositionVariant.LONG,
                volume: 0,
                free_volume: 0,
                closable_price: 0,
                position_price: 0,
                floating_profit: 0,
              };
              const short = positions.find((p) => p.variant === PositionVariant.SHORT) ?? {
                position_id: '@short',
                product_id: group.key,
                variant: PositionVariant.LONG,
                volume: 0,
                free_volume: 0,
                closable_price: 0,
                position_price: 0,
                floating_profit: 0,
              };

              const net: IPosition = {
                position_id: '@net',
                product_id: group.key,
                variant:
                  long.volume === short.volume
                    ? (-1 as PositionVariant)
                    : long.volume - short.volume > 0
                    ? PositionVariant.LONG
                    : PositionVariant.SHORT,
                volume: Math.abs(long.volume - short.volume),
                free_volume: Math.abs(long.free_volume - short.free_volume),
                position_price:
                  (long.position_price * long.volume - short.position_price * short.volume) /
                  (long.volume - short.volume),
                closable_price:
                  (long.closable_price * long.volume - short.closable_price * short.volume) /
                  (long.volume - short.volume),
                floating_profit: long.floating_profit + short.floating_profit,
              };

              const res: IPositionSummaryItem = { product_id: group.key, long, short, net };
              return res;
            }),
          ),
        ),
        toArray(),
      )
      .subscribe((_x) => {
        positionSummary = _x;
      });
  }

  const updatedAt = accountInfo.updated_at || accountInfo.timestamp_in_us / 1000;
  const renderedAt = Date.now();

  const targetTerminalId = Object.entries(terminal?.terminalInfo.subscriptions ?? {}).find(([key, value]) =>
    value.includes(encodePath('AccountInfo', accountId)),
  )?.[0];

  return (
    <Space vertical align="start" style={{ padding: '1em', width: '100%' }}>
      <h3 style={{ color: 'var(--semi-color-text-0)', fontWeight: 500 }}>{accountInfo.account_id}</h3>
      <Typography.Text>
        最后更新时间: {formatTime(updatedAt)} (Ping {renderedAt - updatedAt}ms)
      </Typography.Text>
      <Typography.Text copyable={{ content: targetTerminalId }}>终端ID: {targetTerminalId}</Typography.Text>
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
            key: '账户系统杠杆率',
            value: `${accountInfo.money.leverage ?? 1}x`,
          },
          {
            key: '实际杠杆率',
            value: `${(
              (accountInfo.money.used / accountInfo.money.equity) *
              (accountInfo.money.leverage ?? 1)
            ).toFixed(2)}x`,
          },
          {
            key: (
              <Space>
                保证金率{' '}
                <Tooltip content={'保证金率 < 100% 可能会被强制平仓'}>
                  <IconInfoCircle />
                </Tooltip>
              </Space>
            ),
            value: `${((accountInfo.money.equity / accountInfo.money.used) * 100).toFixed(2)}%`,
          },
        ]}
      />
      <Collapse defaultActiveKey={'持仓汇总'} style={{ width: '100%' }}>
        <Collapse.Panel header={`持仓汇总 (${positionSummary.length})`} itemKey="持仓汇总">
          <Table
            dataSource={positionSummary}
            pagination={false}
            columns={[
              { title: '持仓品种', render: (_, pos) => pos.product_id },
              {
                title: '方向',
                render: (_, pos) =>
                  (({ [PositionVariant.LONG]: '多', [PositionVariant.SHORT]: '空', [-1]: '对锁' } as any)[
                    pos.net.variant
                  ]),
              },
              {
                title: '持仓量',
                render: (_, pos) => (
                  <Space vertical align="start">
                    <div>净 {+pos.net.volume.toFixed(8)}</div>
                    <div>多 {+pos.long.volume.toFixed(8)}</div>
                    <div>空 {+pos.short.volume.toFixed(8)}</div>
                  </Space>
                ),
              },
              {
                title: '持仓价',
                render: (_, pos) => (
                  <Space vertical align="start">
                    <div>净 {+pos.net.position_price.toFixed(8)}</div>
                    <div>多 {+pos.long.position_price.toFixed(8)}</div>
                    <div>空 {+pos.short.position_price.toFixed(8)}</div>
                  </Space>
                ),
              },
              {
                title: '可平价',
                render: (_, pos) => (
                  <Space vertical align="start">
                    <div>全平 {+pos.net.closable_price.toFixed(8)}</div>
                    <div>平多 {+pos.long.closable_price.toFixed(8)}</div>
                    <div>平空 {+pos.short.closable_price.toFixed(8)}</div>
                  </Space>
                ),
              },
              {
                title: '浮动盈亏',
                render: (_, pos) => (
                  <Space vertical align="start">
                    <div>净 {+pos.net.floating_profit.toFixed(8)}</div>
                    <div>多 {+pos.long.floating_profit.toFixed(8)}</div>
                    <div>空 {+pos.short.floating_profit.toFixed(8)}</div>
                  </Space>
                ),
              },
              // ISSUE: 不计算点差，因为无法处理只有单边头寸的情况
              {
                title: (
                  <Space>
                    预估爆仓价{' '}
                    <Tooltip
                      content={'品种价格变化使得净值为零的预估价格，在抵达此价格前可能就会被交易所强制平仓'}
                    >
                      <IconInfoCircle />{' '}
                    </Tooltip>
                  </Space>
                ),
                render: (_, pos) => (
                  <Space vertical align="start">
                    <div>
                      净{' '}
                      {
                        +(
                          pos.net.closable_price -
                          (accountInfo.money.equity / pos.net.floating_profit) *
                            (pos.net.closable_price - pos.net.position_price)
                        ).toFixed(8)
                      }
                    </div>
                    <div>
                      多{' '}
                      {
                        +(
                          pos.long.closable_price -
                          (accountInfo.money.equity / pos.long.floating_profit) *
                            (pos.long.closable_price - pos.long.position_price)
                        ).toFixed(8)
                      }
                    </div>
                    <div>
                      空{' '}
                      {
                        +(
                          pos.short.closable_price -
                          (accountInfo.money.equity / pos.short.floating_profit) *
                            (pos.short.closable_price - pos.short.position_price)
                        ).toFixed(8)
                      }
                    </div>
                  </Space>
                ),
              },
            ]}
          />
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
                render: (_, pos) =>
                  (({ [PositionVariant.LONG]: '做多', [PositionVariant.SHORT]: '做空' } as any)[pos.variant]),
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
              { title: '委托单号', render: (_, order) => order.exchange_order_id },
              {
                title: '更新时间',
                render: (_, order) => formatTime(order.submit_at || order.timestamp_in_us! / 1000),
              },
              { title: '委托品种', render: (_, order) => order.product_id },
              {
                title: '委托类型',
                render: (_, order) =>
                  ((
                    {
                      [OrderType.LIMIT]: '限价单',
                      [OrderType.STOP]: '止损单',
                      [OrderType.IOC]: '即成余撤单',
                      [OrderType.FOK]: '全成或撤单',
                      [OrderType.MARKET]: '市价单',
                    } as any
                  )[order.type]),
              },
              {
                title: '委托方向',
                render: (_, order) =>
                  ((
                    {
                      [OrderDirection.OPEN_LONG]: '开多',
                      [OrderDirection.OPEN_SHORT]: '开空',
                      [OrderDirection.CLOSE_LONG]: '平多',
                      [OrderDirection.CLOSE_SHORT]: '平空',
                    } as any
                  )[order.direction]),
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
            ]}
          />
        </Collapse.Panel>
      </Collapse>
    </Space>
  );
});
