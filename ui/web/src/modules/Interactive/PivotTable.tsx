import { IconChevronDown, IconChevronLeft, IconChevronRight, IconClose } from '@douyinfe/semi-icons';
import { Pagination, Space, Typography } from '@douyinfe/semi-ui';
import {
  ColumnDef,
  ExpandedState,
  GroupingState,
  PaginationState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import React from 'react';

export interface IPivotTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  initialGrouping?: GroupingState;
  initialExpanded?: ExpandedState;
}

export function PivotTable<T>(props: IPivotTableProps<T>) {
  const [grouping, setGrouping] = React.useState<GroupingState>(props.initialGrouping || []);
  const [expanded, setExpanded] = React.useState<ExpandedState>(props.initialExpanded || {});
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const table = useReactTable({
    data: props.data,
    columns: props.columns,
    state: {
      pagination,
      grouping,
      expanded,
    },
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onPaginationChange: setPagination,
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetAll: false,
    autoResetExpanded: false,
    // debugTable: true,
  });

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        <Typography.Text>{table.getRowModel().rows.length} Rows</Typography.Text>
        <Typography.Text>{table.options.data.length} Items</Typography.Text>
      </Space>
      <table className="semi-table">
        <thead
          className="semi-table-thead"
          style={{ position: 'sticky', zIndex: 1, top: 0, background: 'var(--semi-color-bg-1)' }}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="semi-table-row">
              {headerGroup.headers.map((header) => {
                return (
                  <th key={header.id} className="semi-table-row-head" colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <div>
                        {header.column.getCanGroup() ? (
                          // If the header can be grouped, let's add a toggle
                          <Modules.Interactive.Button
                            icon={header.column.getIsGrouped() ? <IconClose /> : <IconChevronLeft />}
                            onClick={async () => {
                              header.column.getToggleGroupingHandler()();
                            }}
                          >
                            {/* {header.column.getGroupedIndex()} */}
                          </Modules.Interactive.Button>
                        ) : null}{' '}
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="semi-table-tbody">
          {table.getRowModel().rows.map((row) => {
            return (
              <tr key={row.id} className="semi-table-row">
                {row.getVisibleCells().map((cell) => {
                  return (
                    <td key={cell.id} className="semi-table-row-cell">
                      {cell.getIsGrouped() ? (
                        // If it's a grouped cell, add an expander and row count
                        <>
                          <Modules.Interactive.Button
                            icon={row.getIsExpanded() ? <IconChevronDown /> : <IconChevronRight />}
                            onClick={async () => {
                              row.getToggleExpandedHandler()();
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())} ({row.subRows.length})
                          </Modules.Interactive.Button>
                        </>
                      ) : cell.getIsAggregated() ? (
                        // If the cell is aggregated, use the Aggregated
                        // renderer for cell
                        flexRender(
                          cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                          cell.getContext(),
                        )
                      ) : cell.getIsPlaceholder() ? null : ( // For cells with repeated values, render null
                        // Otherwise, just render the regular cell
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination
        total={table.getPageCount() * table.getState().pagination.pageSize}
        // total={table.getTotalSize()}
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
    </Space>
  );
}
