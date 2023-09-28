import { IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Button, Modal, Popconfirm, Space, Table, Toast } from '@douyinfe/semi-ui';
import { IDataRecord } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useState } from 'react';
import { combineLatest, first, mergeMap, tap, toArray } from 'rxjs';
import { v4 } from 'uuid';
import { terminal$ } from '../../common/create-connection';
import { registerCommand } from '../CommandCenter/CommandCenter';
import Form from '../Form';
import { openPage } from '../Pages';

interface ITradeCopierTradeConfig {
  id?: string;
  account_id: string;
  product_id: string;
  max_volume_per_order: number;
}

const schemaOnEdit = {
  type: 'object',
  properties: {
    account_id: {
      title: '账户 ID',
      type: 'string',
    },
    product_id: {
      title: '品种 ID',
      type: 'string',
    },
    max_volume_per_order: {
      title: '单笔最大手数',
      type: 'number',
    },
  },
};

const TYPE = 'trade_copier_trade_config';

const mapTradeCopierTradeConfigToDataRecord = (
  x: ITradeCopierTradeConfig,
): IDataRecord<ITradeCopierTradeConfig> => {
  const id = x.id || v4();
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

export const TradeConfigList = React.memo(() => {
  const [refreshId, setRefreshId] = useState(0);
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);

  const [_searchFormData, _setSearchFormData] = useState({});
  const [searchFormData, setSearchFormData] = useState({} as any);

  const records$ = useObservable(
    (input$) =>
      combineLatest([terminal$, input$]).pipe(
        //
        mergeMap(([terminal, [searchFormData]]) =>
          terminal
            .queryDataRecords<ITradeCopierTradeConfig>(
              {
                type: TYPE,
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
  const [formData, setFormData] = useState({} as ITradeCopierTradeConfig);

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
            setFormData({} as ITradeCopierTradeConfig);
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
          { title: '账户 ID', render: (_, record) => record.origin.account_id },
          { title: '品种 ID', render: (_, record) => record.origin.product_id },
          { title: '每单最大手数', render: (_, record) => record.origin.max_volume_per_order },
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
          const record = mapTradeCopierTradeConfigToDataRecord(formData);
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
registerCommand('TradeConfigList', () => {
  openPage('TradeConfigList');
});
