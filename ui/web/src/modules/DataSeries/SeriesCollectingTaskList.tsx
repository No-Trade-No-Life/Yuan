import { ISeriesCollectingTask } from '@yuants/data-series';
import { requestSQL } from '@yuants/sql';
import { useObservable, useObservableState } from 'observable-hooks';
import { BehaviorSubject, first, firstValueFrom, of, Subject, switchMap, timeout } from 'rxjs';
import { Button, DataView, Toast } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { encodePath, formatTime } from '@yuants/data-model';

const refresh$ = new BehaviorSubject<void>(void 0);

const data$ = terminal$.pipe(
  switchMap((terminal) =>
    !terminal
      ? of(undefined)
      : refresh$.pipe(
          switchMap(async () => {
            const data = await requestSQL<ISeriesCollectingTask[]>(
              terminal,
              `select * from series_collecting_task`,
            );
            const status = (await terminal.client.requestForResponseData(
              // @ts-ignore
              'SeriesCollector/PeekTaskContext',
              {},
            )) as {
              table_name: string;
              series_id: string;

              completed_at: number;
              current_back_off_time: number;
              last_created_at: number;
              started_at: number;
              status: string;
              api_status?: {
                fetched: number;
                fetched_at: number;
                saved: number;
                saved_at: number;
              };
            }[];

            const mapKeyToStatus = new Map(status.map((x) => [encodePath(x.table_name, x.series_id), x]));

            // left join
            return data.map((task) => {
              const key = encodePath(task.table_name, task.series_id);
              const taskStatus = mapKeyToStatus.get(key);
              return {
                ...task,
                ...taskStatus,
              };
            });
          }),
        ),
  ),
);

registerPage('SeriesCollectingTaskList', () => {
  const data = useObservableState(data$);

  return (
    <DataView
      data={data}
      topSlot={
        <Button
          onClick={async () => {
            refresh$.next();
            await firstValueFrom(
              data$.pipe(
                first((x) => x !== data),
                timeout(5000),
              ),
            );
            Toast.success('数据已刷新');
          }}
        >
          刷新
        </Button>
      }
      columns={[
        {
          header: '数据表',
          accessorKey: 'table_name',
        },
        {
          header: '序列',
          accessorKey: 'series_id',
        },
        {
          header: 'Cron 模式',
          accessorKey: 'cron_pattern',
        },
        {
          header: 'Cron 时区',
          accessorKey: 'cron_timezone',
        },
        {
          header: '回溯数量',
          accessorKey: 'replay_count',
        },
        {
          header: '禁用',
          accessorKey: 'disabled',
        },
        {
          header: '状态',
          accessorKey: 'status',
        },
        {
          header: '错误信息',
          accessorKey: 'error_message',
        },
        {
          header: '当前重试时间 (ms)',
          accessorKey: 'current_back_off_time',
        },
        {
          header: '本次拉取开始时间',
          accessorKey: 'started_at',
          cell: (ctx) => formatTime(ctx.getValue()),
        },
        {
          header: '上次完成时间',
          accessorKey: 'completed_at',
          cell: (ctx) => formatTime(ctx.getValue()),
        },
        {
          header: '本次拉取起点',
          accessorKey: 'last_created_at',
          cell: (ctx) => formatTime(ctx.getValue()),
        },
        {
          header: '本次已拉取',
          accessorKey: 'api_status.fetched',
        },
        {
          header: '本次已保存',
          accessorKey: 'api_status.saved',
        },
        {
          header: '本次拉取至',
          accessorKey: 'api_status.fetched_at',
          cell: (ctx) => formatTime(ctx.getValue()),
        },
        {
          header: '本次保存至',
          accessorKey: 'api_status.saved_at',
          cell: (ctx) => formatTime(ctx.getValue()),
        },
        {
          header: '创建时间',
          accessorKey: 'created_at',
          cell: (ctx) => formatTime(ctx.getValue()),
        },
        {
          header: '更新时间',
          accessorKey: 'updated_at',
          cell: (ctx) => formatTime(ctx.getValue()),
        },
      ]}
    />
  );
});
