import { Descriptions, List, Space } from '@douyinfe/semi-ui';
import { Table, flexRender } from '@tanstack/react-table';
import React from 'react';

export function ListView<T>(props: { table: Table<T> }) {
  const { table } = props;
  return (
    <List style={{ width: '100%' }}>
      {table.getRowModel().rows.map((row) => (
        <List.Item key={row.id}>
          <Descriptions>
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header, idx) => {
                return (
                  <Descriptions.Item
                    key={headerGroup.id + '/' + idx}
                    itemKey={
                      header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())
                    }
                  >
                    {row
                      .getVisibleCells()
                      .filter((cell) => cell.column.id === header.column.id)
                      .map((cell) => flexRender(cell.column.columnDef.cell, cell.getContext()))}
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
