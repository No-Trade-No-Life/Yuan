import { IconDelete, IconEdit, IconMinusCircle, IconPlusCircle } from '@douyinfe/semi-icons';
import { ArrayField, Form, Modal, Space } from '@douyinfe/semi-ui';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { UUID } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import {
  BehaviorSubject,
  combineLatest,
  defer,
  filter,
  firstValueFrom,
  repeat,
  retry,
  switchMap,
} from 'rxjs';
import { escapeForBash } from '../Deploy/utils';
import { Button, InlineTime, Switch, Toast } from '../Interactive';
import { terminal$ } from '../Network';
import { registerPage } from '../Pages';
import { IPrometheusRule } from './model';
export const refresh$ = new BehaviorSubject<void>(undefined);

registerPage('AlertRulePage', () => {
  const [visible, setVisible] = useState(false);
  const [editRule, setEditRule] = useState<IPrometheusRule>();
  const [loading, setLoading] = useState(false);

  const alertRules = useObservableState(
    useObservable(() =>
      combineLatest([terminal$, refresh$]).pipe(
        //
        filter(([x]) => !!x),
        switchMap(([terminal]) =>
          defer(() =>
            requestSQL<IPrometheusRule[]>(
              terminal!,
              `select * from prometheus_rule order by created_at desc;`,
            ),
          ).pipe(retry({ delay: 10_000 }), repeat({ delay: 4_000 })),
        ),
      ),
    ),
    [],
  );
  const onEdit = (rule: IPrometheusRule) => {
    setEditRule(rule);
    onOpenEdit();
  };

  const onOpenEdit = () => {
    setVisible(true);
  };
  const onSave = async () => {
    if (editRule) {
      setLoading(true);
      onUpdate([editRule]);
      setLoading(false);
    }
  };

  const onUpdate = async (rules: IPrometheusRule[]) => {
    try {
      const terminal = await firstValueFrom(terminal$);
      if (terminal) {
        const result = await requestSQL<IPrometheusRule[]>(
          terminal,
          buildInsertManyIntoTableSQL(rules, 'prometheus_rule', {
            columns: [
              //
              'id',
              'alert_for',
              'alert_keep_firing_for',
              'annotations',
              'expr',
              'group_name',
              'labels',
              'name',
              'record',
              'type',
              'enabled',
            ],
            conflictKeys: ['id'],
            returningAll: true,
          }),
        );
        refresh$.next();
        Toast.success(`成功更新 ${result.length} 条数据记录`);
        setVisible(false);
      }
    } catch (e) {
      Toast.error('更新失败: ' + e);
      console.log('UpdateError', e);
    }
  };

  const onDelete = async (id: string) => {
    try {
      const terminal = await firstValueFrom(terminal$);
      if (terminal) {
        await requestSQL(
          terminal,
          `
            delete from prometheus_rule where id=${escapeSQL(id)}
            `,
        );
        Toast.success('删除成功');
        refresh$.next();
      }
    } catch (e) {
      Toast.error('删除失败');
    }
  };

  const onCloseEdit = () => {
    setVisible(false);
    setEditRule(undefined);
  };
  const onCreate = () => {
    setEditRule({ id: UUID(), enabled: false } as IPrometheusRule);
    onOpenEdit();
  };
  return (
    <>
      <Modules.Interactive.DataView
        topSlot={
          <Button icon={<IconPlusCircle />} onClick={onCreate} style={{ margin: '10px 0' }}>
            创建
          </Button>
        }
        data={alertRules}
        columns={[
          {
            header: 'Id',
            accessorKey: 'id',
          },
          {
            header: 'Group Name',
            accessorKey: 'group_name',
          },
          {
            header: 'Name',
            accessorKey: 'name',
          },
          {
            header: 'Type',
            accessorKey: 'type',
          },
          {
            header: 'Alert For',
            accessorKey: 'alert_for',
          },
          {
            header: 'Expr',
            accessorKey: 'expr',
          },
          {
            header: 'Labels',
            accessorKey: 'labels',
            accessorFn: (x) =>
              Object.entries(x.labels)
                .map(([key, v]) => `${key}=${escapeForBash(v)}`)
                .join(' '),
          },
          {
            header: 'Annotations',
            accessorKey: 'annotations',
            accessorFn: (x) =>
              Object.entries(x.annotations)
                .map(([key, v]) => `${key}=${escapeForBash(v)}`)
                .join(' '),
          },
          {
            header: 'Alert Keep Firing For',
            accessorKey: 'alert_keep_firing_for',
          },
          {
            header: 'Record',
            accessorKey: 'record',
          },
          {
            header: 'Created At',
            accessorKey: 'created_at',
            cell: (ctx) => <InlineTime time={ctx.getValue()} />,
          },
          {
            header: 'Updated At',
            accessorKey: 'updated_at',
            cell: (ctx) => <InlineTime time={ctx.getValue()} />,
          },
          {
            header: 'Action',
            accessorKey: 'enabled',
            meta: {
              fixed: 'right',
            },
            cell: (ctx) => {
              return (
                <Space>
                  <Switch
                    checked={ctx.row.original.enabled}
                    onChange={async (checked) => {
                      await onUpdate([{ ...ctx.row.original, enabled: checked }]);
                    }}
                  />
                  <Button icon={<IconEdit />} onClick={() => onEdit(ctx.row.original)} />
                  <Button
                    icon={<IconDelete />}
                    type="danger"
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
              );
            },
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
        {visible && editRule && (
          <Form
            onValueChange={(values: any) => {
              const labels: Record<string, string> = {};
              values.labels?.forEach((item: { key: string; value: string }) => {
                labels[item.key] = item.value || ''; // Ensure value defaults to empty string
              });
              const annotations: Record<string, string> = {};

              values.annotations?.forEach((item: { key: string; value: string }) => {
                annotations[item.key] = item.value || ''; // Ensure value defaults to empty string
              });
              setEditRule({
                ...values,
                labels,
                annotations,
              });
            }}
            initValues={editRule}
            labelAlign="left"
            labelPosition={'left'}
            style={{ marginTop: '20px' }}
          >
            <Form.Input field="group_name" label="Group Name" style={{ width: '560px' }} />
            <Form.Input field="name" label="Name" style={{ width: '560px' }} />
            <Form.Input field="type" label="Type" style={{ width: '560px' }} />
            <Form.Input field="alert_for" label="Alert For" style={{ width: '560px' }} />
            <Form.Input field="expr" label="Expr" style={{ width: '560px' }} />
            <Form.Input
              field="alert_keep_firing_for"
              label="Alert Keep Firing For"
              style={{ width: '560px' }}
            />
            <Form.Input field="record" label="Record" style={{ width: '560px' }} />
            <Form.Section text="Labels" />
            <ArrayField
              field="labels"
              initValue={Object.entries(editRule?.labels ?? {})?.map(([k, v]) => ({ key: k, value: v }))}
            >
              {({ add, arrayFields, addWithInitValue }) => (
                <>
                  <Button onClick={add} icon={<IconPlusCircle />} theme="light" style={{ display: 'flex' }}>
                    Add new labels
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
            <Form.Section text="Annotations" />
            <ArrayField
              field="annotations"
              initValue={Object.entries(editRule?.annotations ?? {})?.map(([k, v]) => ({ key: k, value: v }))}
            >
              {({ add, arrayFields, addWithInitValue }) => (
                <>
                  <Button onClick={add} icon={<IconPlusCircle />} theme="light" style={{ display: 'flex' }}>
                    Add new annotations
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
    </>
  );
});
