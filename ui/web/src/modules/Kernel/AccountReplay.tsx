import { Banner, Button, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { AccountReplayScene, HistoryOrderUnit, StopLossAccountReplayScene } from '@yuants/kernel';
import { useObservableState } from 'observable-hooks';
import React, { useState } from 'react';
import { terminal$ } from '../../common/create-connection';
import { PERIOD_IN_SEC_TO_LABEL } from '../../common/utils';
import { AccountFrameUnit } from '../AccountInfo/AccountFrameUnit';
import { accountFrameSeries$, accountIds$, accountPerformance$ } from '../AccountInfo/model';
import { registerCommand } from '../CommandCenter';
import { Form } from '../Form';
import { orders$ } from '../Order/model';
import { openPage } from '../Pages';
import { currentKernel$ } from './model';

export const AccountReplay = React.memo(() => {
  const terminal = useObservableState(terminal$);
  const accountList = useObservableState(accountIds$, []);

  const [formData, setFormData] = useState({
    account_id: '',
    currency: '',
    leverage: 1,
    pull_source: false,
    period_in_sec: 0,
    resume_on_source_margin_below: undefined as number | undefined,
    datasource_id: undefined as string | undefined,
    start_time: undefined as string | undefined,
    end_time: undefined as string | undefined,
  });

  return (
    <div>
      <Banner
        fullMode={false}
        type="info"
        bordered
        closeIcon={null}
        title={<div style={{ fontWeight: 600, fontSize: '14px', lineHeight: '20px' }}>账户回放</div>}
        description={
          <div>
            请参考
            <Typography.Text
              link={{
                target: '_blank',
                href: 'https://tradelife.feishu.cn/wiki/wikcnNQ0eL32ldL2PdSpDXofbFb',
              }}
            >
              功能说明书
            </Typography.Text>
            。
          </div>
        }
      />
      <Space vertical align="start">
        <Form
          formData={formData}
          onChange={(e) => {
            setFormData(e.formData);
          }}
          schema={{
            type: 'object',
            properties: {
              account_id: { type: 'string', title: '回放账户', examples: accountList },
              currency: { type: 'string', title: '回放币种' },
              leverage: { type: 'number', title: '杠杆倍数', default: 1 },
              pull_source: {
                type: 'boolean',
                title: '拉取源数据',
                description: '打开后会从源拉取订单，速度较慢。关闭后会使用数据库缓存，速度较快。',
              },
              period_in_sec: {
                type: 'number',
                title: '行情周期',
                description: '额外借用行情数据进行浮动盈亏的还原。周期越小，计算量越大，还原精度越高。',
                enum: [0].concat(Object.keys(PERIOD_IN_SEC_TO_LABEL).map((v) => +v)),
                enumNames: ['不使用'].concat(Object.values(PERIOD_IN_SEC_TO_LABEL)),
                default: 0,
              },
              resume_on_source_margin_below: {
                type: 'number',
                title: '恢复止损使用保证金阈值',
                description: '当源账户的保证金低于此值时，恢复止损。',
              },
              datasource_id: {
                type: 'string',
                title: '数据源',
                description: '选择数据源，如果不选择，则使用账户 ID 作为数据源。',
              },
              start_time: {
                type: 'string',
                title: '开始时间',
                description: '请按照您的本地时区填写',
                format: 'date-time',
              },
              end_time: {
                type: 'string',
                title: '结束时间',
                description: '请按照您的本地时区填写',
                format: 'date-time',
              },
            },
          }}
        >
          <div></div>
        </Form>
        <Button
          onClick={() => {
            if (terminal) {
              Toast.info(`账户 ${formData.account_id} 重放...`);

              const { kernel, accountInfoUnit, accountPerformanceUnit } =
                formData.resume_on_source_margin_below
                  ? StopLossAccountReplayScene(
                      terminal,
                      formData.account_id,
                      formData.currency,
                      formData.leverage,
                      formData.start_time ? new Date(formData.start_time!).getTime() : 0,
                      formData.end_time ? new Date(formData.end_time!).getTime() : Date.now(),
                      formData.period_in_sec,
                      formData.resume_on_source_margin_below,
                      formData.datasource_id,
                    )
                  : AccountReplayScene(
                      terminal,
                      formData.account_id,
                      formData.currency,
                      formData.leverage,
                      formData.start_time ? new Date(formData.start_time!).getTime() : 0,
                      formData.end_time ? new Date(formData.end_time!).getTime() : Date.now(),
                      formData.period_in_sec,
                      formData.datasource_id,
                    );

              const accountFrameUnit = new AccountFrameUnit(kernel, accountInfoUnit, accountPerformanceUnit);

              kernel.start().then(() => {
                currentKernel$.next(kernel);
                orders$.next(
                  kernel.units.find((unit): unit is HistoryOrderUnit => unit instanceof HistoryOrderUnit)
                    ?.historyOrders ?? [],
                );
                Toast.success(`账户 ${formData.account_id} 重放完成`);
                accountFrameSeries$.next(accountFrameUnit.data);
                accountPerformance$.next(accountPerformanceUnit.performance);
              });
            }
          }}
        >
          重放
        </Button>
      </Space>
    </div>
  );
});

registerCommand('AccountReplay', () => {
  openPage('AccountReplay');
});
