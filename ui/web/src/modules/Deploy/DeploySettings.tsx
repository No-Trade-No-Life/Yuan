import {
  IconArrowUp,
  IconDelete,
  IconEdit,
  IconFile,
  IconHelpCircle,
  IconMinusCircle,
  IconPlusCircle,
} from '@douyinfe/semi-icons';
import { ArrayField, Form, Modal, Space, Tooltip, Typography } from '@douyinfe/semi-ui';
import { createCache } from '@yuants/cache';
import { IDeployment } from '@yuants/deploy';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { UUID } from '@yuants/utils';
import { useObservableState } from 'observable-hooks';
import { useEffect, useState } from 'react';
import { firstValueFrom } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { resolveVersion } from '../Extensions';
import { Button, DataView, Switch, Toast } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { InlineNodeUnitAddress } from './InlineNodeUnitAddress';
import { availableNodeUnit$, deployments$, refreshDeployments$ } from './model';
import { escapeForBash } from './utils';

const packageVersionsCache = createCache<string[]>(
  (packageName) =>
    resolveVersion({ name: packageName, registry: 'https://registry.npmjs.org' }).then((info) => {
      const versions: string[] = Object.keys(info.meta.versions)
        .map((v) => v.split('.'))
        // Sort by major, minor, patch in descending order
        .sort((a, b) => +b[0] - +a[0] || +b[1] - +a[1] || +b[2] - +a[2])
        .map((v) => v.join('.'));
      return versions;
    }),
  {
    expire: 600_000, // Cache for 10 minutes
  },
);

registerPage('DeploySettings', () => {
  const deploySettings = useObservableState(deployments$);
  const [editDeployment, setEditDeployment] = useState<IDeployment>();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showEnabledOnly, setShowEnabledOnly] = useState(false);

  const availableNodeUnit = useObservableState(availableNodeUnit$);

  useEffect(() => {
    if (editDeployment?.package_name) {
      packageVersionsCache.query(editDeployment.package_name, true);
    }
  }, [editDeployment?.package_name]);

  const onDelete = async (id: string) => {
    try {
      const terminal = await firstValueFrom(terminal$);
      if (terminal) {
        await requestSQL(
          terminal,
          `
          delete from deployment where id=${escapeSQL(id)}
          `,
        );
        Toast.success('删除成功');
        refreshDeployments$.next();
      }
    } catch (e) {
      Toast.error('删除失败');
    }
  };

  const updateToLatestVersion = async () => {
    if (deploySettings) {
      const packages = new Set<string>(deploySettings.map((x) => x.package_name));
      await Promise.allSettled([...packages].map((pkg) => packageVersionsCache.query(pkg, true)));
      const deploymentsToUpdate: IDeployment[] = [];
      deploySettings.forEach((setting) => {
        const nextVersion = packageVersionsCache.get(setting.package_name || '')?.[0] || '';
        if (nextVersion && nextVersion !== setting.package_version) {
          deploymentsToUpdate.push({
            ...setting,
            type: setting.type || 'deployment',
            package_version: nextVersion,
          });
        }
      });
      onUpdate(deploymentsToUpdate);
    }
  };

  const onOpenEdit = () => {
    setVisible(true);
  };

  const onCloseEdit = () => {
    setVisible(false);
    setEditDeployment(undefined);
  };
  const onSave = async () => {
    if (editDeployment) {
      setLoading(true);
      onUpdate([editDeployment]);
      setLoading(false);
    }
  };
  const onEdit = (deployment: IDeployment) => {
    setEditDeployment({ ...deployment, type: deployment.type || 'deployment' });
    onOpenEdit();
  };
  const onCreate = () => {
    setEditDeployment({ id: UUID(), enabled: false, type: 'deployment' } as IDeployment);
    onOpenEdit();
  };
  const onUpdate = async (deployments: IDeployment[]) => {
    try {
      const terminal = await firstValueFrom(terminal$);
      if (terminal) {
        const result = await requestSQL<IDeployment[]>(
          terminal,
          buildInsertManyIntoTableSQL(deployments, 'deployment', {
            columns: [
              //
              'id',
              'type',
              'package_name',
              'package_version',
              'env',
              'address',
              'command',
              'args',
              'enabled',
            ],
            conflictKeys: ['id'],
            returningAll: true,
          }),
        );
        refreshDeployments$.next();
        Toast.success(`成功更新 ${result.length} 条数据记录`);
        setVisible(false);
      }
    } catch (e) {
      Toast.error('更新失败: ' + e);
      console.log('UpdateError', e);
    }
  };

  return (
    <>
      <DataView
        data={deploySettings?.filter((x) => (showEnabledOnly ? x.enabled : true))}
        topSlot={
          <>
            <Button icon={<IconPlusCircle />} onClick={onCreate} style={{ margin: '10px 0' }}>
              创建新部署
            </Button>
            <Button icon={<IconPlusCircle />} onClick={updateToLatestVersion} style={{ margin: '10px 0' }}>
              版本一键更新
            </Button>
            <div style={{ alignItems: 'center', marginLeft: 10, display: 'inline-flex' }}>
              <span style={{ marginRight: 8 }}>只看已启用</span>
              <Switch checked={showEnabledOnly} onChange={setShowEnabledOnly} />
            </div>
          </>
        }
        columns={[
          {
            header: '类型',
            accessorKey: 'type',
            cell: (ctx) => (ctx.getValue() === 'daemon' ? '守护进程 (Daemon)' : '部署 (Deployment)'),
          },
          {
            header: '部署地址',
            accessorKey: 'address',
            cell: (ctx) => {
              const isDaemon = ctx.row.original.type === 'daemon';
              if (isDaemon) {
                return <Typography.Text type="secondary">每节点一个</Typography.Text>;
              }
              return <InlineNodeUnitAddress address={ctx.getValue()} />;
            },
          },
          {
            header: '部署 ID',
            accessorKey: 'id',
          },
          {
            header: 'NPM 包名',
            accessorKey: 'package_name',
            cell: (ctx) => (
              <Typography.Text
                link={{ href: `https://www.npmjs.com/package/${ctx.getValue()}`, target: '_blank' }}
                copyable
              >
                {ctx.getValue()}
              </Typography.Text>
            ),
          },
          {
            header: '版本',
            accessorKey: 'package_version',
            cell: (ctx) => {
              const latestVersion = packageVersionsCache.get(ctx.row.original.package_name || '')?.[0];

              useEffect(() => {
                if (ctx.row.original.package_name) {
                  packageVersionsCache.query(ctx.row.original.package_name);
                }
              }, [ctx.row.original.package_name]);

              return (
                <Space>
                  {ctx.getValue()}
                  {latestVersion && latestVersion !== ctx.getValue() ? (
                    <Tooltip content={`最新版本 ${latestVersion}`}>
                      <IconArrowUp style={{ color: '--var(--semi-color-success)' }} />
                    </Tooltip>
                  ) : null}
                </Space>
              );
            },
          },
          {
            header: '环境变量',
            accessorKey: 'env',
            accessorFn: (x) =>
              Object.entries(x.env)
                .map(([key, v]) => `${key}=${escapeForBash(v)}`)
                .join(' '),
          },
          {
            header: '运行命令',
            accessorKey: 'command',
          },
          {
            header: '命令参数',
            accessorFn: (x) => (x.args || []).join(' '),
          },
          {
            header: '动作',
            id: 'actions',
            meta: {
              fixed: 'right',
            },
            cell: (ctx) => (
              <Space>
                <Switch
                  checked={ctx.row.original.enabled}
                  onChange={async (checked) => {
                    await onUpdate([{ ...ctx.row.original, enabled: checked }]);
                  }}
                />
                <Button
                  icon={<IconFile />}
                  onClick={() =>
                    executeCommand('DeploymentRealtimeLog', {
                      node_unit_address: ctx.row.original.address,
                      deployment_id: ctx.row.original.id,
                    })
                  }
                >
                  日志
                </Button>
                <Button icon={<IconEdit />} onClick={() => onEdit(ctx.row.original)} />
                <Button
                  type="danger"
                  icon={<IconDelete />}
                  doubleCheck={{
                    title: '确认删除此配置？',
                    description: (
                      <pre
                        style={{
                          width: '100%',
                          overflow: 'auto',
                        }}
                      >
                        {JSON.stringify(ctx.row.original, null, 2)}
                      </pre>
                    ),
                  }}
                  onClick={() => onDelete(ctx.row.original.id)}
                />
              </Space>
            ),
          },
        ]}
      />
      <Modal
        visible={visible}
        okText="保存"
        onOk={onSave}
        confirmLoading={loading}
        onCancel={onCloseEdit}
        width={900}
      >
        {visible && editDeployment && (
          <Form
            onValueChange={(values: any) => {
              const args = values.args.map((item: { arg: string }) => item.arg) as string[];

              const env: Record<string, string> = {};
              values.env?.forEach((item: { key: string; value: string }) => {
                env[item.key] = item.value || ''; // Ensure value defaults to empty string
              });
              if (values.type === 'daemon') {
                values.address = '';
              }
              setEditDeployment({
                ...values,
                args,
                env,
                // default command to empty string if undefined
                command: values.command || '',
              });
            }}
            initValues={editDeployment}
            labelAlign="left"
            labelPosition={'left'}
            style={{ marginTop: '20px' }}
          >
            <Form.Input field="package_name" label="NPM 包名" style={{ width: '560px' }} />
            <Form.Select
              field="type"
              label="部署类型"
              style={{ width: '560px' }}
              optionList={[
                { value: 'deployment', label: 'Deployment' },
                { value: 'daemon', label: 'Daemon' },
              ]}
            />
            <Form.AutoComplete
              field="package_version"
              label="部署版本"
              style={{ width: '560px' }}
              data={packageVersionsCache.get(editDeployment.package_name ?? '') ?? []}
            />

            {editDeployment.type !== 'daemon' && (
              <Form.AutoComplete
                field="address"
                label={{
                  text: '部署地址',
                  extra: (
                    <Tooltip content="部署到指定的 Node Unit 地址 (ED25519 公钥)。NodeUnit 仅会部署与其地址匹配的项目。">
                      <IconHelpCircle style={{ color: 'var(--semi-color-text-2)' }} />
                    </Tooltip>
                  ),
                }}
                style={{ width: '560px' }}
                data={availableNodeUnit?.map((unit) => ({
                  label: `${unit.node_unit_name} (${unit.node_unit_address}) @yuants/node-unit@${unit.node_unit_version}`,
                  value: unit.node_unit_address,
                }))}
              />
            )}

            <Form.Section text="环境变量" />
            <ArrayField
              field="env"
              initValue={Object.entries(editDeployment?.env ?? {})?.map(([k, v]) => ({ key: k, value: v }))}
            >
              {({ add, arrayFields, addWithInitValue }) => (
                <>
                  <Button onClick={add} icon={<IconPlusCircle />} theme="light" style={{ display: 'flex' }}>
                    Add new env
                  </Button>
                  {arrayFields.map(({ field, key, remove }, i) => (
                    <div
                      key={key}
                      style={{ width: '100%', display: 'flex', gap: '8px', justifyContent: 'space-between' }}
                    >
                      <Form.Input field={`${field}[key]`} label={`key[${i}]`} style={{ width: '300px' }} />
                      <Form.Input
                        field={`${field}[value]`}
                        label={`value[${i}]`}
                        style={{ width: '300px' }}
                      />
                      <Button
                        type="danger"
                        theme="borderless"
                        icon={<IconMinusCircle />}
                        onClick={remove}
                        style={{ margin: 12 }}
                      />
                    </div>
                  ))}
                </>
              )}
            </ArrayField>
            <Form.Section text="自定义启动命令 (高级)" />
            <Form.Input field="command" label="command" style={{ width: '560px' }} />
            <ArrayField field="args" initValue={(editDeployment?.args ?? []).map((item) => ({ arg: item }))}>
              {({ add, arrayFields, addWithInitValue }) => (
                <>
                  <Button onClick={add} icon={<IconPlusCircle />} theme="light" style={{ display: 'flex' }}>
                    Add new arg
                  </Button>
                  {arrayFields.map(({ field, key, remove }, i) => (
                    <div key={key} style={{ display: 'flex' }}>
                      <Form.Input
                        field={`${field}[arg]`}
                        label={`arg[${i}]`}
                        style={{ width: 400, marginRight: 16 }}
                      />
                      <Button
                        type="danger"
                        theme="borderless"
                        icon={<IconMinusCircle />}
                        onClick={remove}
                        style={{ margin: 12 }}
                      />
                    </div>
                  ))}
                </>
              )}
            </ArrayField>
          </Form>
        )}
      </Modal>
    </>
  );
});
