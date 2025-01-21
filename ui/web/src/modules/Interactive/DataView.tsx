import { Pagination, Radio, RadioGroup } from '@douyinfe/semi-ui';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  OnChangeFn,
  SortingState,
  Table,
  TableOptions,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ListView } from './ListView';
import { TableView } from './TableView';

export function DataView<T, K>(props: {
  data: T[];
  columns: ColumnDef<T, any>[];
  columnsDependencyList?: any[];
  initialSorting?: SortingState;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
  tableRef?: React.MutableRefObject<Table<T> | undefined>;
  layoutMode?: 'table' | 'list' | 'auto';
  topSlot?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ISSUE: if columns is not memoized, there's a bug to refresh columns
  const columns = useMemo(() => props.columns, props.columnsDependencyList ?? []);

  const tableOptions: TableOptions<T> = {
    data: props.data,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    autoResetExpanded: false,
    manualSorting: props.manualSorting,
  };

  // ISSUE: if tableOptions.onSortingChange is set to undefined, there's a bug
  if (props.onSortingChange) {
    tableOptions.onSortingChange = props.onSortingChange;
  }

  if (props.sorting) {
    (tableOptions.state ??= {}).sorting = props.sorting;
  }

  if (props.initialSorting) {
    (tableOptions.initialState ??= {}).sorting = props.initialSorting;
  }

  const table = useReactTable(tableOptions);

  useEffect(() => {
    if (props.tableRef) {
      props.tableRef.current = table;
    }
  }, [table]);

  const [layoutMode, setLayoutMode] = useState<'table' | 'list' | 'auto'>(props.layoutMode || 'auto');

  const [actualLayoutMode, setActualLayoutMode] = useState<'table' | 'list'>(
    props.layoutMode === 'auto' ? 'table' : props.layoutMode || 'table',
  );

  // Responsible Layout
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      const observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          setWidth(entry.contentRect.width);
        });
      });
      observer.observe(el);
      return () => {
        observer.unobserve(el);
      };
    }
  }, []);

  // if auto layout mode, use width to determine layout

  useEffect(() => {
    if (layoutMode === 'auto') {
      if (width !== null) {
        setActualLayoutMode(width > 1080 ? 'table' : 'list');
      }
      return;
    }
    setActualLayoutMode(layoutMode);
  }, [width, layoutMode]);

  const topSlot = (
    <>
      {props.topSlot}
      <RadioGroup
        type="button"
        defaultValue={layoutMode}
        value={layoutMode}
        onChange={(e) => {
          setLayoutMode(e.target.value);
        }}
      >
        <Radio value={'auto'}>自适应视图</Radio>
        <Radio value={'table'}>表格视图</Radio>
        <Radio value={'list'}>列表视图</Radio>
      </RadioGroup>
      <div>共 {table.options.data.length} 条数据</div>
      <Pagination
        total={table.options.data.length}
        showTotal
        showQuickJumper
        showSizeChanger
        pageSizeOpts={[10, 20, 50, 200]}
        pageSize={table.getState().pagination.pageSize}
        onPageSizeChange={(x) => {
          table.setPageSize(x);
        }}
        // Semi UI's page is started from 1. Tanstack Table index is started from 0
        currentPage={table.getState().pagination.pageIndex + 1}
        onPageChange={(x) => {
          table.setPageIndex(x - 1);
        }}
      />
    </>
  );

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {actualLayoutMode === 'table' && <TableView table={table} topSlot={topSlot} />}
      {actualLayoutMode === 'list' && <ListView table={table} topSlot={topSlot} />}
    </div>
  );
}
