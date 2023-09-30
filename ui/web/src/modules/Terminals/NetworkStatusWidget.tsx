import { IconDesktop, IconSignal, IconUnlink, IconWrench } from '@douyinfe/semi-icons';
import { Button, Card, Descriptions, Popover, Space, Typography } from '@douyinfe/semi-ui';
import { useObservable, useObservableState } from 'observable-hooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { bufferTime, combineLatest, map, switchMap } from 'rxjs';
import { terminal$ } from '../Terminals';
import { openPage } from '../Pages';
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
  const { t } = useTranslation(['NetworkStatusWidget', 'translation']);
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
                  key: t('host_label'),
                  value: <Typography.Text>{config?.name ?? t('not_configured')}</Typography.Text>,
                },
                {
                  key: t('host_url'),
                  value: (
                    <Typography.Text copyable={{ content: config?.HV_URL ?? t('not_configured') }}>
                      {secretURL(config?.HV_URL ?? t('not_configured'))}
                    </Typography.Text>
                  ),
                },
                {
                  key: t('terminal_id'),
                  value: (
                    <Typography.Text copyable>{config?.TERMINAL_ID ?? t('not_configured')}</Typography.Text>
                  ),
                },
                {
                  key: t('upload_rate'),
                  value: `${network[0]} kbps`,
                },
                {
                  key: t('download_rate'),
                  value: `${network[1]} kbps`,
                },
                {
                  key: t('status'),
                  value: <Typography.Text>{+network[1] > 0 ? t('online') : t('offline')}</Typography.Text>,
                },
              ]}
            ></Descriptions>
            <Button
              icon={<IconWrench />}
              onClick={() => {
                openPage('HostList');
              }}
            >
              {t('config')}
            </Button>
            <Button
              icon={<IconUnlink />}
              disabled={!currentHostConfig$.value}
              onClick={() => {
                currentHostConfig$.next(null);
                location.reload();
              }}
            >
              {t('disconnect')}
            </Button>
          </Card>
        }
      >
        <Typography.Text
          icon={
            config ? <IconSignal style={{ color: +network[1] > 0 ? 'green' : 'red' }} /> : <IconDesktop />
          }
        >
          {config ? `${config.name} / ${config.TERMINAL_ID}` : t('No_Host')}
        </Typography.Text>
      </Popover>
    </Space>
  );
});
