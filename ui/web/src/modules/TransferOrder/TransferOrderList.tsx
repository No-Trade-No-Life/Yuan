import { IconBolt, IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Modal, Popconfirm, Button as SemiButton, Space, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { UUID, formatTime } from '@yuants/data-model';
import { IDataRecord } from '@yuants/protocol';
import { useObservable, useObservableState } from 'observable-hooks';
import { useMemo, useState } from 'react';
import { EMPTY, combineLatest, filter, first, lastValueFrom, mergeMap, of, tap, toArray } from 'rxjs';
import { InlineAccountId } from '../AccountInfo';
import Form, { showForm } from '../Form';
import { Button, DataView } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { ITransferOrder, schema } from './model';

const TYPE = 'transfer_order';

const mapOriginToDataRecord = (x: ITransferOrder): IDataRecord<ITransferOrder> => {
  const id = x.order_id;
  return {
    id,
    type: TYPE,
    created_at: x.created_at,
    updated_at: x.updated_at,
    frozen_at: null,
    tags: {
      credit_account_id: x.credit_account_id,
      debit_account_id: x.debit_account_id,
      status: x.status,
    },
    origin: x,
  };
};

registerPage('TransferOrderList', () => {
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
            terminal?.queryDataRecords<ITransferOrder>({
              type: TYPE,
              options: {
                sort: [],
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

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<IDataRecord<ITransferOrder>>();
    return [
      columnHelper.accessor('origin.order_id', {
        header: () => '订单ID',
      }),
      columnHelper.accessor('origin.created_at', {
        header: () => '创建时间',
        cell: (ctx) => formatTime(ctx.getValue() ?? ''),
      }),
      columnHelper.accessor('origin.updated_at', {
        header: () => '更新时间',
        cell: (ctx) => formatTime(ctx.getValue() ?? ''),
      }),
      columnHelper.accessor('origin.credit_account_id', {
        header: () => '贷方账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
      }),
      columnHelper.accessor('origin.debit_account_id', {
        header: () => '借方账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
      }),
      columnHelper.accessor('origin.status', {
        header: () => '状态',
      }),
      columnHelper.accessor('origin.expected_amount', {
        header: () => '金额',
      }),
      columnHelper.accessor('origin.currency', {
        header: () => '货币',
      }),
      columnHelper.accessor('origin.debit_methods', {
        header: () => '借方支持的转账方式',
      }),
      columnHelper.accessor('origin.credit_method', {
        header: () => '贷方选择的转账方式',
      }),
      columnHelper.accessor('origin.transaction_id', {
        header: () => '转账凭证号',
      }),
      columnHelper.display({
        id: 'actions',
        header: () => '操作',
        cell: (ctx) => {
          const record = ctx.row.original;
          return (
            <Space>
              <Button
                icon={<IconBolt />}
                onClick={async () => {
                  await lastValueFrom(
                    terminal$.pipe(
                      filter((x): x is Exclude<typeof x, null> => !!x),
                      first(),
                      mergeMap((terminal) => terminal.requestService('Transfer', record.origin)),
                      tap({
                        complete: () => {
                          Toast.success(`通知转账成功`);
                          setRefreshId((x) => x + 1);
                        },
                        error: (err) => {
                          Toast.error(`通知转账失败: ${err}`);
                          console.error(err);
                        },
                      }),
                    ),
                  );
                }}
              >
                通知
              </Button>
              <Button
                icon={<IconEdit />}
                onClick={async () => {
                  const formData = await showForm<ITransferOrder>(schema, record.origin);
                  await beforeUpdateTrigger(formData);
                  const nextRecord = mapOriginToDataRecord(formData);
                  await lastValueFrom(
                    terminal$.pipe(
                      filter((x): x is Exclude<typeof x, null> => !!x),
                      first(),
                      mergeMap((terminal) => terminal.updateDataRecords([nextRecord])),
                      tap({
                        complete: () => {
                          Toast.success(`成功更新数据记录 ${nextRecord.id}`);
                          setRefreshId((x) => x + 1);
                        },
                      }),
                    ),
                  );
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
                <SemiButton icon={<IconDelete />} type="danger"></SemiButton>
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
          onClick={async () => {
            setSearchModalVisible(true);
          }}
        >
          搜索
        </Button>
        <Button
          icon={<IconCopyAdd />}
          onClick={async () => {
            const formData = await showForm<ITransferOrder>(schema, newRecord());
            const nextRecord = mapOriginToDataRecord(formData);
            await lastValueFrom(
              terminal$.pipe(
                filter((x): x is Exclude<typeof x, null> => !!x),
                first(),
                mergeMap((terminal) => terminal.updateDataRecords([nextRecord])),
                tap({
                  complete: () => {
                    Toast.success(`成功更新数据记录 ${nextRecord.id}`);
                    setRefreshId((x) => x + 1);
                  },
                }),
              ),
            );
          }}
        >
          添加
        </Button>
        <Button
          icon={<IconRefresh />}
          onClick={async () => {
            setRefreshId((x) => x + 1);
            Toast.success('已刷新');
          }}
        >
          刷新
        </Button>
      </Space>
      <DataView table={table} />

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

function newRecord(): Partial<ITransferOrder> {
  return {
    order_id: UUID(),
    created_at: Date.now(),
  };
}

function beforeUpdateTrigger(x: ITransferOrder) {
  x.updated_at = Date.now();
}
