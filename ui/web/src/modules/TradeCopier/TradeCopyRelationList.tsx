import { IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Button, Modal, Popconfirm, Space, Switch, Table, Toast } from '@douyinfe/semi-ui';
import { UUID } from '@yuants/data-model';
import { IDataRecord } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EMPTY, combineLatest, filter, first, mergeMap, tap, toArray } from 'rxjs';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand, registerCommand } from '../CommandCenter';
import Form from '../Form';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { terminate } from '../Terminals/TerminalListItem';

// TODO: Import
interface ITradeCopyRelation {
  id?: string;
  source_account_id: string;
  source_product_id: string;
  target_account_id: string;
  target_product_id: string;
  multiple: number;
  /** 根据正则表达式匹配头寸的备注 (黑名单) */
  exclusive_comment_pattern?: string;
  disabled?: boolean;
}

const TYPE = 'trade_copy_relation';

const mapTradeCopyRelationToDataRecord = (x: ITradeCopyRelation): IDataRecord<ITradeCopyRelation> => {
  const id = x.id || UUID();
  return {
    id,
    type: TYPE,
    created_at: Date.now(),
    updated_at: Date.now(),
    frozen_at: null,
    tags: {},
    origin: { ...x, id },
  };
};

const schemaOnEdit = {
  type: 'object',
  required: ['source_account_id', 'source_product_id', 'target_account_id', 'target_product_id', 'multiple'],
  properties: {
    source_account_id: {
      title: '源账户 ID',
      type: 'string',
      format: 'account_id',
    },
    source_product_id: {
      title: '源品种 ID',
      type: 'string',
    },
    target_account_id: {
      title: '目标账户 ID',
      type: 'string',
      format: 'account_id',
    },
    target_product_id: {
      title: '目标品种 ID',
      type: 'string',
    },
    multiple: {
      title: '倍数',
      type: 'number',
    },
    exclusive_comment_pattern: {
      title: '头寸备注黑名单模式',
      description:
        '[高级] 请填写合法的JS正则表达式。如果头寸匹配了此模式，此头寸不会被跟单。留空表示不过滤。高级配置，请咨询技术支持后妥善配置！',
      type: 'string',
      format: 'regex',
    },
    disabled: {
      type: 'boolean',
    },
  },
};

registerPage('TradeCopyRelationList', () => {
  const { t } = useTranslation('TradeCopyRelationList');
  const [refreshId, setRefreshId] = useState(0);
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);

  const [_searchFormData, _setSearchFormData] = useState({});
  const [searchFormData, setSearchFormData] = useState({} as any);

  const records$ = useObservable(
    (input$) =>
      combineLatest([terminal$, input$]).pipe(
        //
        mergeMap(([terminal, [searchFormData]]) =>
          (
            terminal?.queryDataRecords<ITradeCopyRelation>({
              type: TYPE,
              options: {
                sort: [
                  ['origin.source_account_id', 1],
                  ['origin.source_product_id', 1],
                ],
              },
            }) ?? EMPTY
          ).pipe(
            //
            toArray(),
          ),
        ),
      ),
    [searchFormData, refreshId],
  );

  const records = useObservableState(records$);

  const [isModalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({} as ITradeCopyRelation);

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        <Button
          icon={<IconSearch />}
          onClick={() => {
            setSearchModalVisible(true);
          }}
        >
          搜索
        </Button>
        <Button
          icon={<IconCopyAdd />}
          onClick={() => {
            setFormData({} as ITradeCopyRelation);
            setModalVisible(true);
          }}
        >
          添加
        </Button>
        <Button
          icon={<IconRefresh />}
          onClick={() => {
            setRefreshId((x) => x + 1);
            Toast.success('已刷新');
          }}
        >
          刷新
        </Button>
        <Button icon={<IconRefresh />} onClick={() => executeCommand('TradeCopier.Restart')}>
          重启跟单阵列
        </Button>
      </Space>
      <Table
        dataSource={records}
        pagination={false}
        style={{ width: '100%' }}
        columns={[
          //
          {
            title: '源账户 ID',
            render: (_, record) => <InlineAccountId account_id={record.origin.source_account_id} />,
          },
          { title: '源品种 ID', render: (_, record) => record.origin.source_product_id },
          {
            title: '目标账户 ID',
            render: (_, record) => <InlineAccountId account_id={record.origin.target_account_id} />,
          },
          { title: '目标品种ID', render: (_, record) => record.origin.target_product_id },
          { title: '头寸倍数', render: (_, record) => record.origin.multiple },
          {
            title: '根据正则表达式匹配头寸的备注 (黑名单)',
            render: (_, record) => record.origin.exclusive_comment_pattern,
          },
          {
            title: '禁用',
            render: (_, record) => (
              <Switch
                onChange={(v) => {
                  const next = mapTradeCopyRelationToDataRecord({ ...record.origin, disabled: v });
                  terminal$
                    .pipe(
                      filter((x): x is Exclude<typeof x, null> => !!x),
                      first(),
                      mergeMap((terminal) => terminal.updateDataRecords([next])),
                      tap({
                        complete: () => {
                          Toast.success(`成功更新数据记录 ${record.id}`);
                          setRefreshId((x) => x + 1);
                        },
                      }),
                    )
                    .subscribe();
                }}
                checked={!!record.origin.disabled}
              />
            ),
          },
          {
            title: '操作',
            render: (_, record) => (
              <Space>
                <Button
                  icon={<IconEdit />}
                  onClick={() => {
                    setFormData(record.origin);

                    setModalVisible(true);
                  }}
                ></Button>
                <Popconfirm
                  style={{ width: 300 }}
                  title="确定是否删除？"
                  content="此操作将不可逆"
                  onConfirm={() => {
                    terminal$
                      .pipe(
                        //
                        filter((x): x is Exclude<typeof x, null> => !!x),
                        first(),
                        mergeMap((terminal) =>
                          terminal.removeDataRecords({
                            type: TYPE,
                            id: record.id,
                          }),
                        ),
                        tap({
                          complete: () => {
                            Toast.success(`成功删除数据记录 ${record.id}`);
                            setRefreshId((x) => x + 1);
                          },
                        }),
                      )
                      .subscribe();
                  }}
                >
                  <Button icon={<IconDelete />} type="danger"></Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      ></Table>
      <Modal
        visible={isModalVisible}
        onCancel={() => {
          setModalVisible(false);
        }}
        onOk={() => {
          const record = mapTradeCopyRelationToDataRecord(formData);
          terminal$
            .pipe(
              filter((x): x is Exclude<typeof x, null> => !!x),
              first(),
              mergeMap((terminal) => terminal.updateDataRecords([record])),
              tap({
                complete: () => {
                  Toast.success(`成功更新数据记录 ${record.id}`);
                  setRefreshId((x) => x + 1);
                },
              }),
            )
            .subscribe();
        }}
      >
        <Form
          formData={formData}
          onChange={(data) => {
            setFormData(data.formData);
          }}
          schema={schemaOnEdit}
          formContext={{ 'i18n:ns': 'TradeCopyRelationList' }}
        >
          <div></div>
        </Form>
      </Modal>
      <Modal
        visible={isSearchModalVisible}
        onCancel={() => {
          setSearchModalVisible(false);
        }}
        onOk={() => {
          setSearchFormData(_searchFormData);
        }}
      >
        <Form
          formData={_searchFormData}
          onChange={(data) => {
            _setSearchFormData(data.formData);
          }}
          schema={schemaOnEdit}
          formContext={{ 'i18n:ns': 'TradeCopyRelationList' }}
        >
          <div></div>
        </Form>
      </Modal>
    </Space>
  );
});

registerCommand('TradeCopier.Restart', () => {
  terminate('TradeCopier');
});
