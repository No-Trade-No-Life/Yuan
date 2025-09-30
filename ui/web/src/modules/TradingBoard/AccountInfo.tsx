import { Space, Tabs } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IAccountInfo, IPosition } from '@yuants/data-account';
import { formatTime } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import { of } from 'rxjs';
import { InlineAccountId, useAccountInfo } from '../AccountInfo';
import { DataView } from '../Interactive';
import { InlineProductId } from '../Products/InlineProductId';
import { TradeInfo } from './TradeInfo';
import { PendingOrderInfo } from './PendingOrderInfo';
import { NAVCurve } from './NAVCurve';

const { TabPane } = Tabs;

const createPositionColumns = (accountId: string) => {
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
    helper.accessor('direction', { header: () => '方向' }),
    helper.accessor('volume', { header: () => '持仓量' }),
    helper.accessor('position_price', { header: () => '持仓价' }),
    helper.accessor('closable_price', { header: () => '现价' }),
    helper.accessor('floating_profit', { header: () => '盈亏' }),
    helper.accessor('valuation', { header: () => '估值' }),
    helper.accessor(
      (position): number => {
        const interestToSettle = position.interest_to_settle || 0;
        const valuation = position.valuation || 0;
        return valuation === 0 ? 0 : interestToSettle / valuation;
      },
      {
        id: 'interest_rate',
        header: () => '利率',
        cell: (ctx) => `${(ctx.getValue() * 100).toFixed(2)}%`,
      },
    ),
    helper.accessor('interest_to_settle', { header: () => '预计利息' }),
    helper.accessor('settlement_scheduled_at', {
      header: () => '计息时间',
      cell: (ctx) => {
        const value = ctx.getValue();
        return value ? formatTime(value) : '-';
      },
    }),
    helper.accessor('comment', { header: () => '注释' }),
  ];
};

export const AccountInfo = (props: { accountId: string; accountInfo?: IAccountInfo }) => {
  const { accountId, accountInfo } = props;

  const positionColumns = useMemo(() => createPositionColumns(accountId ?? ''), [accountId]);

  const [pendingOrderNumber, setPendingOrderNumber] = useState(0);

  return (
    <div style={{ width: '100%', height: '100%', padding: '0 8px', boxSizing: 'border-box' }}>
      <Tabs
        type="line"
        lazyRender
        style={{
          width: '100%',
          height: '100%',
          // 使得 TabContent 容器高度自适应， 并且 overflow 不会影响到 TabList
          display: 'flex',
          flexDirection: 'column',
        }}
        contentStyle={{ flex: 1, overflowY: 'auto' }}
      >
        <TabPane
          tab={
            <>
              持仓
              {accountInfo?.positions?.length && accountInfo?.positions?.length > 0 ? (
                <span style={{ color: 'green' }}>({accountInfo.positions.length})</span>
              ) : null}
            </>
          }
          itemKey="positions"
        >
          <DataView data={accountInfo?.positions ?? []} columns={positionColumns} />
        </TabPane>
        <TabPane tab="成交" itemKey="trades">
          <TradeInfo accountId={accountId} />
        </TabPane>
        <TabPane
          tab={
            <>
              挂单
              {pendingOrderNumber > 0 ? <span style={{ color: 'green' }}>({pendingOrderNumber})</span> : null}
            </>
          }
          itemKey="orders"
        >
          <PendingOrderInfo accountId={accountId} pendingOrderNumberChange={setPendingOrderNumber} />
        </TabPane>
        <TabPane tab="净值曲线" itemKey="nav_curve" style={{ height: '100%', flex: '1' }}>
          <NAVCurve accountId={accountId} />
        </TabPane>
      </Tabs>
    </div>
  );
};
