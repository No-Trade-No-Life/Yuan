import { IDataRef, ILoadedData } from './model';

export const resolveDataRefToDataArray = (data: ILoadedData[], dataRef: IDataRef) => {
  const dataItem = data.find((item) => item.data_index === dataRef.data_index);
  if (!dataItem) return null;
  const dataArray = dataItem.series.get(dataRef.column_name);
  if (!dataArray) return null;
  return dataArray;
};

export const resolveDataRefToTimeArray = (data: ILoadedData[], dataRef: IDataRef) => {
  const dataItem = data.find((item) => item.data_index === dataRef.data_index);
  if (!dataItem) return null;
  const timeArray = dataItem.series.get(dataItem.time_column_name);
  if (!timeArray) return null;
  return timeArray;
};
