import { Descriptions, List } from '@douyinfe/semi-ui';
import { Table, flexRender } from '@tanstack/react-table';

export function ListView<T>(props: { table: Table<T> }) {
  const { table } = props;
  return (
    <List style={{ width: '100%' }}>
      {table.getRowModel().rows.map((row) => (
        <List.Item key={row.id}>
          <Descriptions>
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header, idx) => {
                const cell = row.getVisibleCells().find((cell) => cell.column.id === header.column.id);
                if (!cell) {
                  return null;
                }
                return (
                  <Descriptions.Item
                    key={headerGroup.id + '/' + cell.id}
                    itemKey={
                      header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Descriptions.Item>
                );
              }),
            )}
          </Descriptions>
        </List.Item>
      ))}
    </List>
  );
}
