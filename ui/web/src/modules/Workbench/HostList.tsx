import { IconDelete, IconEdit, IconPlus, IconSend, IconShareStroked } from '@douyinfe/semi-icons';
import {
  Button,
  ButtonGroup,
  Descriptions,
  List,
  Modal,
  Popconfirm,
  Space,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import copy from 'copy-to-clipboard';
import { JSONSchema7 } from 'json-schema';
import { useObservableState } from 'observable-hooks';
import React from 'react';
import Form from '../Form';
import { secretURL } from '../Terminals/NetworkStatusWidget';
import { IHostConfigItem, currentHostConfig$, hostConfigList$ } from './model';

const configSchema: JSONSchema7 = {
  type: 'object',
  required: ['TERMINAL_ID', 'HV_URL'],
  properties: {
    name: {
      type: 'string',
      title: '主机助记名',
      description: '用于区分您的多个主机，取值不影响连接',
      default: '未命名主机',
    },
    TERMINAL_ID: {
      type: 'string',
      title: '终端ID',
      description: '同一主机中与其他终端区分的标志，同一主机内不能重复',
    },
    HV_URL: { type: 'string', title: '主机地址', description: '请询问您的主机管理员' },
  },
};

export const HostList = React.memo(() => {
  const configs = useObservableState(hostConfigList$, []);

  return (
    <Space vertical align="start">
      <Typography.Text>
        请先连接至主机，以便使用 Yuan 的基本功能，参考
        <Typography.Text
          link={{ href: 'https://tradelife.feishu.cn/wiki/wikcnngkZL7MmoR2OGEG8MioH6g', target: '_blank' }}
        >
          用户手册
        </Typography.Text>
        。
      </Typography.Text>
      <ButtonGroup>
        <Button
          icon={<IconPlus />}
          onClick={async () => {
            const item = await userForm('新增主机配置', configSchema);
            hostConfigList$.next([...(hostConfigList$.value ?? []), item]);
          }}
        >
          新增
        </Button>
      </ButtonGroup>
      <List
        dataSource={configs}
        renderItem={(config, idx) => (
          <List.Item>
            <Space vertical align="start">
              <Descriptions
                data={[
                  //
                  { key: '主机标签', value: config.name },
                  {
                    key: '主机地址',
                    value: (
                      <Typography.Text copyable={{ content: config.HV_URL }}>
                        {secretURL(config.HV_URL)}
                      </Typography.Text>
                    ),
                  },
                  { key: '终端ID', value: config.TERMINAL_ID },
                ]}
              ></Descriptions>
              <ButtonGroup>
                <Button
                  icon={<IconSend />}
                  onClick={() => {
                    currentHostConfig$.next(config);
                    setTimeout(() => {
                      // ISSUE: 在保证切换 terminal 能正常 GC 掉旧的 terminal 之前，刷新页面以确保状态干净。
                      window.location.reload();
                    }, 500);
                  }}
                >
                  连接
                </Button>
                <Button
                  icon={<IconEdit />}
                  onClick={async () => {
                    const input = await userForm('编辑主机', configSchema, config);
                    const original = hostConfigList$.value ?? [];
                    hostConfigList$.next([...original.slice(0, idx), input, ...original.slice(idx + 1)]);
                  }}
                ></Button>
                <Button
                  icon={<IconShareStroked />}
                  onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set(
                      'q',
                      window.btoa(
                        JSON.stringify({
                          type: 'ConfigHost',
                          payload: { name: config.name, URL: config.HV_URL },
                        }),
                      ),
                    );
                    const theUrl = url.toString();
                    copy(theUrl);
                    Toast.success(`已复制链接`);
                  }}
                ></Button>
                <Popconfirm
                  style={{ width: 300 }}
                  title="确定是否删除？"
                  content="此操作将不可逆"
                  onConfirm={() => {
                    hostConfigList$.next(hostConfigList$.value!.filter((item) => item !== config));
                  }}
                >
                  <Button icon={<IconDelete />} type="danger"></Button>
                </Popconfirm>
              </ButtonGroup>
            </Space>
          </List.Item>
        )}
      ></List>
    </Space>
  );
});
function userForm<T>(title: string, schema: JSONSchema7, initialData?: any) {
  return new Promise<IHostConfigItem>((resolve, reject) => {
    const modal = Modal.info({
      title,
      content: (
        <Form
          schema={schema}
          formData={initialData}
          uiSchema={{
            'ui:submitButtonOptions': {
              submitText: '提交',
            },
          }}
          onSubmit={(e) => {
            resolve(e.formData);
            modal.destroy();
          }}
        ></Form>
      ),
      onCancel: () => {
        reject(new Error('User Cancelled'));
      },
      okText: '取消',
      hasCancel: false,
    });
  });
}
