import { ColumnFilter, Table, Updater } from '@tanstack/react-table';
import { ITrade } from '@yuants/data-trade';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useObservable, useObservableState } from 'observable-hooks';
import { combineLatestWith, defer, pipe, repeat, retry, switchMap, timer } from 'rxjs';
import { DataView, Switch } from '../Interactive';
import { terminal$ } from '../Terminals';

const resolveUpdaterValue = (updater: Updater<number>, previous: number) =>
  typeof updater === 'function' ? updater(previous) : updater;

interface Props {
  accountId: string;
  setDrawOrders: (v: boolean) => void;
  drawOrders: boolean;
}

export const TradeInfo = React.memo((props: Props) => {
  const { accountId, setDrawOrders, drawOrders } = props;
  const [tradePage, setTradePage] = useState(0);
  const [tradePageSize, setTradePageSize] = useState(10);
  const [tradeFilters, setTradeFilters] = useState<ColumnFilter[]>([]);
  const tradeTableRef = useRef<Table<ITrade>>();

  useEffect(() => {
    const table = tradeTableRef.current;
    if (!table) return;
    const originSetPageSize = table.setPageSize;
    const originSetPageIndex = table.setPageIndex;
    table.setPageSize = (updater) => {
      originSetPageSize(updater);
      setTradePageSize((prev) => resolveUpdaterValue(updater, prev));
    };
    table.setPageIndex = (updater) => {
      originSetPageIndex(updater);
      setTradePage((prev) => resolveUpdaterValue(updater, prev));
    };
    return () => {
      table.setPageSize = originSetPageSize;
      table.setPageIndex = originSetPageIndex;
    };
  }, []);

  const tradeState = useObservableState(
    useObservable(
      pipe(
        combineLatestWith(terminal$),
        switchMap(([[accountId, tradePage, tradePageSize, tradeFilters], terminal]) =>
          defer(async () => {
            if (!terminal || !accountId) return { data: [] as ITrade[], totalCount: 0 };
            const filteredStates = tradeFilters.filter(
              (item) => item.id === 'product_id' || item.id === 'direction',
            );
            const conditions: string[] = [`t.account_id = ${escapeSQL(accountId)}`];
            for (const item of filteredStates) {
              if (!item.value) continue;
              conditions.push(`t.${item.id} = ${escapeSQL(String(item.value))}`);
            }
            const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
            const sql = `select t.*, COUNT(*) OVER() AS total_count from trade t ${whereClause} order by created_at desc limit ${tradePageSize} offset ${
              tradePage * tradePageSize
            }`;

            const result = await requestSQL<(ITrade & { total_count: number })[]>(terminal, sql);
            const totalCount =
              result && result[0]?.total_count ? Number(result[0].total_count) : result?.length ?? 0;
            return { data: result ?? [], totalCount };
          }).pipe(
            //
            retry({ delay: 5_000 }),
            repeat({ delay: 3_000 }),
          ),
        ),
      ),
      [accountId, tradePage, tradePageSize, tradeFilters],
    ),
    { data: [] as ITrade[], totalCount: 0 },
  );

  useEffect(() => {
    tradeTableRef.current?.setPageIndex(0);
  }, [props.accountId]);

  const tradeColumns = useMemo(
    () => [
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
        accessorFn: (x: ITrade) => formatTime(x.created_at ?? 0),
      },
    ],
    [],
  );

  return (
    <DataView
      tableRef={tradeTableRef}
      data={tradeState.data}
      manualPagination
      pageCount={tradePageSize ? Math.ceil(tradeState.totalCount / tradePageSize) : 0}
      totalCount={tradeState.totalCount}
      columns={tradeColumns}
      onColumnFiltersChange={setTradeFilters}
      columnFilters={tradeFilters}
      topSlot={
        <>
          标记订单
          <Switch onChange={setDrawOrders} checked={drawOrders} />
        </>
      }
    />
  );
});
