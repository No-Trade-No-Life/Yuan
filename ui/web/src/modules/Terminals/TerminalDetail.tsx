import { Collapse, Descriptions, Space, Spin, Typography } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/utils';
import { IServiceInfo } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { switchMap } from 'rxjs';
import { DataView } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';
import { terminal$ } from './create-connection';
import { formatDuration } from './utils';

registerPage('TerminalDetail', () => {
  const { terminal_id } = usePageParams() as { terminal_id: string };
  if (!terminal_id) throw new Error('terminal_id is required');

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

  const thisTerminalInfo = terminalInfos.find((x) => x.terminal_id === terminal_id);

  const providedServices = useMemo(() => {
    const ret: IServiceInfo[] = [];
    for (const serviceInfo of Object.values(thisTerminalInfo?.serviceInfo || {})) {
      if (!serviceInfo.service_id) continue;
      if (ret.find((x) => x.service_id === serviceInfo.service_id)) continue;
      ret.push(serviceInfo);
    }
    return ret;
  }, [thisTerminalInfo]);

  const providedChannels = useMemo(() => {
    const ret: Array<{ type: string; schema: string }> = [];
    for (const service of providedServices) {
      if (service.method !== 'SubscribeChannel') continue;
      // @ts-ignore
      const type = service.schema.properties?.type?.const;
      const schema = service.schema.properties?.channel_id;
      if (type && schema) {
        ret.push({ type, schema: JSON.stringify(schema) });
      }
    }
    return ret;
  }, [providedServices]);

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Typography.Title heading={2} copyable>
        {terminal_id}
      </Typography.Title>
      {!thisTerminalInfo && <Spin />}
      {thisTerminalInfo && (
        <Descriptions
          row
          data={[
            { key: '终端名', value: thisTerminalInfo.name },
            { key: '最近更新时间', value: formatTime(thisTerminalInfo.updated_at!) },
            { key: '启动时间', value: formatTime(thisTerminalInfo.created_at!) },
            {
              key: '启动时长',
              value: formatDuration(Date.now() - thisTerminalInfo.created_at!),
            },
            { key: '提供服务数', value: providedServices.length },
            { key: '提供频道数', value: providedChannels.length },
            // { key: '订阅终端数', value: Object.keys(thisTerminalInfo.subscriptions || {}).length },
            // {
            //   key: '订阅频道数',
            //   value: Object.values(thisTerminalInfo.subscriptions || {}).reduce(
            //     (acc, cur) => acc + cur.length,
            //     0,
            //   ),
            // },
          ]}
        />
      )}

      <Collapse style={{ width: '100%' }}>
        <Collapse.Panel header="提供服务" itemKey="providedServices">
          <DataView
            data={providedServices}
            columns={[
              {
                header: 'Service ID',
                accessorKey: 'service_id',
              },
              {
                header: 'Method',
                accessorKey: 'method',
              },
              {
                header: 'Schema',
                accessorFn: (x) => JSON.stringify(x.schema),
              },
            ]}
          />
        </Collapse.Panel>
        <Collapse.Panel header="提供频道" itemKey="provideChannels">
          <DataView
            data={providedChannels}
            columns={[
              {
                header: 'Type',
                accessorKey: 'type',
              },
              {
                header: 'Schema',
                accessorKey: 'schema',
              },
            ]}
          />
        </Collapse.Panel>
      </Collapse>
    </Space>
  );
});
