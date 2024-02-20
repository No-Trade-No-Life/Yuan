import { List, Space, Typography } from '@douyinfe/semi-ui';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { formatTime } from '@yuants/data-model';
import { ITerminalInfo } from '@yuants/protocol';
import { formatDuration, intervalToDuration } from 'date-fns';
import { useObservableState } from 'observable-hooks';
import { of, shareReplay, switchMap } from 'rxjs';
import { Button } from '../Interactive';
import { registerPage } from '../Pages';
import { TerminalListItem, terminate } from './TerminalListItem';
import { terminal$ } from './create-connection';

export const terminalList$ = terminal$.pipe(
  switchMap((terminal) => terminal?.terminalInfos$ ?? of([])),
  shareReplay(1),
);

const columnHelper = createColumnHelper<ITerminalInfo>();

const columns = [
  columnHelper.accessor('terminal_id', {
    header: () => '终端 ID',
    cell: (info) => <Typography.Text copyable>{info.getValue()}</Typography.Text>,
  }),
  columnHelper.accessor('name', {
    header: () => '终端名',
  }),
  columnHelper.accessor('updated_at', {
    header: () => '最近更新时间',
    cell: (info) => formatTime(info.getValue() || NaN),
  }),
  columnHelper.accessor('start_timestamp_in_ms', {
    header: () => '启动时间',
    cell: (info) => formatTime(info.getValue() || NaN),
  }),
  columnHelper.accessor(
    (x) => formatDuration(intervalToDuration({ start: x.start_timestamp_in_ms!, end: Date.now() })),
    {
      id: 'start_time',
      header: () => '启动时长',
    },
  ),
  columnHelper.accessor((x) => Object.values(x.serviceInfo || {}).length, {
    id: 'serviceLength',
    header: () => '提供服务数',
  }),
  columnHelper.accessor((x) => x.channelIdSchemas?.length, {
    id: 'channelIdSchemaLength',
    header: () => '提供频道数',
  }),
  columnHelper.accessor((x) => Object.keys(x.subscriptions || {}).length, {
    id: 'subscribeTerminalLength',
    header: () => `订阅终端数`,
  }),
  columnHelper.accessor(
    (x) => Object.values(x.subscriptions || {}).reduce((acc, cur) => acc + cur.length, 0),
    {
      id: 'subscribeChannelLength',
      header: () => '订阅频道数',
    },
  ),
  columnHelper.accessor((x) => 0, {
    id: 'actions',
    header: () => '操作',
    cell: (x) => {
      const term = x.row.original;

      return (
        <Button
          disabled={!term.serviceInfo?.['Terminate']}
          onClick={async () => {
            terminate(term.terminal_id);
          }}
        >
          终止
        </Button>
      );
    },
  }),
];

const TerminalListDesktop = (props: { terminals: ITerminalInfo[] }) => {
  const table = useReactTable({ columns, data: props.terminals, getCoreRowModel: getCoreRowModel() });

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
};

registerPage('TerminalList', () => {
  const terminals = useObservableState(terminalList$, []);

  if (window.outerWidth >= 1080) {
    return <TerminalListDesktop terminals={terminals} />;
  }

  return (
    <Space vertical align="start">
      <Space>
        <Typography.Text>终端数量: {terminals.length}</Typography.Text>
      </Space>
      <List>
        {terminals.map((term) => (
          <TerminalListItem key={term.terminal_id} terminalInfo={term} />
        ))}
      </List>
    </Space>
  );
});
