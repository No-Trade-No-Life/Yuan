import { IconDesktop, IconSignal, IconUnlink, IconWrench } from '@douyinfe/semi-icons';
import { Button, Card, Descriptions, Popover, Space, Typography } from '@douyinfe/semi-ui';
import { useObservable, useObservableState } from 'observable-hooks';
import React from 'react';
import { bufferTime, combineLatest, map, switchMap } from 'rxjs';
import { terminal$ } from '../../common/create-connection';
import { openSingletonComponent } from '../../layout-model';
import { currentHostConfig$ } from '../Workbench/model';

export const secretURL = (url: string) => {
  try {
    const theUrl = new URL(url);
    theUrl.searchParams.set('host_token', '******');
    return theUrl.toString();
  } catch (e) {
    return url;
  }
};

export const NetworkStatusWidget = React.memo(() => {
  const config = useObservableState(currentHostConfig$);

  const network$ = useObservable(() =>
    terminal$.pipe(
      switchMap((terminal) =>
        combineLatest([
          terminal._conn.output$.pipe(
            bufferTime(2000),
            map((buffer) => ((JSON.stringify(buffer).length / 2e3) * 8).toFixed(1)),
          ),
          terminal._conn.input$.pipe(
            bufferTime(2000),
            map((buffer) => ((JSON.stringify(buffer).length / 2e3) * 8).toFixed(1)),
          ),
        ]),
      ),
    ),
  );

  const network = useObservableState(network$, ['0.0', '0.0'] as [string, string]);
  return (
    <Space>
      <Popover
        position="bottomRight"
        content={
          <Card style={{ minWidth: 200 }}>
            <Descriptions
              data={[
                //
                {
                  key: '主机标签',
                  value: <Typography.Text>{config?.name ?? '未配置'}</Typography.Text>,
                },
                {
                  key: '主机地址',
                  value: (
                    <Typography.Text copyable={{ content: config?.HV_URL ?? '未配置' }}>
                      {secretURL(config?.HV_URL ?? '未配置')}
                    </Typography.Text>
                  ),
                },
                {
                  key: '终端ID',
                  value: <Typography.Text copyable>{config?.TERMINAL_ID ?? '未配置'}</Typography.Text>,
                },
                {
                  key: '上行速率',
                  value: `${network[0]} kbps`,
                },
                {
                  key: '下行速率',
                  value: `${network[1]} kbps`,
                },
                {
                  key: '连接状态',
                  value: <Typography.Text>{+network[1] > 0 ? '在线' : '离线'}</Typography.Text>,
                },
              ]}
            ></Descriptions>
            <Button
              icon={<IconWrench />}
              onClick={() => {
                openSingletonComponent('HostList', '主机配置');
              }}
            >
              配置
            </Button>
            <Button
              icon={<IconUnlink />}
              disabled={!currentHostConfig$.value}
              onClick={() => {
                currentHostConfig$.next(null);
                location.reload();
              }}
            >
              断开
            </Button>
          </Card>
        }
      >
        <Typography.Text
          icon={
            config ? <IconSignal style={{ color: +network[1] > 0 ? 'green' : 'red' }} /> : <IconDesktop />
          }
        >
          {config ? `${config.name} / ${config.TERMINAL_ID}` : '无主机模式'}
        </Typography.Text>
      </Popover>
    </Space>
  );
});
