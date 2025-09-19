import { IconRefresh, IconSetting } from '@douyinfe/semi-icons';
import { Select, Space, Spin, Toast } from '@douyinfe/semi-ui';
import { SelectProps } from '@douyinfe/semi-ui/lib/es/select';
import { requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { JSONSchema7 } from 'json-schema';
import { useObservable, useObservableRef, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { debounceTime, filter, firstValueFrom, pipe, Subject, switchMap, timeout } from 'rxjs';
import { showForm } from '../../Form';
import { Button } from '../../Interactive';
import { terminal$ } from '../../Network';
import { CSV } from '../../Util';
import { ChartComponent } from './ChartComponent';
import { ITimeSeriesChartConfig } from './model';

const schemaOfChartConfig: JSONSchema7 = {
  type: 'object',
  required: ['data', 'views'],
  properties: {
    data: {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'object',
            required: ['type', 'filename', 'time_column_name'],
            properties: {
              type: { const: 'csv' },
              filename: { type: 'string', title: 'CSV 文件路径' },
              time_column_name: { type: 'string', title: '时间列名称' },
            },
          },
          {
            type: 'object',
            required: ['type', 'query', 'start_time', 'end_time', 'step'],
            properties: {
              type: { const: 'promql' },
              query: { type: 'string', title: 'PromQL 查询语句' },
              start_time: { type: 'string', format: 'date-time', title: '开始时间' },
              end_time: { type: 'string', format: 'date-time', title: '结束时间' },
              step: { type: 'string', title: '步长 (如 15s, 1m, 1h)' },
            },
          },
        ],
      },
    },
    views: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'time_ref', 'panes'],
        properties: {
          name: { type: 'string', title: '视图名称' },
          time_ref: {
            type: 'object',
            title: '时间轴',
            required: ['data_index', 'column_name'],
            properties: {
              data_index: { type: 'number', title: '数据源索引' },
              column_name: { type: 'string', title: '列名称' },
            },
          },
          panes: {
            type: 'array',
            title: '窗格',
            items: {
              type: 'object',
              properties: {
                height_weight: {
                  type: 'number',
                  title: '窗格高度权重 (默认 1, 数值越大窗格越高)',
                },
                series: {
                  type: 'array',
                  title: '数据列',
                  minItems: 1,
                  items: {
                    type: 'object',
                    required: ['type', 'refs'],
                    properties: {
                      type: {
                        type: 'string',
                        title: '图表类型',
                        enum: ['line', 'hist', 'ohlc', 'order', 'index'],
                      },
                      name: {
                        type: 'string',
                        title: '序列名称',
                        description: '显示在图例中, 默认使用数据列名称',
                      },
                      refs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['data_index', 'column_name'],
                          properties: {
                            data_index: { type: 'number', title: '数据源索引' },
                            column_name: { type: 'string', title: '列名称' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const reloadSignals = new Map<string, Subject<void>>();

/**
 * 重新加载指定配置文件名的图表
 * @param configFilename 图表配置文件名
 */
export const reloadTimeSeriesChart = (configFilename: string) => {
  reloadSignals.get(configFilename)?.next();
};

/**
 * 时序图表视图组件
 *
 * 基于 lightweight-charts 库，实现图表展示数据
 *
 * 图表的核心是配置，从配置中定义数据源的获取方式、图表类型、样式等。
 *
 * 图表配置从一个 JSON 文件中获取
 *
 * - 支持多数据源
 * - 支持多种图表类型 (OHLC, Line, Bar, ...etc)
 * - 支持多个视图配置
 *
 */
export const TimeSeriesChart = (props: {
  topSlot?: React.ReactNode;
  config: ITimeSeriesChartConfig;
  onConfigChange?: (config: ITimeSeriesChartConfig) => void | Promise<void>;
}) => {
  const [viewIndex, setViewIndex] = useState<number>(0);

  const [, refresh$] = useObservableRef<void>();

  const config = props.config;

  const data$ = useObservable(
    pipe(
      debounceTime(500),
      switchMap(([data]) =>
        Promise.all(
          (data ?? [])
            .map(async (s, index) => {
              if (s.type === 'csv') {
                return CSV.readFile(s.filename).then((records) => {
                  const series: Map<string, any[]> = new Map();
                  records.forEach((record) => {
                    for (const key in record) {
                      if (!series.has(key)) {
                        series.set(key, []);
                      }
                      series.get(key)!.push(record[key]);
                    }
                  });
                  return {
                    //
                    filename: s.filename,
                    data_index: index,
                    data_length: records.length,
                    time_column_name: s.time_column_name,
                    series,
                  };
                });
              }
              if (s.type === 'promql') {
                const terminal = await firstValueFrom(terminal$);
                if (!terminal) throw new Error('No terminal available for Prometheus query');
                const data = await terminal.client.requestForResponseData<
                  { query: string; start: string; end: string; step: string },
                  {
                    data: {
                      resultType: string;
                      result: Array<{ metric: Record<string, string>; values: [number, string][] }>;
                    };
                    status: string;
                  }
                >('prometheus/query_range', {
                  query: s.query,
                  start: new Date(s.start_time).getTime() / 1000 + '',
                  end: new Date(s.end_time).getTime() / 1000 + '',
                  step: s.step,
                });

                const series = new Map<string, any[]>();

                const times = new Set<number>();
                data.data.result.forEach((s) => {
                  s.values.forEach(([t, v]) => {
                    times.add(t);
                  });
                });

                const timeSeries = Array.from(times).sort((a, b) => a - b);
                series.set(
                  '__time',
                  timeSeries.map((t) => t * 1000),
                );

                data.data.result.forEach((s) => {
                  const seriesName = JSON.stringify(s.metric);
                  const map = new Map(s.values);
                  series.set(
                    seriesName,
                    timeSeries.map((t) => map.get(t)),
                  );
                });

                return {
                  filename: `promql:${s.query}`,
                  data_index: index,
                  data_length: data.data.result[0].values.length,
                  time_column_name: '__time',
                  series,
                };
              }
              if (s.type === 'sql') {
                const terminal = await firstValueFrom(terminal$);
                if (!terminal) throw new Error('No terminal available for SQL query');
                const data = await requestSQL<any[]>(terminal, s.query);
                const series: Map<string, any[]> = new Map();
                data.forEach((record) => {
                  const { [s.time_column_name]: time, ...others } = record;
                  const t = new Date(time).getTime();
                  if (!series.has(s.time_column_name)) {
                    series.set(s.time_column_name, []);
                  }
                  series.get(s.time_column_name)!.push(t);
                  for (const key in others) {
                    if (!series.has(key)) {
                      series.set(key, []);
                    }
                    series.get(key)!.push(others[key]);
                  }
                });
                return {
                  filename: `sql:${s.query.slice(0, 30)}...`,
                  data_index: index,
                  data_length: data.length,
                  time_column_name: s.time_column_name,
                  series,
                };
              }
              throw new Error(`Unsupported data source type: ${(s as any).type}`);
            })
            .map((p) =>
              p.then((v) => {
                console.info(
                  formatTime(Date.now()),
                  'DataLoaded',
                  v.filename,
                  'with',
                  v.data_length,
                  'rows and ',
                  v.series.size,
                  'series',
                );
                return v;
              }),
            ),
        ),
      ),
    ),
    [config.data],
  );

  const data = useObservableState(data$);

  const onSelectView = (v: SelectProps['value']) => {
    setViewIndex(Number(v));
  };

  return (
    <Space vertical align="start" style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      {config && (
        <ChartComponent
          topSlot={
            <>
              {props.topSlot}
              <Button
                icon={<IconSetting />}
                onClick={async () => {
                  const data = await showForm<ITimeSeriesChartConfig>(schemaOfChartConfig, config);
                  await props.onConfigChange?.(data);
                  refresh$.next();
                  Toast.success('配置已更新');
                }}
              />
              <Button
                icon={<IconRefresh />}
                onClick={async () => {
                  refresh$.next();
                  await firstValueFrom(
                    data$.pipe(
                      filter((x) => x !== data),
                      timeout(30_000),
                    ),
                  );
                  Toast.success('数据已刷新');
                }}
              />
              {!data && <Spin />}
              <Select
                value={viewIndex}
                prefix="View"
                onSelect={onSelectView}
                optionList={config.views.map((item, index) => ({ value: index, label: item.name }))}
              ></Select>
            </>
          }
          view={config.views[viewIndex]}
          data={data}
          onViewChange={async (newView) => {
            const newConfig = structuredClone(config);
            newConfig.views[viewIndex] = newView;
            await props.onConfigChange?.(newConfig);
            refresh$.next();
            Toast.success('视图已更新');
          }}
        />
      )}
    </Space>
  );
};
