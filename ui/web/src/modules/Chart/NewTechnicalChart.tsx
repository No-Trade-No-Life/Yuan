import { IconRefresh, IconSetting } from '@douyinfe/semi-icons';
import { Select, Space, Toast } from '@douyinfe/semi-ui';
import { SelectProps } from '@douyinfe/semi-ui/lib/es/select';
import { useObservable, useObservableRef, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { combineLatestWith, debounceTime, pipe, switchMap } from 'rxjs';
import { fs } from '../FileSystem';
import { showForm } from '../Form';
import { Button, ITimeSeriesChartConfig } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';
import { CSV } from '../Util';
import { ChartComponent } from './components/ChartComponent';

registerPage('NewTechnicalChart', () => {
  const [t] = useTranslation('TechnicalChart');

  const params = usePageParams<{ filename: string }>();
  const [viewIndex, setViewIndex] = useState<number>(0);

  const [, refresh$] = useObservableRef<void>();

  const config = useObservableState(
    useObservable(
      pipe(
        combineLatestWith(refresh$),
        debounceTime(500),
        switchMap(([[filename]]) =>
          fs.readFile(filename).then((content) => {
            return JSON.parse(content) as ITimeSeriesChartConfig;
          }),
        ),
      ),
      [params.filename],
    ),
  );

  const data = useObservableState(
    useObservable(
      pipe(
        debounceTime(500),
        switchMap(([data]) =>
          Promise.all(
            (data ?? []).map((item, index) =>
              CSV.readFile(item.filename).then((records) => {
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
                  time_column_name: item.time_column_name,
                  filename: item.filename,
                  data_index: index,
                  data_length: records.length,
                  series,
                };
              }),
            ),
          ),
        ),
      ),
      [config?.data],
    ),
  );

  const onSelectView = (v: SelectProps['value']) => {
    setViewIndex(Number(v));
  };

  return (
    <Space vertical align="start" style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <Space
        vertical
        align="start"
        style={{ display: 'flex', width: '100%', flexGrow: '1', overflow: 'hidden' }}
      >
        {config && (
          <ChartComponent
            topSlot={
              <>
                <Button
                  icon={<IconSetting />}
                  onClick={async () => {
                    const data = await showForm<ITimeSeriesChartConfig>(
                      {
                        type: 'object',
                        required: ['data', 'views'],
                        properties: {
                          data: {
                            type: 'array',
                            items: {
                              type: 'object',
                              required: ['type', 'filename', 'time_column_name'],
                              properties: {
                                type: { const: 'csv' },
                                filename: { type: 'string', title: 'CSV 文件路径' },
                                time_column_name: { type: 'string', title: '时间列名称' },
                              },
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
                      },
                      config,
                    );
                    await fs.writeFile(params.filename, JSON.stringify(data, null, 2));
                    refresh$.next();
                    Toast.success('保存成功到 ' + params.filename);
                  }}
                />
                <Button
                  icon={<IconRefresh />}
                  onClick={() => {
                    refresh$.next();
                  }}
                />
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
          />
        )}
      </Space>
    </Space>
  );
});
