import { IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Button, Modal, Popconfirm, Space, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { IDataRecord } from '@yuants/data-model';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import { EMPTY, combineLatest, filter, first, mergeMap, tap, toArray } from 'rxjs';
import Form from '../Form';
import { DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';

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

registerPage('GeneralSpecificRelationList', () => {
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
            terminal?.queryDataRecords<IGeneralSpecificRelation>({
              type: 'general_specific_relation',
              tags: {},
              options: {
                sort: [
                  //
                  ['origin.general_product_id', 1],
                  ['origin.specific_datasource_id', 1],
                ],
              },
            }) ?? EMPTY
          ).pipe(
            //
            filter(
              (record) =>
                (searchFormData.general_product_id
                  ? record.origin.general_product_id === searchFormData.general_product_id
                  : true) &&
                (searchFormData.specific_datasource_id
                  ? record.origin.specific_datasource_id === searchFormData.specific_datasource_id
                  : true) &&
                (searchFormData.specific_product_id
                  ? record.origin.specific_product_id === searchFormData.specific_product_id
                  : true),
            ),
            toArray(),
          ),
        ),
      ),
    [searchFormData, refreshId],
  );

  const records = useObservableState(records$, []);

  const [isModalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({} as IGeneralSpecificRelation);

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<IDataRecord<IGeneralSpecificRelation>>();
    return [
      columnHelper.accessor('origin.general_product_id', {
        header: () => '标准品种ID',
      }),
      columnHelper.accessor('origin.specific_datasource_id', {
        header: () => '具体数据源ID',
      }),
      columnHelper.accessor('origin.specific_product_id', {
        header: () => '具体品种ID',
      }),
      columnHelper.accessor((x) => 0, {
        id: 'actions',
        header: () => '操作',
        cell: (x) => {
          const record = x.row.original;
          return (
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
                        filter((x): x is Exclude<typeof x, null> => !!x),
                        first(),
                        mergeMap((terminal) =>
                          terminal.removeDataRecords({
                            type: 'general_specific_relation',
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
                  }
                }}
              >
                <Button icon={<IconDelete />} type="danger"></Button>
              </Popconfirm>
            </Space>
          );
        },
      }),
    ];
  }, []);

  const table = useReactTable({
    columns,
    data: records,
    getCoreRowModel: getCoreRowModel(),
  });

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
      <DataView table={table} />

      <Modal
        visible={isModalVisible}
        onCancel={() => {
          setModalVisible(false);
        }}
        onOk={() => {
          const record = mapGeneralSpecificRelationToDataRecord(formData);
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
