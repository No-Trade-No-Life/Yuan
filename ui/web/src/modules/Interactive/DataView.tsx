import { Table } from '@tanstack/react-table';
import { ListView } from './ListView';
import { TableView } from './TableView';

export function DataView<T>(props: { table: Table<T> }) {
  if (window.outerWidth >= 1080) {
    return <TableView table={props.table} />;
  }

  return <ListView table={props.table} />;
}
