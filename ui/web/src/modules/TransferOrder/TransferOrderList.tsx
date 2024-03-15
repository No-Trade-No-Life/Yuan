import { IconBolt, IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Space, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { UUID, formatTime } from '@yuants/data-model';
import { IDataRecord } from '@yuants/protocol';
import { useEffect, useMemo, useState } from 'react';
import { concatWith, firstValueFrom, lastValueFrom, of, tap, toArray } from 'rxjs';
import { InlineAccountId } from '../AccountInfo';
import { showForm } from '../Form';
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
  const [searchFormData, setSearchFormData] = useState({} as any);

  const [records, setRecords] = useState<IDataRecord<ITransferOrder>[]>([]);

  const reloadData = async () => {
    const terminal = await firstValueFrom(terminal$);
    if (!terminal) return;
    const data = await lastValueFrom(
      terminal
        .queryDataRecords<ITransferOrder>({
          type: TYPE,
          options: {
            sort: [
              //
              ['updated_at', -1],
            ],
          },
        })
        .pipe(
          //
          toArray(),
        ),
    );
    setRecords(data);
  };

  useEffect(() => {
    reloadData();
  }, [searchFormData]);

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
        header: () => '候选方式',
        cell: (ctx) => (
          <ol>
            {ctx.getValue()?.map((e) => (
              <li>{e}</li>
            ))}
          </ol>
        ),
      }),
      columnHelper.accessor('origin.credit_method', {
        header: () => '当选方式',
      }),
      columnHelper.accessor('origin.transaction_id', {
        header: () => '转账凭证号',
      }),
      columnHelper.accessor('origin.transferred_at', {
        header: () => '转账时间',
        cell: (ctx) => formatTime(ctx.getValue() ?? ''),
      }),
      columnHelper.accessor('origin.transferred_amount', {
        header: () => '转账金额',
      }),
      columnHelper.accessor('origin.received_at', {
        header: () => '到账时间',
        cell: (ctx) => formatTime(ctx.getValue() ?? ''),
      }),
      columnHelper.accessor('origin.received_amount', {
        header: () => '到账金额',
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
                  const terminal = await firstValueFrom(terminal$);
                  if (!terminal) return;
                  await lastValueFrom(
                    terminal.requestService('Transfer', record.origin).pipe(
                      tap({
                        error: (err) => {
                          Toast.error(`通知转账失败: ${err}`);
                          console.error(err);
                        },
                      }),
                    ),
                  );
                  await reloadData();
                  Toast.success(`通知转账成功`);
                }}
              >
                通知
              </Button>
              <Button
                icon={<IconEdit />}
                onClick={async () => {
                  const terminal = await firstValueFrom(terminal$);
                  if (!terminal) return;
                  const formData = await showForm<ITransferOrder>(schema, record.origin);
                  await beforeUpdateTrigger(formData);
                  const nextRecord = mapOriginToDataRecord(formData);
                  await lastValueFrom(terminal.updateDataRecords([nextRecord]).pipe(concatWith(of(0))));
                  await reloadData();
                  Toast.success(`成功更新数据记录 ${nextRecord.id}`);
                }}
              ></Button>
              <Button
                icon={<IconDelete />}
                type="danger"
                onClick={async () => {
                  const confirm = await showForm<boolean>({
                    type: 'boolean',
                    title: '确定是否删除？',
                    description: '此操作将不可逆',
                  });
                  if (!confirm) return;
                  const terminal = await firstValueFrom(terminal$);
                  if (!terminal) return;
                  await lastValueFrom(
                    terminal
                      .removeDataRecords({
                        type: TYPE,
                        id: record.id,
                      })
                      .pipe(concatWith(of(0))),
                  );
                  Toast.success(`成功删除数据记录 ${record.id}`);
                  await reloadData();
                }}
              ></Button>
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
            const formData = await showForm(schema, searchFormData);
            setSearchFormData(formData);
          }}
        >
          搜索
        </Button>
        <Button
          icon={<IconCopyAdd />}
          onClick={async () => {
            const terminal = await firstValueFrom(terminal$);
            if (!terminal) return;
            const formData = await showForm<ITransferOrder>(schema, newRecord());
            await beforeUpdateTrigger(formData);
            const nextRecord = mapOriginToDataRecord(formData);
            await lastValueFrom(terminal.updateDataRecords([nextRecord]).pipe(concatWith(of(0))));
            await reloadData();
            Toast.success(`成功更新数据记录 ${nextRecord.id}`);
          }}
        >
          添加
        </Button>
        <Button
          icon={<IconRefresh />}
          onClick={async () => {
            await reloadData();
            Toast.success('已刷新');
          }}
        >
          刷新
        </Button>
      </Space>
      <DataView table={table} />
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
