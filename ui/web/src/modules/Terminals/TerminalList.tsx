import { Space, Typography } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { formatTime } from '@yuants/utils';
import { ITerminalInfo } from '@yuants/protocol';
import { useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { of, shareReplay, switchMap } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { Button, DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { terminate } from './TerminalListItem';
import { terminal$ } from './create-connection';
import { formatDuration } from './utils';

export const terminalList$ = terminal$.pipe(
  switchMap((terminal) => terminal?.terminalInfos$ ?? of([])),
  shareReplay(1),
);

registerPage('TerminalList', () => {
  const terminals = useObservableState(terminalList$, []);

  const columns = useMemo(() => {
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
      columnHelper.accessor('created_at', {
        header: () => '启动时间',
        cell: (info) => formatTime(info.getValue() || NaN),
      }),
      columnHelper.accessor((x) => Date.now() - (x.created_at || Date.now()), {
        id: 'start_time',
        header: () => '启动时长',
        cell: (ctx) => formatDuration(ctx.getValue()),
      }),
      columnHelper.accessor((x) => Object.values(x.serviceInfo || {}).length, {
        id: 'serviceLength',
        header: () => '提供服务数',
      }),
      // columnHelper.accessor((x) => x.channelIdSchemas?.length, {
      //   id: 'channelIdSchemaLength',
      //   header: () => '提供频道数',
      // }),
      // columnHelper.accessor((x) => Object.keys(x.subscriptions || {}).length, {
      //   id: 'subscribeTerminalLength',
      //   header: () => `订阅终端数`,
      // }),
      // columnHelper.accessor(
      //   (x) => Object.values(x.subscriptions || {}).reduce((acc, cur) => acc + cur.length, 0),
      //   {
      //     id: 'subscribeChannelLength',
      //     header: () => '订阅频道数',
      //   },
      // ),
      columnHelper.accessor((x) => 0, {
        id: 'actions',
        header: () => '操作',
        cell: (x) => {
          const terminal = x.row.original;

          return (
            <Space>
              <Button onClick={() => executeCommand('TerminalDetail', { terminal_id: terminal.terminal_id })}>
                详情
              </Button>
              <Button
                disabled={!Object.values(terminal.serviceInfo || {}).some((x) => x.method === 'Terminate')}
                onClick={async () => {
                  terminate(terminal.terminal_id);
                }}
              >
                终止
              </Button>
            </Space>
          );
        },
      }),
    ];
    return columns;
  }, []);

  return <DataView columns={columns} data={terminals} initialGroupping={['name']} />;
});
