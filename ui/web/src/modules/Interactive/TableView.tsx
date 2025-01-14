import { IconCaretdown, IconCaretup } from '@douyinfe/semi-icons';
import { Pagination, Space } from '@douyinfe/semi-ui';
import {
  Table,
  flexRender,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

export function TableView<T>(props: { table: Table<T>; topSlot?: React.ReactNode }) {
  const { table: t } = props;

  const table = useReactTable({
    ...t.options,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    autoResetPageIndex: false,
    autoResetExpanded: false,
  });

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        {props.topSlot}
        <div>{table.options.data.length} Items</div>
      </Space>

      <table className="semi-table">
        <thead
          className="semi-table-thead"
          style={{ position: 'sticky', zIndex: 1, top: 0, background: 'var(--semi-color-bg-1)' }}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="semi-table-row">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="semi-table-row-head"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <Space>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {{
                      asc: <IconCaretup />,
                      desc: <IconCaretdown />,
                    }[header.column.getIsSorted() as string] ?? null}
                  </Space>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="semi-table-tbody">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="semi-table-row">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="semi-table-row-cell">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {table.getFooterGroups().map((footerGroup) => (
            <tr key={footerGroup.id}>
              {footerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.footer, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </tfoot>
      </table>
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
    </Space>
  );
}
