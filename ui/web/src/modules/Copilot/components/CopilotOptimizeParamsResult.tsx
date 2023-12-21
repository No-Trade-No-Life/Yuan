import { IconCode, IconTick } from '@douyinfe/semi-icons';
import { Card, Divider, Progress, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { Button } from '../../Interactive';
import { IAgentConf } from '@yuants/agent';
import { formatTime } from '@yuants/data-model';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { first, from, fromEvent, lastValueFrom, map, mergeAll, mergeMap, tap, toArray } from 'rxjs';
import { IBatchAgentResultItem, bundleCodeFromInMemoryCode } from '../../Agent/utils';
import Worker from '../../Agent/webworker?worker';
import { executeCommand } from '../../CommandCenter';
import { MonacoEditor } from '../../Editor/Monaco';
import { IMessageCardProps } from '../model';
import ts from 'typescript';

const combination = (list: [string, number[]][], acc: Record<string, number>[]): Record<string, number>[] => {
  if (list.length === 0) {
    return acc;
  }
  const [key, candidates] = list[0];
  const newAcc = acc.flatMap((item) => candidates.map((candidate) => ({ ...item, [key]: candidate })));
  return combination(list.slice(1), newAcc);
};

export default ({
  replaceMessage,
  messages,
  payload,
}: IMessageCardProps<{
  code: string;
  agent_params: Record<string, number[]>;
}>) => {
  const { t } = useTranslation();

  const [jobs, setJobs] = useState(window.navigator.hardwareConcurrency || 1);

  const [started, setStarted] = useState(false);

  const [progress, setProgress] = useState({ current: 0, startTime: 0, endTime: 0 });

  //@ts-ignore
  const agentConf = messages.findLast((msg) => msg.payload.agent_conf !== undefined)?.payload.agent_conf;

  const total = useRef(0);

  return (
    <Card
      title={
        <Space>
          <IconCode />
          <Typography.Text strong>{t('Copilot:CopilotParamList:title')}</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
      actions={[
        //
        <Button
          icon={<IconTick />}
          onClick={async () => {
            setStarted(true);
            try {
              await executeCommand('workspace.import_examples');
              const bundled_code = await bundleCodeFromInMemoryCode(payload.code);
              const paramList = combination(Object.entries(payload.agent_params), [{}]);

              total.current = paramList.length;

              const results = await lastValueFrom(
                from(paramList).pipe(
                  map((agent_params): IAgentConf => {
                    return {
                      bundled_code,
                      agent_params: {
                        ...agentConf.agent_params,
                        ...agent_params,
                      },
                      kernel_id: `Model-${Object.entries(agent_params)
                        .map(([k, v]) => `${v}`)
                        .join('-')}`,
                    };
                  }),
                  mergeMap((agentConf, i) => {
                    const worker = new Worker();
                    worker.postMessage({ agentConf });
                    return fromEvent(worker, 'message').pipe(
                      //
                      first(),
                      map((msg: any): IBatchAgentResultItem[] => msg.data),
                      tap({
                        subscribe: () => {
                          console.info(
                            formatTime(Date.now()),
                            `批量回测子任务开始: ${i + 1}/${total.current}`,
                          );
                        },
                        error: (err) => {
                          console.info(
                            formatTime(Date.now()),
                            `批量回测子任务异常: ${i + 1}/${total.current}: ${err}`,
                          );
                        },
                        complete: () => {
                          console.info(
                            formatTime(Date.now()),
                            `批量回测子任务完成: ${i + 1}/${total.current}`,
                          );
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

              results.sort((a, b) => b.performance.weekly_return_ratio - a.performance.weekly_return_ratio);

              const optimalResult = results[0];

              replaceMessage([
                {
                  type: 'SystemBatchBacktestResult',
                  payload: {
                    results,
                  },
                },
                {
                  type: 'SystemBacktestResult',
                  payload: {
                    agent_conf: optimalResult,
                    account_performance: {
                      [optimalResult.performance.account_id]: optimalResult.performance,
                    },
                  },
                },
              ]);
            } catch (e) {
              console.info(formatTime(Date.now()), `${e}`);
              setStarted(false);
            }
          }}
        >
          {t('Copilot:CopilotParamList:code_complete')}
        </Button>,
      ]}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <Typography.Title heading={3}>{t('Copilot.CopilotParamList.params')}</Typography.Title>
        {Object.entries(payload.agent_params).map(([key, candidates]) => (
          <Typography.Text>
            {key}:{' '}
            <Space>
              {candidates.map((v) => (
                <Tag>{v}</Tag>
              ))}
            </Space>
          </Typography.Text>
        ))}
        <Divider />
        <div style={{ width: '100%', height: 400 }}>
          <MonacoEditor
            value={payload.code}
            language="typescript"
            onConstruct={(editor) => {
              editor.updateOptions({ readOnly: true });
            }}
          />
        </div>

        {started && [
          <Typography.Title heading={6}>{t('Copilot.CopilotParamList.progress')}</Typography.Title>,
          <Progress
            // percent={total.current ? Math.round((progress.current / total.current) * 100) : 0}
            percent={total.current ? Math.round((progress.current / total.current) * 100) : 0}
            showInfo
            // type="circle"
            style={{ height: '8px', width: '100%' }}
          />,
        ]}
      </Space>
    </Card>
  );
};
