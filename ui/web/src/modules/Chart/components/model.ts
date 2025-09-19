import { IChartApi } from 'lightweight-charts';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ILoadedData {
  filename: string;
  data_index: number;
  data_length: number;
  time_column_name: string;
  series: Map<string, any[]>;
}

export interface IDataRef {
  /**
   * 数据源的索引
   */
  data_index: number;
  /**
   * 数据列的名称
   */
  column_name: string;
}

/**
 * 不同的图表类型对应不同的 refs 数组内容配置：
 *
 * - 'line': 折线图. refs[0] 是数据的值
 * - 'hist': 柱状图. refs[0] 是数据的值
 * - 'ohlc': K线图. refs[0] 是开盘价, refs[1] 是最高价, refs[2] 是最低价, refs[3] 是收盘价, refs[4] 是成交量
 * - 'order': 订单, refs[0] 是方向, refs[1] 是价格, refs[2] 是数量
 * - 'index': 位置索引图，标记一个数据位置. refs[0] 是位置索引
 */
export interface ISeriesConfig {
  /**
   * 图表类型
   */
  type: string;
  /**
   * 序列名称 (显示在图例中, 默认使用数据列名称)
   */
  name?: string;
  /**
   * 对数据的引用
   */
  refs: IDataRef[];
}

export interface ICustomSeries {
  type: string;
  addSeries: (ctx: {
    //
    chart: IChartApi;
    paneIndex: number;
    seriesIndex: number;
    seriesConfig: ISeriesConfig;
    dataSeries: any[][];
    timeLine: [time: number, index: number][];
    cursor$: BehaviorSubject<number | undefined>;
    viewStartIndex: number;
    dispose$: Observable<void>;
  }) => void;
  Legend: React.ComponentType<{
    seriesConfig: ISeriesConfig;
    seriesIndex: number;
    globalDataSeries: any[][];
    cursorIndex: number;
  }>;
}

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
    | {
        type: 'sql';
        query: string;
        time_column_name: string;
      }
  >;
  views: Array<{
    name: string;
    time_ref: IDataRef;
    panes: Array<{
      series: ISeriesConfig[];
      /**
       * 窗格高度权重 (默认 1, 数值越大窗格越高)
       */
      height_weight?: number;
    }>;
  }>;
}
