export interface ITimeSeriesChartConfig {
  data: Array<
    | {
        type: 'csv';
        /**
         * 数据源的文件名
         */
        filename: string;
        /**
         * 数据列的名称
         */
        time_column_name: string;
      }
    | {
        type: 'promql';
        query: string;
        start_time: string;
        end_time: string;
        step: string;
      }
  >;
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
