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

export function DataView<T>(props: {
  data: T[];
  columns: ColumnDef<T, any>[];
  initialSorting?: SortingState;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;
  tableRef?: React.MutableRefObject<Table<T> | undefined>;
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
  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {width === null ? null : width > 1080 ? <TableView table={table} /> : <ListView table={table} />}
    </div>
  );
}
