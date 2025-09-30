import { IconRefresh } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import { ColumnFilter, Table, Updater } from '@tanstack/react-table';
import { ITrade } from '@yuants/data-trade';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { firstValueFrom } from 'rxjs';
import { DataView, Toast } from '../Interactive';
import { terminal$ } from '../Terminals';

const resolveUpdaterValue = (updater: Updater<number>, previous: number) =>
  typeof updater === 'function' ? updater(previous) : updater;

export const TradeInfo = (props: { accountId?: string }) => {
  const [tradeData, setTradeData] = useState<ITrade[]>([]);
  const [tradePage, setTradePage] = useState(0);
  const [tradePageSize, setTradePageSize] = useState(10);
  const [tradeTotalCount, setTradeTotalCount] = useState(0);
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
  });

  const fetchTradeData = useCallback(
    async (page: number, pageSize: number, filters: ColumnFilter[]) => {
      if (!props.accountId) {
        setTradeData([]);
        setTradeTotalCount(0);
        return;
      }
      try {
        const terminal = await firstValueFrom(terminal$);
        if (!terminal) return;
        const filteredStates = filters.filter((item) => item.id === 'product_id' || item.id === 'direction');
        const conditions: string[] = [`t.account_id = ${escapeSQL(props.accountId)}`];
        for (const item of filteredStates) {
          if (!item.value) continue;
          conditions.push(`t.${item.id} = ${escapeSQL(String(item.value))}`);
        }
        const whereClause = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
        const sql = `select t.*, COUNT(*) OVER() AS total_count from trade t ${whereClause} order by created_at desc limit ${pageSize} offset ${
          page * pageSize
        }`;
        const result = await requestSQL<(ITrade & { total_count: number })[]>(terminal, sql);
        setTradeData(result ?? []);
        if (result && result[0]?.total_count) {
          setTradeTotalCount(Number(result[0].total_count));
        } else {
          setTradeTotalCount(result?.length ?? 0);
        }
      } catch (error) {
        console.log('获取交易数据失败', { error });
        Toast.error('获取交易数据失败');
      }
    },
    [props.accountId],
  );

  useEffect(() => {
    if (!props.accountId) {
      setTradePage(0);
      setTradePageSize(10);
      setTradeFilters([]);
      setTradeData([]);
      setTradeTotalCount(0);
      return;
    }
    fetchTradeData(tradePage, tradePageSize, tradeFilters);
  }, [props.accountId, tradePage, tradePageSize, tradeFilters, fetchTradeData]);

  useEffect(() => {
    if (!props.accountId) return;
    setTradePage(0);
    setTradeFilters([]);
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
      topSlot={
        <Button
          icon={<IconRefresh />}
          onClick={() => fetchTradeData(tradePage, tradePageSize, tradeFilters)}
        />
      }
      tableRef={tradeTableRef}
      data={tradeData}
      manualPagination
      pageCount={tradePageSize ? Math.ceil(tradeTotalCount / tradePageSize) : 0}
      totalCount={tradeTotalCount}
      columns={tradeColumns}
      onColumnFiltersChange={setTradeFilters}
      columnFilters={tradeFilters}
    />
  );
};
