import { useObservable, useObservableState } from 'observable-hooks';
import { DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from './create-connection';
import { switchMap } from 'rxjs';
import { useMemo } from 'react';
import { IServiceInfo } from '@yuants/protocol';
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
      ]}
    />
  );
});
