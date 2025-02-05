import { Button, Typography } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/data-model';
import { useObservable, useObservableState } from 'observable-hooks';
import { combineLatest, concatWith, from, map, mergeMap, of, switchMap, throttleTime, toArray } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { accountIds$, useAccountInfo } from './model';

registerPage('AccountList', () => {
  const accountInfos = useObservableState(
    useObservable(
      () =>
        accountIds$.pipe(
          switchMap((accountIds) =>
            from(accountIds).pipe(
              //
              map((accountId) =>
                of(undefined).pipe(
                  concatWith(useAccountInfo(accountId)),
                  map((info) => ({ accountId, info })),
                ),
              ),
              toArray(),
              mergeMap((x$) => combineLatest(x$)),
            ),
          ),
          throttleTime(1000),
        ),
      [],
    ),
    [],
  );

  return (
    <DataView
      data={accountInfos}
      columns={[
        {
          accessorKey: 'accountId',
          header: () => '账户 ID',
          cell: (x) => <Typography.Text copyable>{x.renderValue()}</Typography.Text>,
        },
        {
          accessorKey: 'info.money.currency',
          header: () => '货币',
        },
        {
          accessorKey: 'info.money.equity',
          header: () => '净值',
        },
        {
          accessorKey: 'info.money.balance',
          header: () => '余额',
        },
        {
          accessorKey: 'info.money.profit',
          header: () => '盈亏',
        },
        {
          accessorKey: 'info.money.free',
          header: () => '可用保证金',
        },
        {
          id: 'used-margin-ratio',
          accessorFn: (x) => {
            const accountInfo = x.info;
            if (!accountInfo) return NaN;
            return accountInfo.money.used / accountInfo.money.equity;
          },
          header: () => '保证金使用率',
          cell: (x) => {
            const v = x.getValue();
            if (isNaN(v)) return 'N/A';
            return `${(x.getValue() * 100).toFixed(2)}%`;
          },
        },
        {
          accessorKey: 'info.updated_at',
          header: () => '更新时间',
          cell: (x) => formatTime(x.getValue()),
        },

        {
          header: '操作',
          cell: (x) => {
            return (
              <Button
                onClick={() => executeCommand('AccountInfoPanel', { account_id: x.row.original.accountId })}
              >
                查看
              </Button>
            );
          },
        },
      ]}
    />
  );
});
