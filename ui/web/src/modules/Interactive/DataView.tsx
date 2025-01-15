import { Radio, RadioGroup } from '@douyinfe/semi-ui';
import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  OnChangeFn,
  SortingState,
  Table,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useRef, useState } from 'react';
import { ListView } from './ListView';
import { TableView } from './TableView';

export function DataView<T, K>(props: {
  data: T[];
  columns: ColumnDef<T, any>[];
  initialSorting?: SortingState;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
  tableRef?: React.MutableRefObject<Table<T> | undefined>;
  layoutMode?: 'table' | 'list' | 'auto';
  topSlot?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const table = useReactTable({
    data: props.data,
    columns: props.columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting: props.sorting,
    },
    onSortingChange: props.onSortingChange,
    initialState: {
      sorting: props.initialSorting,
    },
    manualSorting: props.manualSorting,
  });

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
    </>
  );

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {actualLayoutMode === 'table' && <TableView table={table} topSlot={topSlot} />}
      {actualLayoutMode === 'list' && <ListView table={table} topSlot={topSlot} />}
    </div>
  );
}
