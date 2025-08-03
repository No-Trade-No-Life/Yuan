import { StockMarket } from '@icon-park/react';
import { ColumnFiltersState } from '@tanstack/react-table';
import { IProduct } from '@yuants/data-product';
import { escape, requestSQL } from '@yuants/sql';
import { useObservableState } from 'observable-hooks';
import { BehaviorSubject, combineLatest, debounceTime, defer, of, switchMap } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { Button, DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';

const refresh$ = new BehaviorSubject<void>(undefined);
const filterState$ = new BehaviorSubject<ColumnFiltersState>([]);

const data$ = defer(() =>
  terminal$.pipe(
    switchMap((terminal) =>
      terminal
        ? combineLatest([filterState$, refresh$]).pipe(
            debounceTime(100),
            switchMap(([filterState]) => {
              const sql = `select * from product ${
                filterState.length > 0
                  ? `where ${filterState.map((x) => `${x.id} LIKE ${escape(`%${x.value}%`)}`).join(' AND ')}`
                  : ''
              } limit 200`;
              // console.info('ProductList SQL:', sql);
              return requestSQL<IProduct[]>(terminal, sql);
            }),
          )
        : of(undefined),
    ),
  ),
);

registerPage('ProductList', () => {
  const data = useObservableState(data$);
  const filterState = useObservableState(filterState$);
  return (
    <DataView
      data={data}
      columnFilters={filterState}
      onColumnFiltersChange={(updater) => {
        filterState$.next(updater instanceof Function ? updater(filterState$.value) : updater);
      }}
      columns={[
        { header: '数据源ID', accessorKey: 'datasource_id' },
        {
          header: '品种ID',
          accessorKey: 'product_id',
        },
        { header: '品种名称', accessorKey: 'name' },
        { header: '计价货币', accessorKey: 'quote_currency' },
        { header: '基准货币', accessorKey: 'base_currency' },
        {
          header: '价值尺度',
          enableColumnFilter: false,
          cell: (ctx) => {
            const item = ctx.row.original;
            return item.value_scale + (item.value_scale_unit || 'x');
          },
        },
        { header: '成交量粒度', accessorKey: 'volume_step', enableColumnFilter: false },
        { header: '报价粒度', accessorKey: 'price_step', enableColumnFilter: false },
        {
          header: '操作',
          cell: (ctx) => {
            const item = ctx.row.original;
            return (
              <Button
                icon={<StockMarket />}
                onClick={() =>
                  executeCommand('Market', {
                    datasource_id: item.datasource_id,
                    product_id: item.product_id,
                  })
                }
              ></Button>
            );
          },
        },
      ]}
    />
  );
});
