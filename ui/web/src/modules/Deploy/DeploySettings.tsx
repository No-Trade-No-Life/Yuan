import { IconHelpCircle, IconMinusCircle, IconPlusCircle } from '@douyinfe/semi-icons';
import { ArrayField, Form, Modal, Popconfirm, Space, Tooltip } from '@douyinfe/semi-ui';
import { IDeployment } from '@yuants/deploy';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { UUID } from '@yuants/utils';
import { useObservableState } from 'observable-hooks';
import { useEffect, useState } from 'react';
import {
  BehaviorSubject,
  combineLatest,
  defer,
  firstValueFrom,
  forkJoin,
  from,
  map,
  of,
  repeat,
  retry,
  shareReplay,
  switchMap,
} from 'rxjs';
import { resolveVersion } from '../Extensions';
import { Button, Switch, Toast } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { escapeForBash } from './utils';
const { Option } = Form.Select;
export const refresh$ = new BehaviorSubject<void>(undefined);

const deploySettings$ = combineLatest([terminal$, refresh$]).pipe(
  //
  switchMap(([terminal]) =>
    defer(() =>
      terminal
        ? requestSQL(
            terminal,
            `
            select * from deployment order by created_at desc;
        `,
          )
        : of([]),
    ).pipe(
      //
      map((x) => x as IDeployment[]),
      repeat({ delay: 2_000 }),
      retry({ delay: 2_000 }),
    ),
  ),
  shareReplay(1),
);
const packageVersion$ = deploySettings$.pipe(
  //
  switchMap((settings) =>
    forkJoin(
      settings
        .filter((setting) => Boolean(setting.package_name))
        .map((setting) =>
          fetchVersionInfo(setting.package_name).pipe(
            map((version) => ({ packageName: setting.package_name, version })),
          ),
        ),
    ),
  ),
);

const mapPackageNameToVersions = new Map<string, string[]>();

const fetchVersionInfo = (packageName: string) => {
  if (mapPackageNameToVersions.has(packageName)) {
    return of(mapPackageNameToVersions.get(packageName)?.[0]);
  }
  return from(
    resolveVersion({ name: packageName, registry: 'https://registry.npmjs.org' }).then((info) => {
      const versions = Object.keys(info.meta.versions).reverse() as string[];
      mapPackageNameToVersions.set(packageName, versions);
      return info.version;
    }),
  );
};

registerPage('DeploySettings', () => {
  const deploySettings = useObservableState(deploySettings$);
  const [editDeployment, setEditDeployment] = useState<IDeployment>();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const packageVersion = useObservableState(packageVersion$);

  useEffect(() => {
    if (editDeployment?.package_name && !mapPackageNameToVersions.has(editDeployment.package_name)) {
      fetchVersionInfo(editDeployment.package_name).subscribe();
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
        refresh$.next();
      }
    } catch (e) {
      Toast.error('删除失败');
    }
  };

  const updateToLatestVersion = () => {
    if (packageVersion && deploySettings) {
      const newSettings = deploySettings.map((setting) => {
        const version = packageVersion.find((xx) => setting.package_name === xx.packageName);
        if (version && version.version) {
          setting.package_version = version.version;
        }
        return setting;
      });
      onUpdate(newSettings);
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
    setEditDeployment(deployment);
    onOpenEdit();
  };
  const onCreate = () => {
    setEditDeployment({ id: UUID(), enabled: false } as IDeployment);
    onOpenEdit();
  };
  const onUpdate = async (deployment: IDeployment[]) => {
    try {
      const terminal = await firstValueFrom(terminal$);
      if (terminal) {
        const result = await requestSQL(
          terminal,
          buildInsertManyIntoTableSQL(deployment, 'deployment', {
            columns: [
              //
              'id',
              'package_name',
              'package_version',
              'env',
              'address',
              'command',
              'args',
              'enabled',
            ],
            conflictKeys: ['id'],
          }),
        );
        refresh$.next();
        Toast.success('更新成功');
        setVisible(false);
      }
    } catch (e) {
      Toast.error('更新失败');
      console.log('UpdateError', e);
    }
  };

  return (
    <>
      <Modules.Interactive.DataView
        data={deploySettings}
        topSlot={
          <>
            <Button icon={<IconPlusCircle />} onClick={onCreate} style={{ margin: '10px 0' }}>
              创建新配置
            </Button>
            <Button icon={<IconPlusCircle />} onClick={updateToLatestVersion} style={{ margin: '10px 0' }}>
              版本一键更新
            </Button>
          </>
        }
        columns={[
          {
            header: 'id',
            accessorKey: 'id',
          },
          {
            header: 'package_name',
            accessorKey: 'package_name',
          },
          {
            header: 'package_version',
            accessorKey: 'package_version',
          },
          {
            header: 'env',
            accessorKey: 'env',
            accessorFn: (x) =>
              Object.entries(x.env)
                .map(([key, v]) => `${key}=${escapeForBash(v)}`)
                .join(' '),
          },
          {
            header: 'address',
            accessorKey: 'address',
          },
          {
            header: 'command',
            accessorKey: 'command',
          },
          {
            header: 'args',
            accessorFn: (x) => (x.args || []).join(' '),
          },
          {
            header: 'enabled',
            accessorKey: 'enabled',
            cell: (ctx) => {
              const enabled = ctx.getValue();
              const deployment = ctx.row.original;
              return (
                <Switch
                  checked={enabled}
                  onChange={async (checked) => {
                    await onUpdate([{ ...deployment, enabled: checked }]);
                  }}
                />
              );
            },
          },
          {
            header: 'Action',
            cell: (ctx) => (
              <Space vertical>
                <Button onClick={() => onEdit(ctx.row.original)}>编辑</Button>
                <Popconfirm
                  title="确定是否要删除改配置？"
                  content="此修改将不可逆"
                  onConfirm={() => onDelete(ctx.row.original.id)}
                  // onCancel={() => {}}
                  position="left"
                >
                  {/* <Button>保存</Button> */}
                  <Button type="danger">删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      ></Modules.Interactive.DataView>
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
              values.env?.forEach((item: { key: string; value: string }) => (env[item.key] = item.value));
              console.log({ values });
              setEditDeployment({ ...values, args, env });
            }}
            initValues={editDeployment}
            labelAlign="left"
            labelPosition={'left'}
            style={{ marginTop: '20px' }}
          >
            <Form.Input field="package_name" label="NPM 包名" style={{ width: '560px' }} />
            <Form.Select field="package_version" label="部署版本" style={{ width: '560px' }}>
              {mapPackageNameToVersions.get(editDeployment.package_name ?? '')?.map((version) => (
                <Option value={version}>{version}</Option>
              ))}
            </Form.Select>
            <Form.Input
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
            />
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
