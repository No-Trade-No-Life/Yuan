import { Space } from '@douyinfe/semi-ui';
import { IServiceInfo } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { firstValueFrom, from, lastValueFrom, switchMap, tap } from 'rxjs';
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

                  await lastValueFrom(
                    from(terminal.request(service.serviceInfo.method, service.terminal_id, value)).pipe(
                      tap((x) => console.log('message', x)),
                    ),
                  );
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
