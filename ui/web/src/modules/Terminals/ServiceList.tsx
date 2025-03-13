import { Modal, Space } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/data-model';
import { IServiceInfo } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useMemo } from 'react';
import { firstValueFrom, from, scan, switchMap } from 'rxjs';
import { showForm } from '../Form';
import { Button, DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from './create-connection';
import { InlineTerminalId } from './InlineTerminalId';

registerPage('ServiceList', () => {
  const terminalInfos = useObservableState(
    useObservable(
      () =>
        terminal$.pipe(
          //
          switchMap((terminal) => terminal?.terminalInfos$ ?? []),
        ),
      [],
    ),
    [],
  );

  const providedServices = useMemo(() => {
    const ret: { terminal_id: string; serviceInfo: IServiceInfo }[] = [];
    for (const terminalInfo of terminalInfos)
      for (const serviceInfo of Object.values(terminalInfo?.serviceInfo || {})) {
        if (!serviceInfo.service_id) continue;
        if (ret.find((x) => x.serviceInfo.service_id === serviceInfo.service_id)) continue;
        ret.push({ terminal_id: terminalInfo.terminal_id, serviceInfo });
      }
    return ret;
  }, [terminalInfos]);

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
          header: '操作',
          cell: (ctx) => (
            <Space>
              <Button
                onClick={async () => {
                  const service = ctx.row.original;
                  const terminal = await firstValueFrom(terminal$);
                  if (!terminal) return;
                  const schema = service.serviceInfo.schema;
                  const value = await showForm(schema, {});

                  const a$ = from(
                    terminal.request(service.serviceInfo.method, service.terminal_id, value),
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
                                { accessorKey: 'data' },
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
