import { Space, Spin, Typography } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { formatTime } from '@yuants/data-model';
import { useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { executeCommand } from '../CommandCenter';
import { Button, DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { accountIds$, useAccountInfo } from './model';

registerPage('AccountList', () => {
  const accountIds = useObservableState(accountIds$, []);

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<string>();
    return [
      columnHelper.accessor((x) => x, {
        id: 'account_id',
        header: () => '账户 ID',
        cell: (x) => <Typography.Text copyable>{x.renderValue()}</Typography.Text>,
      }),
      columnHelper.accessor((x) => x, {
        id: 'currency',
        header: () => '货币',
        cell: (x) => {
          const account_id = x.row.original;
          const accountInfo$ = useMemo(() => useAccountInfo(account_id), [account_id]);
          const accountInfo = useObservableState(accountInfo$);

          return accountInfo?.money.currency;
        },
      }),
      columnHelper.accessor((x) => x, {
        id: 'equity',
        header: () => '净值',
        cell: (x) => {
          const account_id = x.row.original;
          const accountInfo$ = useMemo(() => useAccountInfo(account_id), [account_id]);
          const accountInfo = useObservableState(accountInfo$);

          return accountInfo?.money.equity;
        },
      }),
      columnHelper.accessor((x) => x, {
        id: 'balance',
        header: () => '余额',
        cell: (x) => {
          const account_id = x.row.original;
          const accountInfo$ = useMemo(() => useAccountInfo(account_id), [account_id]);
          const accountInfo = useObservableState(accountInfo$);

          return accountInfo?.money.balance;
        },
      }),
      columnHelper.accessor((x) => x, {
        id: 'profit',
        header: () => '盈亏',
        cell: (x) => {
          const account_id = x.row.original;
          const accountInfo$ = useMemo(() => useAccountInfo(account_id), [account_id]);
          const accountInfo = useObservableState(accountInfo$);

          return accountInfo?.money.profit;
        },
      }),
      columnHelper.accessor((x) => x, {
        id: 'used-margin-ratio',
        header: () => '保证金使用率',
        cell: (x) => {
          const account_id = x.row.original;
          const accountInfo$ = useMemo(() => useAccountInfo(account_id), [account_id]);
          const accountInfo = useObservableState(accountInfo$);

          if (!accountInfo) return null;

          const value = (accountInfo.money.used / accountInfo.money.equity) * 100;
          if (Number.isNaN(value)) return 'N/A';

          return value.toFixed(2) + '%';
        },
      }),
      columnHelper.accessor((x) => x, {
        id: 'time',
        header: () => '更新时间',
        cell: (x) => {
          const account_id = x.row.original;
          const accountInfo$ = useMemo(() => useAccountInfo(account_id), [account_id]);
          const accountInfo = useObservableState(accountInfo$);

          if (!accountInfo) return <Spin />;

          const updated_at = accountInfo.updated_at || (accountInfo.timestamp_in_us ?? NaN) / 1000;
          const timeLag = Date.now() - updated_at;

          return (
            <Space>
              {formatTime(updated_at)}
              {timeLag > 60_000 && (
                <Typography.Text type="warning">
                  信息更新于 {formatTime(accountInfo.updated_at!)}，已经 {(timeLag / 1000).toFixed(0)}{' '}
                  秒未更新，可能已经失去响应
                </Typography.Text>
              )}
            </Space>
          );
        },
      }),
      columnHelper.accessor((x) => x, {
        id: 'actions',
        header: () => '操作',
        cell: (x) => {
          const account_id = x.row.original;
          return <Button onClick={() => executeCommand('AccountInfoPanel', { account_id })}>详情</Button>;
        },
      }),
    ];
  }, []);

  const data = accountIds;

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return <DataView table={table} />;
});
