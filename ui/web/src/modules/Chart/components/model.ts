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
  data_index: number;
  column_name: string;
}

export interface ICustomSeries {
  type: string;
  addSeries: (ctx: {
    //
    chart: IChartApi;
    paneIndex: number;
    seriesIndex: number;
    seriesConfig: {
      type: string;
      refs: IDataRef[];
    };
    dataSeries: any[][];
    timeLine: [time: number, index: number][];
    cursor$: BehaviorSubject<number | undefined>;
    viewStartIndex: number;
    dispose$: Observable<void>;
  }) => void;
  renderLegend: (props: {
    seriesConfig: { type: string; refs: IDataRef[] };
    seriesIndex: number;
    globalDataSeries: any[][];
    cursorIndex: number;
  }) => React.ReactNode;
}
