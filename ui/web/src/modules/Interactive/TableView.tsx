import { IconCaretdown, IconCaretup, IconSort } from '@douyinfe/semi-icons';
import { Button, Input, Space } from '@douyinfe/semi-ui';
import { Table, flexRender } from '@tanstack/react-table';

export function TableView<T>(props: { table: Table<T>; topSlot?: React.ReactNode }) {
  const { table } = props;

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space wrap>{props.topSlot}</Space>
      <table className="semi-table">
        <thead
          className="semi-table-thead"
          style={{ position: 'sticky', zIndex: 1, top: 0, background: 'var(--semi-color-bg-1)' }}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="semi-table-row">
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="semi-table-row-head">
                  <Space vertical>
                    <Space>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      <Button
                        icon={
                          {
                            asc: <IconCaretup />,
                            desc: <IconCaretdown />,
                            false: <IconSort />,
                          }[header.column.getIsSorted() as string] ?? null
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      />
                    </Space>

                    {header.column.getCanFilter() ? (
                      <Input
                        value={header.column.getFilterValue() as string}
                        placeholder={'搜索...'}
                        onChange={(v) => {
                          header.column.setFilterValue(v);
                        }}
                      />
                    ) : null}
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
    </Space>
  );
}
