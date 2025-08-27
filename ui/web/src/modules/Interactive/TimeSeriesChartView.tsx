import { Select, Space, Spin } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { debounceTime, pipe, switchMap, tap } from 'rxjs';
import { CSV } from '../Util';

export interface ITimeSeriesChartConfig {
  data: Array<{
    type: 'csv';
    /**
     * 数据源的文件名
     */
    filename: string;
    /**
     * 数据列的名称
     */
    time_column_name: string;
  }>;
  views: Array<{
    name: string;
    time_ref: {
      data_index: number;
      column_name: string;
    };
    panes: Array<{
      series: Array<{
        /**
         * 图表类型
         *
         * 不同的图表类型对应不同的 refs 数组内容配置：
         *
         * - 'line': 折线图. refs[0] 是数据的值
         * - 'bar': 柱状图. refs[0] 是数据的值
         * - 'ohlc': K线图. refs[0] 是开盘价, refs[1] 是最高价, refs[2] 是最低价, refs[3] 是收盘价, refs[4] 是成交量
         * - 'index': 位置索引图，标记一个数据位置. refs[0] 是位置索引
         */
        type: string; // 'line', 'bar', 'ohlc', 'index', etc.
        /**
         * 对数据的引用
         */
        refs: Array<{
          /**
           * 数据源的索引
           */
          data_index: number;
          /**
           * 数据列的名称
           */
          column_name: string;
        }>;
      }>;
    }>;
  }>;
}

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
export const TimeSeriesChartView = (props: { config: ITimeSeriesChartConfig }) => {
  const { config } = props;

  const data = useObservableState(
    useObservable(
      pipe(
        debounceTime(500),
        switchMap(([data]) =>
          Promise.all(
            data.map((item, index) =>
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
                  filename: item.filename,
                  data_index: index,
                  data_length: records.length,
                  series,
                };
              }),
            ),
          ),
        ),
        tap((data) => console.info(formatTime(Date.now()), 'Data loaded:', data)),
      ),
      [config.data],
    ),
  );

  const [selectedViewIndex, setSelectedViewIndex] = useState(0);

  const selectedView = config.views[selectedViewIndex];

  const selectedViewTimeData =
    data?.[selectedView?.time_ref.data_index].series.get(selectedView?.time_ref.column_name) ?? [];

  return (
    <Space vertical align="start" style={{ width: '100%', height: '100%' }}>
      <Space>
        数据源:
        {data ? (
          <ol start={0}>
            {data.map((data) => (
              <li key={data.filename}>
                {data.filename}: {data.data_length} rows x {data.series.size} cols
              </li>
            ))}
          </ol>
        ) : (
          <Spin />
        )}
      </Space>
      <Space>
        <Select
          prefix="视图"
          value={selectedViewIndex}
          onChange={(v) => setSelectedViewIndex(v as number)}
          optionList={config.views.map((v, i) => ({ value: i, label: v.name }))}
        />
        时间轴: #{selectedView?.time_ref.data_index}.{selectedView?.time_ref.column_name}{' '}
        {formatTime(+selectedViewTimeData[0])}
        {' - '}
        {formatTime(+selectedViewTimeData[selectedViewTimeData.length - 1])}
      </Space>
    </Space>
  );
};
