import { IconTick, IconWrench } from '@douyinfe/semi-icons';
import { Button, Card, Progress, Space, Typography } from '@douyinfe/semi-ui';
import { IAgentConf } from '@yuants/agent';
import { JSONSchema7 } from 'json-schema';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { first, from, fromEvent, lastValueFrom, map, mergeAll, mergeMap, tap, toArray } from 'rxjs';
import Form from '../../Form';
import { IMessageCardProps } from '../model';

import { IBatchAgentResultItem } from '../../Agent/utils';
import Worker from '../../Agent/webworker?worker';

// TODO: hackathon code, refine later
export default ({
  replaceMessage: appendMessages,
  payload,
}: IMessageCardProps<{
  bundled_code: string;
  paramList: Record<string, number>[];
  schema: JSONSchema7;
}>) => {
  const { t } = useTranslation('Copilot');
  const [formData, setFormData] = useState(undefined);
  const [isLoading, setLoading] = useState(false);
  const [jobs, setJobs] = useState(window.navigator.hardwareConcurrency || 1);

  const [progress, setProgress] = useState({ current: 0, startTime: 0, endTime: 0 });

  return (
    <Card
      style={{ width: '100%', flexShrink: 0 }}
      title={
        <Space>
          <IconWrench />{' '}
          <Typography.Text strong>{t('Copilot:AgentBatchBacktestConfigForm:title')}</Typography.Text>
        </Space>
      }
      actions={[
        //
        <Button
          icon={<IconTick />}
          disabled={!formData}
          loading={isLoading}
          onClick={async () => {
            //
            setLoading(true);

            const results = await lastValueFrom(
              from(payload.paramList).pipe(
                map((agent_param): IAgentConf => {
                  const data: any = formData;
                  return {
                    ...agent_param,
                    ...data,
                    kernel_id: `Model-${Object.entries(agent_param)
                      .map(([k, v]) => `${k}_${v}`)
                      .join('-')}`,
                  };
                }),
                mergeMap((agentConf) => {
                  const worker = new Worker();
                  worker.postMessage({ agentConf });
                  return fromEvent(worker, 'message').pipe(
                    //
                    first(),
                    map((msg: any): IBatchAgentResultItem[] => msg.data),

                    tap({
                      complete: () => {
                        setProgress((x) => ({
                          ...x,
                          current: x.current + 1,
                          endTime: Math.max(x.endTime, Date.now()),
                        }));
                      },
                      finalize: () => {
                        setProgress((x) => ({
                          ...x,
                          endTime: Math.max(x.endTime, Date.now()),
                        }));
                        worker.terminate();
                      },
                    }),
                  );
                }, jobs),
                mergeAll(),
                toArray(),
              ),
            );

            appendMessages([
              {
                type: 'SystemBatchBacktestResult',
                payload: {
                  results,
                },
              },
            ]);

            setLoading(false);
          }}
        >
          {t('Copilot:AgentBatchBacktestConfigForm:run')}
        </Button>,
      ]}
    >
      <Progress
        percent={
          payload.paramList.length ? Math.round((progress.current / payload.paramList.length) * 100) : 0
        }
        showInfo
      />
      <Form
        schema={payload.schema}
        formData={formData}
        onChange={(e) => {
          setFormData(e.formData);
        }}
      >
        <div></div>
      </Form>
    </Card>
  );
};
