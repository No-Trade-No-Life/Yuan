import { IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Button, Modal, Popconfirm, Space, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { UUID } from '@yuants/data-model';
import { IDataRecord } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import { EMPTY, combineLatest, filter, first, mergeMap, tap, toArray } from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import Form from '../Form';
import { DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { terminate } from '../Terminals/TerminalListItem';
import { IAccountCompositionRelation, acrSchema } from './model';
import { InlineAccountId } from '../AccountInfo';

const TYPE = 'account_composition_relation';

const mapTradeCopyRelationToDataRecord = (
  x: IAccountCompositionRelation,
): IDataRecord<IAccountCompositionRelation> => {
  const id = UUID();
  return {
    id,
    type: TYPE,
    created_at: Date.now(),
    updated_at: Date.now(),
    frozen_at: null,
    tags: {},
    origin: x,
  };
};

registerPage('AccountCompositionRelationList', () => {
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
            terminal?.queryDataRecords<IAccountCompositionRelation>({
              type: TYPE,
              options: {
                sort: [
                  ['origin.target_account_id', 1],
                  ['origin.source_account_id', 1],
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
  const [formData, setFormData] = useState({} as IAccountCompositionRelation);

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<IDataRecord<IAccountCompositionRelation>>();
    return [
      columnHelper.accessor('origin.target_account_id', {
        header: () => '目标账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
      }),
      columnHelper.accessor('origin.source_account_id', {
        header: () => '原账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
      }),
      columnHelper.accessor('origin.multiple', {
        header: () => '乘数',
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '操作',
        cell: (ctx) => {
          const record = ctx.row.original;
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
          );
        },
      }),
    ];
  }, []);

  const table = useReactTable({
    columns,
    data: records || [],
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
            setFormData({} as IAccountCompositionRelation);
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
        <Button icon={<IconRefresh />} onClick={() => executeCommand('AccountComposer.Restart')}>
          重启合成器
        </Button>
      </Space>
      <DataView table={table} />

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
          schema={acrSchema}
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
          schema={acrSchema}
        >
          <div></div>
        </Form>
      </Modal>
    </Space>
  );
});

registerCommand('AccountComposer.Restart', () => {
  terminate('AccountComposer');
});
