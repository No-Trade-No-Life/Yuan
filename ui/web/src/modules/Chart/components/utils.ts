import { requestSQL } from '@yuants/sql';
import { firstValueFrom } from 'rxjs';
import { terminal$ } from '../../Network';
import { CSV } from '../../Util';
import { ILoadedData, ITimeSeriesChartConfig } from './model';

export const loadObjectArrayData = <T>(
  data: T[],
  time_column_name: keyof T & string,
): Pick<ILoadedData, 'data_length' | 'time_column_name' | 'series'> => {
  const data_length = data.length;
  const keys = Object.keys(data[0] ?? {});
  const series = new Map(
    keys.map((key) => [key, Array.from({ length: data_length }, (_, i) => (data[i] as any)[key])]),
  );
  return {
    data_length,
    time_column_name,
    series,
  };
};

export const loadTimeSeriesData = async (
  s: ITimeSeriesChartConfig['data'][0],
  index = 0,
): Promise<ILoadedData> => {
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

    if (data.length === 0) throw new Error(`Query returned no data: ${s.query}`);

    if (data[0][s.time_column_name] === undefined)
      throw new Error(`Time column not found: ${s.time_column_name}`);
    // Initialize series map
    const series: Map<string, any[]> = new Map(Object.keys(data[0]).map((key) => [key, []]));

    data
      .map(({ [s.time_column_name]: time, ...others }) => ({
        v: others,
        t: new Date(time).getTime(),
      }))
      .sort((a, b) => a.t - b.t)
      .forEach(({ t, v }) => {
        series.get(s.time_column_name)!.push(t);
        for (const key in v) {
          series.get(key)!.push(v[key]);
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
  if (s.type === 'data') {
    return {
      filename: s.name,
      data_index: index,
      data_length: s.data_length,
      series: s.series,
      time_column_name: s.time_column_name,
    };
  }
  throw new Error(`Unsupported data source type: ${(s as any).type}`);
};
