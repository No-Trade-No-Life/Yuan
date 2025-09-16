import React, { useEffect, useRef, useState } from 'react';
import { registerPage } from '../Pages';
import { Interactive, Pages } from '../../modules';
import { firstValueFrom } from 'rxjs';
import { terminal$ } from '../Network';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { Button, Switch } from '../Interactive';
import { ITrade } from '@yuants/data-trade';
import { formatTime } from '@yuants/utils';
import { ColumnFilter, Table, Updater } from '@tanstack/react-table';
import { IconRefresh } from '@douyinfe/semi-icons';

const Toast = Interactive.Toast;

registerPage('Reconciliation', () => {
  const [mergeTrade, setMergeTrade] = useState(false);
  const [data, setData] = useState<ITrade[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [columnFiltersState, setColumnFilterState] = useState<ColumnFilter[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const tableRef = useRef<Table<ITrade>>();
  const fetchTradeData = async (page: number, pageSize: number, filterStates: ColumnFilter[]) => {
    try {
      const terminal = await firstValueFrom(terminal$);
      if (terminal) {
        const filteredStates = filterStates.filter(
          (item) => item.id === 'account_id' || item.id === 'product_id' || item.id === 'direction',
        );
        const sql = `select t.*, COUNT(*) OVER() AS total_count from trade t ${
          filteredStates.length > 0
            ? 'where ' +
              filteredStates
                .map((item) => `${item.id}=${item.value ? escapeSQL(item.value) : item.id}`)
                .join(' and ')
            : ''
        } order by created_at desc limit ${pageSize} offset ${page * pageSize}`;
        const result = await requestSQL<(ITrade & { total_count: number })[]>(terminal, sql);
        setData(result);
        result?.[0]?.total_count && setTotalCount(Number(result[0].total_count));
      }
    } catch (e) {
      console.log('获取交易数据失败', { e });
      Toast.error('获取交易数据失败');
    }
  };

  useEffect(() => {
    if (tableRef.current) {
      const originSetPageSize = tableRef.current.setPageSize;
      const originSetPageIndex = tableRef.current.setPageIndex;
      tableRef.current.setPageSize = (x: Updater<number>) => {
        originSetPageSize(x);
        setPageSize(x);
      };
      tableRef.current.setPageIndex = (x: Updater<number>) => {
        originSetPageIndex(x);
        setPage(x);
      };
    }
  }, []);

  useEffect(() => {
    fetchTradeData(page, pageSize, columnFiltersState);
  }, [page, pageSize, columnFiltersState]);

  return (
    <>
      <Modules.Interactive.DataView
        topSlot={
          <>
            按分钟合并：
            <Switch checked={mergeTrade} onChange={(v) => setMergeTrade(v)} />
            <Button
              icon={<IconRefresh />}
              onClick={() => fetchTradeData(page, pageSize, columnFiltersState)}
            />
          </>
        }
        tableRef={tableRef}
        data={data}
        manualPagination={true}
        pageCount={Math.ceil(totalCount / pageSize)}
        totalCount={totalCount}
        onColumnFiltersChange={setColumnFilterState}
        columnFilters={columnFiltersState}
        columns={[
          {
            header: 'Account',
            accessorKey: 'account_id',
            filterFn: () => true,
          },
          {
            header: 'Product',
            accessorKey: 'product_id',
            filterFn: () => true,
          },
          {
            header: 'Direction',
            accessorKey: 'direction',
            filterFn: () => true,
          },
          {
            header: 'Volume',
            accessorKey: 'traded_volume',
          },
          {
            header: 'Traded Price',
            accessorKey: 'traded_price',
          },
          {
            header: 'Traded Value',
            accessorKey: 'traded_value',
          },
          {
            header: 'Fee',
            accessorKey: 'fee',
          },
          {
            header: 'Fee Currency',
            accessorKey: 'fee_currency',
          },
          {
            header: 'Created At',
            accessorKey: 'created_at',
            accessorFn: (x) => formatTime(x.created_at ?? 0),
          },
        ]}
      />
    </>
  );
});
