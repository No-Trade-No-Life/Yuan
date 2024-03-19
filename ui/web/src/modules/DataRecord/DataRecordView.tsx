import { IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Space, Toast } from '@douyinfe/semi-ui';
import { ColumnDef, createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { IDataRecord } from '@yuants/data-model';
import { JSONSchema7 } from 'json-schema';
import React, { useEffect, useMemo, useState } from 'react';
import { concatWith, firstValueFrom, lastValueFrom, of, toArray } from 'rxjs';
import { showForm } from '../Form';
import { Button, DataView } from '../Interactive';
import { terminal$ } from '../Terminals';

interface IDataRecordViewDef<T> {
  TYPE: string;
  columns: (ctx: { reloadData: () => Promise<void> }) => ColumnDef<IDataRecord<T>, any>[];
  extraRecordActions?: React.ComponentType<{ reloadData: () => Promise<void>; record: IDataRecord<T> }>;
  newRecord: () => Partial<T>;
  mapOriginToDataRecord: (x: T) => IDataRecord<T>;
  beforeUpdateTrigger?: (x: T) => void | Promise<void>;
  schema: JSONSchema7;
}

/**
 * General Data Record View
 */
export function DataRecordView<T>(props: IDataRecordViewDef<T>) {
  const [searchFormData, setSearchFormData] = useState({} as any);

  const [records, setRecords] = useState<IDataRecord<T>[]>([]);

  const reloadData = async () => {
    const terminal = await firstValueFrom(terminal$);
    if (!terminal) return;
    const data = await lastValueFrom(
      terminal
        .queryDataRecords<T>({
          type: props.TYPE,
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
    const columnHelper = createColumnHelper<IDataRecord<T>>();

    const cols = props.columns({ reloadData });
    cols.push(
      columnHelper.display({
        id: 'actions',
        header: () => '操作',
        cell: (ctx) => {
          const record = ctx.row.original;
          return (
            <Space>
              {props.extraRecordActions &&
                React.createElement(props.extraRecordActions, { reloadData, record })}
              <Button
                icon={<IconEdit />}
                onClick={async () => {
                  const terminal = await firstValueFrom(terminal$);
                  if (!terminal) return;
                  const formData = await showForm<T>(props.schema, record.origin);
                  await props.beforeUpdateTrigger?.(formData);
                  const nextRecord = props.mapOriginToDataRecord(formData);
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
                        type: props.TYPE,
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
    );
    return cols;
  }, []);

  const table = useReactTable({
    columns: columns,
    data: records || [],
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        <Button
          icon={<IconSearch />}
          onClick={async () => {
            const formData = await showForm(props.schema, searchFormData);
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
            const formData = await showForm<T>(props.schema, props.newRecord());
            await props.beforeUpdateTrigger?.(formData);
            const nextRecord = props.mapOriginToDataRecord(formData);
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
}
