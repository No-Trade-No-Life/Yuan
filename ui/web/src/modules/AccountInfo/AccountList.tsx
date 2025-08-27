import { requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import { defer, EMPTY, repeat, retry, switchMap } from 'rxjs';
import { DataView } from '../Interactive';
import { terminal$ } from '../Network';
import { registerPage } from '../Pages';
import { InlineAccountId } from './InlineAccountId';

registerPage('AccountList', () => {
  const accountInfos = useObservableState(
    useObservable(
      () =>
        terminal$.pipe(
          switchMap((terminal) =>
            terminal
              ? defer(() =>
                  requestSQL<
                    {
                      account_id: string;
                      currency: string;
                      balance: string;
                      equity: string;
                      profit: string;
                      free: string;
                      used: string;
                    }[]
                  >(terminal, `select * from account_balance order by account_id`),
                ).pipe(
                  //
                  retry({ delay: 10_000 }),
                  repeat({ delay: 10_000 }),
                )
              : EMPTY,
          ),
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
          accessorKey: 'account_id',
          header: '账户 ID',
          cell: (x) => <InlineAccountId account_id={x.getValue()} />,
        },
        {
          accessorKey: 'currency',
          header: '货币',
        },
        {
          accessorKey: 'equity',
          header: '净值',
        },
        {
          accessorKey: 'balance',
          header: '余额',
        },
        {
          accessorKey: 'profit',
          header: '盈亏',
        },
        {
          accessorKey: 'free',
          header: '可用保证金',
        },
        {
          accessorKey: 'used',
          header: '已用保证金',
        },
        {
          id: 'used-margin-ratio',
          accessorFn: (x) => {
            return +x.used / +x.equity;
          },
          header: '保证金使用率',
          cell: (x) => {
            const v = x.getValue();
            if (isNaN(v)) return 'N/A';
            return `${(x.getValue() * 100).toFixed(2)}%`;
          },
        },
        {
          accessorKey: 'updated_at',
          header: '更新时间',
          cell: (x) => formatTime(x.getValue()),
        },
      ]}
    />
  );
});
