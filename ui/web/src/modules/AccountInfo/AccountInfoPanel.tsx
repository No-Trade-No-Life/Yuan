import { IconTaskMoneyStroked } from '@douyinfe/semi-icons';
import { Collapse, Descriptions, Space, Spin, Typography } from '@douyinfe/semi-ui';
import { IPosition, mergeAccountInfoPositions } from '@yuants/data-account';
import { encodePath, formatTime } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import {
  defer,
  distinctUntilChanged,
  filter,
  groupBy,
  map,
  mergeMap,
  pairwise,
  tap,
  throttleTime,
} from 'rxjs';
import { TimeSeriesChart } from '../Chart/components/TimeSeriesChart';
import { executeCommand } from '../CommandCenter';
import { Button, DataView, InlineTime } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';
import { InlineProductId } from '../Products/InlineProductId';
import { TradeCopierDetail } from '../TradeCopier';
import { InlineAccountId } from './InlineAccountId';
import { useAccountInfo } from './model';

registerPage('AccountInfoPanel', () => {
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

  const valuation = accountInfo?.positions.reduce((acc, cur) => acc + (cur.valuation || 0), 0) ?? 0;
  const net_notional = accountInfo?.positions.reduce((acc, cur) => acc + +(cur.notional || 0), 0) ?? 0;
  const actual_leverage =
    (accountInfo?.money.equity ?? 0) > 0 ? valuation / (accountInfo?.money.equity ?? 0) : NaN;

  const total_interest_to_settle =
    accountInfo?.positions.reduce((acc, cur) => acc + (cur.interest_to_settle || 0), 0) || 0;

  const updatedAt = accountInfo?.updated_at!;
  const renderedAt = Date.now();

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
              value: accountInfo.money.equity.toFixed(2),
            },
            {
              key: '头寸总估值',
              value: valuation.toFixed(2),
            },
            {
              key: '净名义价值',
              value: net_notional.toFixed(2),
            },
            {
              key: '实际杠杆',
              value: actual_leverage.toFixed(2) + 'x',
            },
            {
              key: '总预期利息',
              value: total_interest_to_settle.toFixed(2),
            },
          ]}
        />
      )}
      <Collapse defaultActiveKey={'通货汇总'} style={{ width: '100%' }}>
        <Collapse.Panel header={`持仓细节 (${accountInfo?.positions.length ?? 0})`} itemKey="持仓细节">
          <DataView
            data={accountInfo?.positions}
            columns={[
              {
                accessorKey: 'position_id',
                header: '持仓ID',
              },
              {
                accessorKey: 'product_id',
                header: '品种',
                cell: (info) => <InlineProductId product_id={info.getValue()} />,
              },
              {
                accessorKey: 'account_id',
                header: '账户',
                cell: (info) => <InlineAccountId account_id={info.getValue() || accountId} />,
              },
              {
                accessorKey: 'base_currency',
                header: '基础货币',
              },
              {
                accessorKey: 'quote_currency',
                header: '计价货币',
              },
              {
                id: 'size',
                accessorFn: (pos: IPosition) => +(pos.size || 0),
                header: '净持仓',
              },
              {
                accessorKey: 'direction',
                header: '方向',
              },
              {
                accessorKey: 'volume',
                header: '持仓量',
              },
              {
                accessorKey: 'position_price',
                header: '持仓价',
              },
              {
                accessorKey: 'closable_price',
                header: '可平价',
              },
              {
                accessorKey: 'floating_profit',
                header: '盈亏',
              },
              {
                accessorKey: 'valuation',
                header: '估值',
              },
              {
                accessorKey: 'current_price',
                header: '当前价',
              },
              {
                id: 'notional',
                accessorFn: (pos: IPosition) => +(pos.notional || 0),
                header: '名义价值',
              },
              {
                accessorKey: 'liquidation_price',
                header: '清算价',
              },
              {
                accessorKey: 'interest_to_settle',
                header: '预期利息',
              },
              {
                accessorKey: 'settlement_interval',
                header: '利息周期',
              },
              {
                accessorKey: 'settlement_scheduled_at',
                header: '计息时间',
                cell: (info) => formatTime(info.getValue()!),
              },
              {
                accessorKey: 'comment',
                header: '注释',
              },
            ]}
          />
        </Collapse.Panel>
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
