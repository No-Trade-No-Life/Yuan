import { IconExpand, IconEyeOpened, IconList, IconMinimize, IconPause, IconSort } from '@douyinfe/semi-icons';
import { Input, Pagination, Radio, RadioGroup, Space, Spin, Tag } from '@douyinfe/semi-ui';
import {
  ColumnDef,
  ColumnFiltersState,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  GroupingState,
  OnChangeFn,
  SortingState,
  Table,
  TableOptions,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fromEvent } from 'rxjs';
import { showForm } from '../Form';
import { ErrorBoundary } from '../Pages';
import { Button } from './Button';
import { ListView } from './ListView';
import { TableView } from './TableView';

export function DataView<T, K>(props: {
  data?: T[];
  columns: ColumnDef<T, any>[];
  columnsDependencyList?: any[];
  tableRef?: React.MutableRefObject<Table<T> | undefined>;
  layoutMode?: 'table' | 'list' | 'auto';
  topSlot?: React.ReactNode;

  initialSorting?: SortingState;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  manualSorting?: boolean;

  initialGroupping?: GroupingState;
  initialColumnVisibility?: VisibilityState;

  initialColumnFilterState?: ColumnFiltersState;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;

  initialTopSlotVisible?: boolean;
  topSlotVisible?: boolean;
  isLoading?: boolean;

  initialPageSize?: number;
  CustomView?: React.ComponentType<{ table: Table<T> }>;

  enableAutoPause?: boolean;
}) {
  const { t } = useTranslation('DataView');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ISSUE: if columns is not memoized, there's a bug to refresh columns
  const columns = useMemo(() => props.columns, props.columnsDependencyList ?? []);
  const [isTopSlotVisible, setIsTopSlotVisible] = useState(
    props.topSlotVisible ?? props.initialTopSlotVisible ?? true,
  );
  const [isDataPaused, setDataPaused] = useState(false);

  const [data, setData] = useState<T[]>([]);

  const dataContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!props.enableAutoPause || !isDataPaused) {
      setData(props.data || []);
    }
  }, [props.data, props.enableAutoPause, isDataPaused]);

  useEffect(() => {
    if (dataContainerRef.current) {
      const sub = fromEvent(dataContainerRef.current, 'mouseenter').subscribe(() => {
        setDataPaused(true);
      });

      return () => {
        sub.unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    if (dataContainerRef.current) {
      const sub = fromEvent(dataContainerRef.current, 'mouseleave').subscribe(() => {
        setDataPaused(false);
      });

      return () => {
        sub.unsubscribe();
      };
    }
  }, []);

  const isLoading = props.isLoading || props.data === undefined;

  const tableOptions: TableOptions<T> = {
    data: data,
    columns: columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    autoResetExpanded: false,
    manualSorting: props.manualSorting,
    enableGlobalFilter: true,
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

  if (props.initialGroupping) {
    (tableOptions.initialState ??= {}).grouping = props.initialGroupping;
  }

  if (props.initialPageSize) {
    ((tableOptions.initialState ??= {}).pagination ??= {}).pageSize = props.initialPageSize;
  }

  if (props.initialColumnVisibility) {
    (tableOptions.initialState ?? {}).columnVisibility = props.initialColumnVisibility;
  }

  if (props.columnFilters) {
    (tableOptions.state ??= {}).columnFilters = props.columnFilters;
  }

  if (props.initialColumnFilterState) {
    (tableOptions.initialState ?? {}).columnFilters = props.initialColumnFilterState;
  }

  if (props.onColumnFiltersChange) {
    tableOptions.onColumnFiltersChange = props.onColumnFiltersChange;
  }

  const table = useReactTable(tableOptions);

  useEffect(() => {
    if (props.tableRef) {
      props.tableRef.current = table;
    }
  }, [table]);

  const [layoutMode, setLayoutMode] = useState<'table' | 'list' | 'auto'>(props.layoutMode || 'auto');

  const [actualLayoutMode, setActualLayoutMode] = useState<'custom' | 'table' | 'list'>(
    props.CustomView ? 'custom' : props.layoutMode === 'auto' ? 'table' : props.layoutMode || 'table',
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
        setActualLayoutMode(width >= 768 ? 'table' : 'list');
      }
      return;
    }
    setActualLayoutMode(layoutMode);
  }, [width, layoutMode]);

  const topSlot = (
    <>
      {props.topSlot}
      <Input
        style={{ width: 200 }}
        placeholder={t('search')}
        value={table.getState().globalFilter}
        onChange={(e) => {
          table.setGlobalFilter(e);
        }}
      />
      <Button
        onClick={async () => {
          const sorting: SortingState = await showForm(
            {
              title: t('dataSort'),
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    title: t('column'),
                    type: 'string',
                    enum: table.getAllLeafColumns().map((x) => x.id),
                  },
                  desc: { title: t('isDescending'), type: 'boolean' },
                },
              },
            },
            table.getState().sorting,
          );
          table.setSorting(sorting);
        }}
        icon={<IconSort />}
      >
        {t('sort')}
      </Button>
      <Button
        onClick={async () => {
          const visibleColumns = table
            .getAllLeafColumns()
            .map((x) => x.id)
            .filter((x) => table.getState().columnVisibility[x] ?? true);
          const value: string[] = await showForm(
            {
              title: t('visibleFields'),
              type: 'array',
              uniqueItems: true,
              items: {
                type: 'string',
                enum: table.getAllLeafColumns().map((x) => x.id),
              },
            },
            visibleColumns,
          );
          const nextVisibility = Object.fromEntries(
            table
              .getAllLeafColumns()
              .map((x) => x.id)
              .filter((x) => !value.includes(x))
              .map((x) => [x, false]),
          );
          table.setColumnVisibility(nextVisibility);
        }}
        icon={<IconEyeOpened />}
      >
        {t('visibleFields')}
      </Button>
      <Button
        onClick={async () => {
          const value: string[] = await showForm(
            {
              title: t('fieldGroup'),
              type: 'array',
              uniqueItems: true,
              items: {
                type: 'string',
                enum: table.getAllLeafColumns().map((x) => x.id),
              },
            },
            table.getState().grouping,
          );
          table.setGrouping(value);
        }}
        icon={<IconList />}
      >
        {t('group')}
      </Button>
      <RadioGroup
        type="button"
        defaultValue={layoutMode}
        value={layoutMode}
        onChange={(e) => {
          setLayoutMode(e.target.value);
        }}
      >
        <Radio value={'auto'}>{t('adaptiveView')}</Radio>
        <Radio value={'table'}>{t('tableView')}</Radio>
        <Radio value={'list'}>{t('listView')}</Radio>
        {props.CustomView && <Radio value={'custom'}>{t('customView')}</Radio>}
      </RadioGroup>
      <Space>
        <div>{t('total', { count: table.options.data.length })}</div>
        <div>{t('filtered', { count: table.getFilteredRowModel().rows.length })}</div>
        <div>{t('prePageNation', { count: table.getPrePaginationRowModel().rows.length })}</div>
      </Space>
      <Pagination
        total={table.getPrePaginationRowModel().rows.length}
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
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {isTopSlotVisible && (
        <Space wrap style={{ width: '100%' }}>
          {topSlot}
        </Space>
      )}
      <Space
        wrap
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          zIndex: 1,
        }}
      >
        <Tag visible={props.enableAutoPause && isDataPaused} prefixIcon={<IconPause />} type="solid">
          {t('dataPaused')}
        </Tag>
        <Button
          icon={isTopSlotVisible ? <IconMinimize /> : <IconExpand />}
          style={{ display: props.topSlotVisible !== undefined ? 'none' : undefined }}
          onClick={async () => {
            setIsTopSlotVisible(!isTopSlotVisible);
          }}
        />
      </Space>
      <div ref={dataContainerRef} style={{ width: '100%', flexGrow: 1, overflow: 'auto', zIndex: 0 }}>
        <ErrorBoundary>
          <Spin spinning={isLoading}>
            {actualLayoutMode === 'custom' && props.CustomView && <props.CustomView table={table} />}
            {actualLayoutMode === 'table' && <TableView table={table} />}
            {actualLayoutMode === 'list' && <ListView table={table} />}
          </Spin>
        </ErrorBoundary>
      </div>
    </div>
  );
}
