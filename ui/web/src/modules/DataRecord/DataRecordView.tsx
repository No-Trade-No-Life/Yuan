import {
  IconCopyAdd,
  IconDelete,
  IconEdit,
  IconExport,
  IconImport,
  IconRefresh,
  IconSearch,
} from '@douyinfe/semi-icons';
import { Space, Spin, Toast } from '@douyinfe/semi-ui';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import {
  AccessorKeyColumnDef,
  ColumnDef,
  SortingState,
  Table,
  createColumnHelper,
} from '@tanstack/react-table';
import { IDataRecord, getDataRecordSchema, getDataRecordWrapper } from '@yuants/data-model';
import { readDataRecords, removeDataRecords, writeDataRecords } from '@yuants/protocol';
import Ajv from 'ajv';
import { JSONSchema7 } from 'json-schema';
import React, { useEffect, useMemo, useState } from 'react';
import { firstValueFrom } from 'rxjs';
import { fs } from '../FileSystem/api';
import { showForm } from '../Form';
import { Button, DataView } from '../Interactive';
import { terminal$ } from '../Terminals';

interface IDataRecordViewDef<T> {
  TYPE: string;
  columns: (ctx: { reloadData: () => Promise<void> }) => ColumnDef<IDataRecord<T>, any>[];
  extraRecordActions?: React.ComponentType<{ reloadData: () => Promise<void>; record: IDataRecord<T> }>;
  extraHeaderActions?: React.ComponentType<{}>;
  newRecord: () => Partial<T>;
  mapOriginToDataRecord?: (x: T) => IDataRecord<T>;
  beforeUpdateTrigger?: (x: T) => void | Promise<void>;
  schema?: JSONSchema7;
}

const PAGE_SIZE = 100;
/**
 * General Data Record View
 */
export function DataRecordView<T>(props: IDataRecordViewDef<T>) {
  const [searchFormData, setSearchFormData] = useState({} as any);
  const [refreshCnt, setRefreshCnt] = useState(0);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const tableRef = React.useRef<Table<IDataRecord<T>>>();

  const { data, fetchNextPage, isFetching } = useInfiniteQuery<IDataRecord<T>[]>({
    // ISSUE: queryKey should be unique among all query situations under the same query client context
    queryKey: [props.TYPE, refreshCnt, sorting],
    queryFn: async (ctx) => {
      const pageParam = ctx.pageParam as number;
      const terminal = await firstValueFrom(terminal$);
      if (!terminal) return [];

      const table = tableRef.current;

      const sort: [string, number][] = [];
      if (table) {
        for (const x of sorting) {
          const column = table.getColumn(x.id);
          if (column) {
            const access_key = (column.columnDef as AccessorKeyColumnDef<IDataRecord<T>[], unknown>)
              .accessorKey;
            if (typeof access_key === 'string') {
              sort.push([access_key, x.desc ? -1 : 1]);
            }
          }
        }
      }
      sort.push(['updated_at', -1]);

      const queryParams = {
        type: props.TYPE as any,
        tags: Object.fromEntries(
          Object.entries(searchFormData)
            .map(([k, v]) => [k, `${v}`])
            .filter(([, v]) => v !== ''),
        ),
        options: {
          skip: pageParam * PAGE_SIZE,
          limit: PAGE_SIZE,
          sort: sort,
        },
      };
      console.info('queryDataRecords', searchFormData, sorting, queryParams);
      const data = await readDataRecords(terminal, queryParams);

      return data;
    },
    initialPageParam: 0,
    getNextPageParam: (_lastGroup, groups) => groups.length,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const reloadData = async () => {
    const terminal = await firstValueFrom(terminal$);
    if (!terminal) return;
    setRefreshCnt((x) => x + 1);
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
                  const schema = props.schema || getDataRecordSchema(props.TYPE as any);
                  if (!schema) {
                    Toast.error(`找不到合适的数据规格，无法查询数据`);
                    return;
                  }
                  const formData = await showForm<T>(schema, record.origin);
                  await props.beforeUpdateTrigger?.(formData);
                  const wrapper = props.mapOriginToDataRecord || getDataRecordWrapper(props.TYPE as any);
                  if (!wrapper) {
                    Toast.error(`找不到合适的包装函数，无法更新数据`);
                    return;
                  }
                  const nextRecord: IDataRecord<any> = wrapper(formData);
                  await writeDataRecords(terminal, [nextRecord]);
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
                  await removeDataRecords(terminal, {
                    type: props.TYPE,
                    id: record.id,
                  });
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

  const records = useMemo(() => data?.pages?.flatMap((page) => page) ?? [], [data]);

  const topSlot = (
    <>
      <Button
        icon={<IconSearch />}
        onClick={async () => {
          const schema = props.schema || getDataRecordSchema(props.TYPE as any);
          if (!schema) {
            Toast.error(`找不到合适的数据规格，无法查询数据`);
            return;
          }
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
          const schema = props.schema || getDataRecordSchema(props.TYPE as any);
          if (!schema) {
            Toast.error(`找不到合适的数据规格，无法查询数据`);
            return;
          }
          const formData = await showForm<T>(schema, props.newRecord());
          await props.beforeUpdateTrigger?.(formData);
          const wrapper = props.mapOriginToDataRecord || getDataRecordWrapper(props.TYPE as any);
          if (!wrapper) {
            Toast.error(`找不到合适的包装函数，无法更新数据`);
            return;
          }
          const nextRecord: IDataRecord<any> = wrapper(formData);
          await writeDataRecords(terminal, [nextRecord]);
          await reloadData();
          Toast.success(`成功更新数据记录 ${nextRecord.id}`);
        }}
      >
        添加
      </Button>
      <Button
        icon={<IconCopyAdd />}
        onClick={async () => {
          // setRefreshCnt((x) => x + 1);
          fetchNextPage();
        }}
      >
        加载更多
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
      <Button
        icon={<IconExport />}
        onClick={async () => {
          const filename = await showForm<string>({
            title: 'Filename to export',
            type: 'string',
            format: 'filename',
            pattern: '^/.+\\.json',
          });
          const data = records.map((x) => x.origin);
          await fs.writeFile(filename, JSON.stringify(data, null, 2));
          Toast.success(`已导出: ${filename}, ${data.length} 条`);
          await reloadData();
        }}
      >
        导出
      </Button>
      <Button
        icon={<IconImport />}
        onClick={async () => {
          const terminal = await firstValueFrom(terminal$);
          if (!terminal) return;
          const filename = await showForm<string>({
            title: 'Filename to import',
            type: 'string',
            format: 'filename',
            pattern: '^/.+\\.json',
          });
          const data = JSON.parse(await fs.readFile(filename));
          if (!Array.isArray(data)) {
            return;
          }
          const ajv = new Ajv({ strictSchema: false });
          const schema = props.schema || getDataRecordSchema(props.TYPE as any);
          if (!schema) {
            Toast.error(`找不到合适的数据规格，无法查询数据`);
            return;
          }
          const validator = ajv.compile(schema);
          const wrapper = props.mapOriginToDataRecord || getDataRecordWrapper(props.TYPE as any);
          if (!wrapper) {
            Toast.error(`找不到合适的包装函数，无法更新数据`);
            return;
          }
          const records = data.filter((x) => validator(x)).map((x: any) => wrapper(x));
          await writeDataRecords(terminal, records as IDataRecord<any>[]);
          Toast.success(`已导入: ${filename}, ${records.length} / ${data.length} 条`);
          await reloadData();
        }}
      >
        导入
      </Button>
      {props.extraHeaderActions && React.createElement(props.extraHeaderActions, {})}
      {isFetching && <Spin />}
    </>
  );

  return (
    <DataView
      tableRef={tableRef}
      columns={columns}
      data={records}
      sorting={sorting}
      onSortingChange={setSorting}
      manualSorting
      topSlot={topSlot}
    />
  );
}
