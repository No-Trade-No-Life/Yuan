import { IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Button, Modal, Popconfirm, Space, Table, Toast } from '@douyinfe/semi-ui';
import { IDataRecord } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useState } from 'react';
import { combineLatest, first, mergeMap, tap, toArray } from 'rxjs';
import { terminal$ } from '../../common/create-connection';
import { registerCommand } from '../CommandCenter';
import Form from '../Form';
import { openPage } from '../Pages';

// TODO: Import
interface IGeneralSpecificRelation {
  // general_datasource_id 一定是 Y 常量，因此不需要特别存储
  // general_datasource_id: string;
  /** 标准品种ID */
  general_product_id: string; // XAUUSD
  /** 具体数据源 ID */
  specific_datasource_id: string; // TradingView
  /** 具体品种 ID */
  specific_product_id: string; // FX:XAUUSD
}

const mapGeneralSpecificRelationToDataRecord = (
  x: IGeneralSpecificRelation,
): IDataRecord<IGeneralSpecificRelation> => ({
  id: `${x.general_product_id}\n${x.specific_product_id}\n${x.specific_datasource_id}`,
  type: 'general_specific_relation',
  created_at: Date.now(),
  updated_at: Date.now(),
  frozen_at: null,
  tags: {},
  origin: x,
});

const schema = {
  type: 'object',
  title: '标准行情数据维护者配置',
  properties: {
    general_product_id: {
      type: 'string',
      title: '标准品种 ID',
    },
    specific_product_id: {
      type: 'string',
      title: '具体品种 ID',
    },
    specific_datasource_id: {
      type: 'string',
      title: '具体品种数据源 ID',
    },
  },
};

export const GeneralSpecificRelationList = React.memo(() => {
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
            .queryDataRecords<IGeneralSpecificRelation>(
              {
                type: 'general_specific_relation',
                tags: {},
                options: {},
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
  const [formData, setFormData] = useState({} as IGeneralSpecificRelation);

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
            setFormData({} as IGeneralSpecificRelation);
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
          { title: '标准品种 ID', render: (_, record) => record.origin.general_product_id },
          { title: '具体品种 ID', render: (_, record) => record.origin.specific_product_id },
          { title: '具体品种数据源 ID', render: (_, record) => record.origin.specific_datasource_id },
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
                    {
                      terminal$
                        .pipe(
                          //
                          first(),
                          mergeMap((terminal) =>
                            terminal.removeDataRecords(
                              {
                                type: 'general_specific_relation',
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
                    }
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
          const record = mapGeneralSpecificRelationToDataRecord(formData);
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
          schema={schema}
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
          schema={schema}
        >
          <div></div>
        </Form>
      </Modal>
    </Space>
  );
});

registerCommand('GeneralSpecificRelationList', () => {
  openPage('GeneralSpecificRelationList');
});
