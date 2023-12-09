import { IconLink, IconUnlink } from '@douyinfe/semi-icons';
import { Button, Descriptions, List, Space, TagGroup, Toast, Typography } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/data-model';
import { ITerminalInfo } from '@yuants/protocol';
import { formatDuration, intervalToDuration } from 'date-fns';
import React from 'react';
import { EMPTY, catchError, filter, first, mergeMap, tap } from 'rxjs';
import { terminal$ } from '../Terminals';

export const TerminalListItem = React.memo((props: { terminalInfo: ITerminalInfo }) => {
  const term = props.terminalInfo;
  const isOnline = term.updated_at! + 60_000 > Date.now();
  return (
    <List.Item>
      <Space vertical align="start">
        <Typography.Title heading={6} copyable>
          {term.terminal_id}
        </Typography.Title>
        {isOnline ? (
          <Typography.Text type="success">
            <Space>
              <IconLink />
              在线
            </Space>
          </Typography.Text>
        ) : (
          <Typography.Text type="tertiary">
            <Space>
              <IconUnlink />
              离线
            </Space>
          </Typography.Text>
        )}
        <Descriptions
          data={[
            //
            { key: '终端名字', value: term.name },
            { key: '最近启动时间', value: formatTime(term.start_timestamp_in_ms!) },
            { key: '最近更新时间', value: formatTime(term.updated_at!) },
            {
              key: '启动时长',
              value: formatDuration(
                intervalToDuration({ start: term.start_timestamp_in_ms!, end: Date.now() }),
              ),
            },
          ]}
        ></Descriptions>
        <TagGroup
          maxTagCount={3}
          showPopover
          tagList={Object.values(term.serviceInfo || {}).map((info) => ({
            children: info.method,
          }))}
        ></TagGroup>
        <Button
          disabled={!term.serviceInfo?.['Terminate']}
          onClick={() => {
            terminate(term.terminal_id);
          }}
        >
          终止
        </Button>
      </Space>
    </List.Item>
  );
});

export function terminate(terminal_id: string) {
  terminal$
    .pipe(
      filter((x): x is Exclude<typeof x, null> => !!x),
      first(),
      mergeMap((terminal) =>
        terminal.request('Terminate', terminal_id, {}).pipe(
          tap((msg) => {
            if (msg.res) {
              if (msg.res.code === 0) {
                Toast.success(`成功终止: ${terminal_id}`);
              } else {
                Toast.error(`终止失败: ${msg.res.code} ${msg.res.message}`);
              }
            }
          }),
          catchError((err) => {
            Toast.error(`终止异常: ${err}`);
            return EMPTY;
          }),
        ),
      ),
    )
    .subscribe();
}
