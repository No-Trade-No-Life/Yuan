import { IconTick, IconWrench } from '@douyinfe/semi-icons';
import { Button, Card, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { IAgentConf } from '@yuants/agent';
import Ajv from 'ajv';
import { t } from 'i18next';
import { JSONSchema7 } from 'json-schema';
import { useState } from 'react';
import { AccountFrameUnit } from '../../AccountInfo/AccountFrameUnit';
import { accountFrameSeries$, accountPerformance$ } from '../../AccountInfo/model';
import { executeCommand } from '../../CommandCenter';
import Form from '../../Form';
import { currentKernel$ } from '../../Kernel/model';
import { orders$ } from '../../Order/model';
import { recordTable$ } from '../../Shell/model';
import { LocalAgentScene } from '../../StaticFileServerStorage/LocalAgentScene';
import { IMessageCardProps } from '../model';

export default ({
  sendMessages,
  payload,
}: IMessageCardProps<{
  bundled_code: string;
  schema: JSONSchema7;
}>) => {
  const [formData, setFormData] = useState(undefined);
  return (
    <Card
      style={{ width: '100%', flexShrink: 0 }}
      title={
        <Space>
          <IconWrench /> <Typography.Text strong>Agent Configuration</Typography.Text>
        </Space>
      }
      actions={[
        //
        <Button
          icon={<IconTick />}
          disabled={!formData}
          onClick={async () => {
            //
            const agentConf: IAgentConf = {
              bundled_code: payload.bundled_code,
              agent_params: formData,
              is_real: false,
              kernel_id: 'Model',
              disable_log: true,
              use_general_product: false,
            };
            const validator = new Ajv({ strictSchema: false });
            const isValid = validator.validate(payload.schema, formData);
            if (!isValid) {
              const msg = validator.errors?.map((e) => e.message).join();
              Toast.error(`${t('AgentConfForm:config_invalid')}: ${msg}`);
              console.error(validator.errors);
              throw msg;
            }
            const scene = await LocalAgentScene(agentConf);
            const accountFrameUnit = new AccountFrameUnit(
              scene.kernel,
              scene.accountInfoUnit,
              scene.accountPerformanceUnit,
            );
            await scene.kernel.start();
            currentKernel$.next(scene.kernel);

            recordTable$.next(scene.agentUnit.record_table);

            orders$.next(scene.historyOrderUnit.historyOrders);
            accountPerformance$.next(
              Object.fromEntries(scene.accountPerformanceUnit.mapAccountIdToPerformance.entries()),
            );
            accountFrameSeries$.next(accountFrameUnit.data);
            executeCommand('Page.open', { type: 'AccountPerformancePanel' });

            Toast.success(t('AgentConfForm:run_succeed'));
            gtag('event', 'agent_run_complete');
          }}
        >
          Run
        </Button>,
      ]}
    >
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
