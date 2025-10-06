import {
  IconExpand,
  IconExport,
  IconEyeClosed,
  IconEyeOpened,
  IconList,
  IconMinimize,
  IconPause,
  IconSetting,
  IconSort,
} from '@douyinfe/semi-icons';
import { Input, Modal, Pagination, Radio, RadioGroup, Space, Spin, Tag, Toast } from '@douyinfe/semi-ui';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnPinningState,
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
import { CSV } from '../Util';
import { Button } from './Button';
import { ListView } from './ListView';
import { SortableList } from './SortableList';
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

  manualPagination?: boolean;

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

  pageCount?: number;
  totalCount?: number;
  hideGroup?: boolean;
  hideFieldSettings?: boolean;
  hideExport?: boolean;
}) {
  const { t } = useTranslation('DataView');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ISSUE: if columns is not memoized, there's a bug to refresh columns
  const columns = useMemo(() => props.columns, props.columnsDependencyList ?? []);
  const columnPinning = useMemo(() => {
    const pinning: ColumnPinningState = { left: [], right: [] };

    const collect = (cols: ColumnDef<T, any>[]) => {
      cols.forEach((col) => {
        if ('columns' in col && col.columns) {
          collect(col.columns as ColumnDef<T, any>[]);
          return;
        }

        const columnId =
          (col as ColumnDef<T, any> & { accessorKey?: string }).id ??
          (col as ColumnDef<T, any> & { accessorKey?: string }).accessorKey;
        const fixed = col.meta && (col.meta as { fixed?: 'left' | 'right' }).fixed;

        if (!columnId || !fixed) {
          return;
        }

        if (fixed === 'left') {
          pinning.left!.push(columnId);
        } else if (fixed === 'right') {
          pinning.right!.push(columnId);
        }
      });
    };

    collect(columns);

    return pinning;
  }, [columns]);
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
    manualPagination: props.manualPagination,
    pageCount: props.pageCount,
    enableColumnPinning: true,
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

  if ((columnPinning.left?.length ?? 0) > 0 || (columnPinning.right?.length ?? 0) > 0) {
    const initialState = (tableOptions.initialState ??= {});
    const initialColumnPinning = (initialState.columnPinning ??= {} as ColumnPinningState);
    if (!initialColumnPinning.left && columnPinning.left?.length) {
      initialColumnPinning.left = columnPinning.left;
    }
    if (!initialColumnPinning.right && columnPinning.right?.length) {
      initialColumnPinning.right = columnPinning.right;
    }
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

  const [isFieldSettingModalVisible, setIsFieldSettingModalVisible] = useState(false);

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
      {!props.hideFieldSettings && (
        <Button
          icon={<IconSetting />}
          onClick={async () => {
            setIsFieldSettingModalVisible(true);
          }}
        >
          {t('fieldsSetting')}
        </Button>
      )}
      {!props.hideGroup && (
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
      )}
      {!props.hideExport && (
        <Button
          icon={<IconExport />}
          onClick={async () => {
            const columns = table.getAllLeafColumns();
            const data = table
              .getFilteredRowModel()
              .rows.map((row) => columns.map((col) => row.getValue(col.id)));
            data.unshift(columns.map((col) => col.id));
            await CSV.writeFileFromRawTable(`/export.csv`, data);
            Toast.success('导出到 /export.csv');
          }}
        >
          {'导出CSV'}
        </Button>
      )}
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
        <div>{t('total', { count: props.totalCount ?? table.options.data.length })}</div>
        <div>{t('filtered', { count: table.getFilteredRowModel().rows.length })}</div>
        <div>
          {t('prePageNation', { count: props.totalCount ?? table.getPrePaginationRowModel().rows.length })}
        </div>
      </Space>
      <Pagination
        total={props.totalCount ?? table.getPrePaginationRowModel().rows.length}
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
      <ErrorBoundary>
        <DataViewFieldSettingModal
          table={table}
          visible={isFieldSettingModalVisible}
          setVisible={setIsFieldSettingModalVisible}
        />
      </ErrorBoundary>
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

function DataViewFieldSettingModal<T>(props: {
  table: Table<T>;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}) {
  return (
    <Modal
      visible={props.visible}
      onCancel={() => props.setVisible(false)}
      okButtonProps={{ style: { display: 'none' } }}
      cancelButtonProps={{ style: { display: 'none' } }}
      closeIcon={null}
      closable={false}
    >
      <SortableList
        items={props.table.getAllLeafColumns().map((x) => x.id)}
        onSort={(ids) => {
          props.table.setColumnOrder(() => {
            return ids.filter((id): id is string => typeof id === 'string');
          });
        }}
        render={(id) => {
          const header = props.table.getFlatHeaders().find((x) => x.id === id)!;
          const visible = props.table.getState().columnVisibility[id] ?? true;
          const headerNode = header ? flexRender(header.column.columnDef.header, header.getContext()) : id;

          return (
            <Space style={{ width: '100%' }}>
              <Tag>{headerNode}</Tag>
              <Space style={{ marginLeft: 'auto' }}>
                <Button
                  theme="borderless"
                  icon={visible ? <IconEyeOpened /> : <IconEyeClosed />}
                  onClick={async () => {
                    props.table.setColumnVisibility((prev) => {
                      return { ...prev, [id]: !visible };
                    });
                  }}
                />
              </Space>
            </Space>
          );
        }}
      />
    </Modal>
  );
}
