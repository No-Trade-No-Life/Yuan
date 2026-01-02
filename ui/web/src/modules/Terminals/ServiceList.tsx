import { Modal, Space } from '@douyinfe/semi-ui';
import { IServiceInfo } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import React from 'react';
import { debounceTime, firstValueFrom, from, map, of, scan, switchMap } from 'rxjs';
import { showForm } from '../Form';
import { Button, DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from './create-connection';
import { InlineTerminalId } from './InlineTerminalId';

registerPage('ServiceList', () => {
  const providedServices = useObservableState(
    useObservable(
      () =>
        terminal$.pipe(
          //
          switchMap((terminal) =>
            !terminal
              ? of([])
              : terminal.terminalInfos$.pipe(
                  debounceTime(500),
                  map((terminalInfos) => {
                    const ret: { terminal_id: string; serviceInfo: IServiceInfo }[] = [];
                    if (!terminalInfos) return [];
                    for (const terminalInfo of terminalInfos)
                      for (const serviceInfo of Object.values(terminalInfo?.serviceInfo || {})) {
                        if (!serviceInfo.service_id) continue;
                        if (ret.find((x) => x.serviceInfo.service_id === serviceInfo.service_id)) continue;
                        ret.push({ terminal_id: terminalInfo.terminal_id, serviceInfo });
                      }
                    return ret;
                  }),
                ),
          ),
        ),
      [],
    ),
  );

  return (
    <DataView
      data={providedServices}
      columns={[
        {
          header: '终端 ID',
          accessorKey: 'terminal_id',
          cell: (x) => <InlineTerminalId terminal_id={x.getValue()} />,
        },
        {
          header: '服务 ID',
          accessorKey: 'serviceInfo.service_id',
        },
        {
          header: '方法',
          accessorKey: 'serviceInfo.method',
        },
        {
          header: '参数',
          accessorFn: (x) => JSON.stringify(x.serviceInfo.schema),
        },
        {
          id: 'actions',
          meta: {
            fixed: 'right',
          },
          header: '操作',
          cell: (ctx) => (
            <Space>
              <Button
                onClick={async () => {
                  const service = ctx.row.original;
                  const terminal = await firstValueFrom(terminal$);
                  if (!terminal) return;
                  const schema = service.serviceInfo.schema;
                  const value = await showForm(schema, {}, { immediateSubmit: true });

                  const a$ = from(
                    terminal.client.requestByServiceId(service.serviceInfo.service_id, value),
                  ).pipe(
                    scan(
                      (acc, x) => [
                        ...acc,
                        {
                          updated_at: Date.now(),
                          data: JSON.stringify(x),
                        },
                      ],
                      [] as Array<{ updated_at: number; data: string }>,
                    ),
                  );

                  await new Promise((resolve) => {
                    Modal.info({
                      title: `请求查看工具`,
                      style: { width: '80vw' },
                      content: React.createElement(() => {
                        const msg = useObservableState(a$, []);

                        return (
                          <Space
                            vertical
                            align="start"
                            style={{ width: '100%', height: '100%', fontFamily: 'monospace' }}
                          >
                            <div>
                              <div>Method: {service.serviceInfo.method}</div>
                              <div>Service: {service.serviceInfo.service_id}</div>
                              <div>Terminal: {service.terminal_id}</div>
                              <div>Request Body: {JSON.stringify(value)}</div>
                            </div>
                            <DataView
                              data={msg}
                              layoutMode="table"
                              initialSorting={[{ id: 'updated_at', desc: true }]}
                              columns={[
                                { accessorKey: 'updated_at', cell: (x) => formatTime(x.getValue()) },
                                {
                                  accessorKey: 'data',
                                  cell: (x) => <pre>{JSON.stringify(JSON.parse(x.getValue()), null, 2)}</pre>,
                                },
                              ]}
                            />
                          </Space>
                        );
                      }, {}),
                      okText: '中断请求',
                      onOk: resolve,
                      onCancel: resolve,
                      cancelButtonProps: { style: { display: 'none' } },
                    });
                  });
                }}
              >
                调用
              </Button>
            </Space>
          ),
        },
      ]}
    />
  );
});
