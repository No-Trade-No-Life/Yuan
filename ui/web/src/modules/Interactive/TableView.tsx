import { Space } from '@douyinfe/semi-ui';
import { Table, flexRender } from '@tanstack/react-table';

export function TableView<T>(props: { table: Table<T> }) {
  const { table } = props;
  return (
    <Space vertical align="start">
      <div>{table.getRowModel().rows.length} Items</div>
      <table className="semi-table">
        <thead
          className="semi-table-thead"
          style={{ position: 'sticky', zIndex: 1, top: 0, background: 'var(--semi-color-bg-1)' }}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="semi-table-row">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="semi-table-row-head">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
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
    </Space>
  );
}
