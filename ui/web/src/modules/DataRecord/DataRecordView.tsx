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
import { buildInsertManyIntoTableSQL, escape, requestSQL } from '@yuants/sql';
import { JSONSchema7 } from 'json-schema';
import React, { useEffect, useMemo, useState } from 'react';
import { firstValueFrom } from 'rxjs';
import { fs } from '../FileSystem/api';
import { showForm } from '../Form';
import { Button, DataView } from '../Interactive';
import { terminal$ } from '../Terminals';

interface IDataRecordViewDef<T extends {}> {
  TYPE: string;
  columns: (ctx: { reloadData: () => Promise<void> }) => ColumnDef<T, any>[];
  extraRecordActions?: React.ComponentType<{ reloadData: () => Promise<void>; record: T }>;
  extraHeaderActions?: React.ComponentType<{}>;
  newRecord?: () => Partial<T>;
  beforeUpdateTrigger?: (x: T) => void | Promise<void>;
  schema?: JSONSchema7;
}

const PAGE_SIZE = 100;
/**
 * General Data Record View
 */
export function DataRecordView<T extends {}>(props: IDataRecordViewDef<T>) {
  const [searchFormData, setSearchFormData] = useState({} as any);
  const [refreshCnt, setRefreshCnt] = useState(0);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const tableRef = React.useRef<Table<T>>();

  const { data, fetchNextPage, isFetching } = useInfiniteQuery<T[]>({
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
            const access_key = (column.columnDef as AccessorKeyColumnDef<T[], unknown>).accessorKey;
            if (typeof access_key === 'string') {
              sort.push([access_key, x.desc ? -1 : 1]);
            }
          }
        }
      }

      const filters = Object.entries(searchFormData).filter(([, v]) => v !== '');

      const ordering = sort.map(([key, asc]) => `${key} ${asc > 0 ? 'ASC' : 'DESC'}`);
      const sql = `select * from ${props.TYPE} ${
        filters.length > 0 ? `where ${filters.map(([k, v]) => `${k} = ${escape(v)}`)}` : ''
      } ${ordering.length > 0 ? `order by ${ordering.join()}` : ''} offset ${
        pageParam * PAGE_SIZE
      } limit ${PAGE_SIZE}`;
      console.info('queryDataRecords', searchFormData, sorting, sql);
      const data = await requestSQL<T[]>(terminal, sql);

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
    const columnHelper = createColumnHelper<T>();

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
                  const formData = await showForm<T>(schema, record);
                  await props.beforeUpdateTrigger?.(formData);
                  const wrapper = getDataRecordWrapper(props.TYPE as any);
                  if (!wrapper) {
                    Toast.error(`找不到合适的包装函数，无法更新数据`);
                    return;
                  }
                  const nextRecord: IDataRecord<any> = wrapper(formData);
                  await requestSQL(terminal, buildInsertManyIntoTableSQL([nextRecord], props.TYPE));
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
                  await requestSQL(
                    terminal,
                    `delete from ${props.TYPE} where ${Object.entries(record).map(
                      ([k, v]) => `${k} = ${escape(v)}`,
                    )}`,
                  );
                  Toast.success(`成功删除数据记录`);
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
          const formData = await showForm<T>(schema, props.newRecord?.() ?? {});
          await props.beforeUpdateTrigger?.(formData);
          const nextRecord: T = formData;
          await requestSQL(terminal, buildInsertManyIntoTableSQL([nextRecord], props.TYPE));
          await reloadData();
          Toast.success(`成功更新数据记录`);
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
          await fs.writeFile(filename, JSON.stringify(records, null, 2));
          Toast.success(`已导出: ${filename}, ${records.length} 条`);
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
          const schema = props.schema || getDataRecordSchema(props.TYPE as any);
          if (!schema) {
            Toast.error(`找不到合适的数据规格，无法查询数据`);
            return;
          }
          await requestSQL(terminal, buildInsertManyIntoTableSQL(data, props.TYPE));
          Toast.success(`已导入: ${filename}, ${data.length} / ${data.length} 条`);
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
