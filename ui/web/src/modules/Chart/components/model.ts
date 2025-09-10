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
