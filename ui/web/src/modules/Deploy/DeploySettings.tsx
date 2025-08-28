import { IconMinusCircle, IconPlusCircle } from '@douyinfe/semi-icons';
import { ArrayField, Form, Modal, Popconfirm, Space } from '@douyinfe/semi-ui';
import { IDeployment } from '@yuants/deploy';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { UUID } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  defer,
  EMPTY,
  filter,
  firstValueFrom,
  map,
  of,
  pipe,
  repeat,
  retry,
  shareReplay,
  switchMap,
} from 'rxjs';
import { Button, Switch, Toast } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { resolveVersion } from '../Extensions';
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

registerPage('DeploySettings', () => {
  const deploySettings = useObservableState(deploySettings$);
  const [editDeployment, setEditDeployment] = useState<IDeployment>();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const versionInfoList = useObservableState(
    useObservable(
      pipe(
        switchMap(([package_name]) =>
          defer(() => {
            return package_name
              ? resolveVersion({ name: package_name, registry: 'https://registry.npmjs.org' })
              : EMPTY;
          }).pipe(
            filter((x) => !!x),
            map((info) => Object.keys(info.meta.versions).reverse() as string[]),
            catchError((err) => {
              console.error('getVersionListError', err);
              return of([]);
            }),
          ),
        ),
      ),
      [editDeployment?.package_name],
    ),
  );

  console.log({ versionInfoList });
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
      onUpdate(editDeployment);
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
  const onUpdate = async (deployment: IDeployment) => {
    try {
      const terminal = await firstValueFrom(terminal$);
      if (terminal) {
        await requestSQL(
          terminal,
          buildInsertManyIntoTableSQL([deployment], 'deployment', {
            columns: ['args', 'command', 'enabled', 'env', 'id', 'package_version', 'package_name'],
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
    <Space vertical align="start">
      <Button icon={<IconPlusCircle />} onClick={onCreate} style={{ margin: '10px 0' }}>
        创建新配置
      </Button>
      <Modules.Interactive.DataView
        data={deploySettings}
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
            header: 'command',
            accessorKey: 'command',
          },
          {
            header: 'args',
            accessorFn: (x) => (x.args || []).join(' '),
          },
          {
            header: 'env',
            accessorKey: 'env',
            accessorFn: (x) =>
              Object.entries(x.env)
                .map(([key, v]) => `${key}="${v}"`)
                .join(' '),
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
                    await onUpdate({ ...deployment, enabled: checked });
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
                  // onCancel={onCancel}
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
            <Form.Input field="command" label="command" style={{ width: '560px' }} />
            <Form.Input field="package_name" label="package name" style={{ width: '560px' }} />
            <Form.Select field="package_version" label="package version" style={{ width: '560px' }}>
              {versionInfoList?.map((version) => (
                <Option value={version}>{version}</Option>
              ))}
            </Form.Select>
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
          </Form>
        )}
      </Modal>
    </Space>
  );
});
