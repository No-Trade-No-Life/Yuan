import { Button, Modal, Space, Switch, Form, ArrayField, Popconfirm } from '@douyinfe/semi-ui';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { useObservableState } from 'observable-hooks';
import { useState } from 'react';
import {
  BehaviorSubject,
  combineLatest,
  defer,
  firstValueFrom,
  map,
  of,
  repeat,
  retry,
  shareReplay,
  switchMap,
} from 'rxjs';
import { registerPage } from '../Pages';
import { terminal$, useTerminal } from '../Terminals';
import { IDeployment } from '@yuants/deploy';
import { IconMinusCircle, IconPlusCircle } from '@douyinfe/semi-icons';
import { Toast } from '../Interactive';
import { UUID } from '@yuants/utils';

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
        console.log('toUpdate', deployment);

        await requestSQL(
          terminal,
          buildInsertManyIntoTableSQL([deployment], 'deployment', {
            columns: ['args', 'command', 'enabled', 'env', 'id'],
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
            header: 'command',
            accessorKey: 'command',
          },
          {
            header: 'args',
            accessorKey: 'args',
          },
          {
            header: 'env',
            accessorKey: 'env',
            cell: (ctx) => {
              const env = ctx.getValue();
              return Object.entries(env)
                .map(([key, v]) => `${key}="${v}"`)
                .join(' ');
            },
          },
          {
            header: 'enabled',
            accessorKey: 'enabled',
            cell: (ctx) => {
              const enabled = ctx.getValue();
              const deployment = ctx.row.original;
              const [loading, setLoading] = useState(false);
              const onChange = async (checked: boolean) => {
                setLoading(true);
                await onUpdate({ ...deployment, enabled: checked });
                setLoading(false);
              };
              return <Switch checked={enabled} onChange={onChange} loading={loading} />;
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
            onValueChange={(values) => {
              const args = values.args.map((item: { arg: string }) => item.arg) as string[];

              const env: Record<string, string> = {};
              values.env?.forEach((item: { key: string; value: string }) => (env[item.key] = item.value));
              console.log({ values, args, env });
              setEditDeployment({ ...values, args, env });
            }}
            initValues={editDeployment}
            labelAlign="left"
            labelPosition={'left'}
            style={{ marginTop: '20px' }}
          >
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
