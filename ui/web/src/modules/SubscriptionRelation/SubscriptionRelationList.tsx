import { IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Button, Modal, Popconfirm, Space, Table, Toast } from '@douyinfe/semi-ui';
import { IDataRecord, ISubscriptionRelation } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useState } from 'react';
import { combineLatest, first, mergeMap, tap, toArray } from 'rxjs';
import { terminal$ } from '../../common/create-connection';
import { registerCommand } from '../CommandCenter/CommandCenter';
import Form from '../Form';
import { openPage } from '../Pages';

const TYPE = 'subscription_relation';

const mapSubscriptionRelationToDataRecord = (
  origin: ISubscriptionRelation,
): IDataRecord<ISubscriptionRelation> => ({
  id: `${origin.channel_id}/${origin.provider_terminal_id}/${origin.consumer_terminal_id}`,
  type: 'subscription_relation',
  created_at: null,
  updated_at: Date.now(),
  frozen_at: null,
  tags: {
    channel_id: origin.channel_id,
    provider_terminal_id: origin.provider_terminal_id,
    consumer_terminal_id: origin.consumer_terminal_id,
  },
  origin,
});

const schemaOnEdit = {
  type: 'object',
  required: ['channel_id', 'provider_terminal_id', 'consumer_terminal_id'],
  properties: {
    channel_id: {
      title: '频道 ID',
      type: 'string',
    },
    provider_terminal_id: {
      title: '生产终端ID',
      type: 'string',
    },
    consumer_terminal_id: {
      title: '消费终端ID',
      type: 'string',
    },
  },
};

export const SubscriptionRelationList = React.memo(() => {
  const [refreshId, setRefreshId] = useState(0);
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);

  const [_searchFormData, _setSearchFormData] = useState({});
  const [searchFormData, setSearchFormData] = useState({} as Partial<ISubscriptionRelation>);

  const records$ = useObservable(
    (input$) =>
      combineLatest([terminal$, input$]).pipe(
        //
        mergeMap(([terminal, [searchFormData]]) =>
          terminal
            .queryDataRecords<ISubscriptionRelation>(
              {
                type: TYPE,
                tags: {
                  ...(searchFormData.channel_id ? { channel_id: searchFormData.channel_id } : {}),
                  ...(searchFormData.provider_terminal_id
                    ? { provider_terminal_id: searchFormData.provider_terminal_id }
                    : {}),
                  ...(searchFormData.consumer_terminal_id
                    ? { consumer_terminal_id: searchFormData.consumer_terminal_id }
                    : {}),
                },
              },
              'MongoDB',
            )
            .pipe(
              //
              toArray(),
            ),
        ),
      ),
    [searchFormData, refreshId],
  );

  const records = useObservableState(records$);

  const [isModalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({} as ISubscriptionRelation);

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
            setFormData({} as ISubscriptionRelation);
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
      </Space>
      <Table
        dataSource={records}
        style={{ width: '100%' }}
        columns={[
          //
          { title: '频道 ID', render: (_, record) => record.origin.channel_id },
          { title: '生产终端 ID', render: (_, record) => record.origin.provider_terminal_id },
          { title: '消费终端 ID', render: (_, record) => record.origin.consumer_terminal_id },

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
                        first(),
                        mergeMap((terminal) =>
                          terminal.removeDataRecords(
                            {
                              type: TYPE,
                              id: record.id,
                            },
                            'MongoDB',
                          ),
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
          const record = mapSubscriptionRelationToDataRecord(formData);
          terminal$
            .pipe(
              first(),
              mergeMap((terminal) => terminal.updateDataRecords([record], 'MongoDB')),
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
        >
          <div></div>
        </Form>
      </Modal>
    </Space>
  );
});
registerCommand('SubscriptionRelationList', () => {
  openPage('SubscriptionRelationList');
});
