import { firstValueFrom } from 'rxjs';
import { terminal$ } from '../../Network';
import { requestSQL } from '@yuants/sql';
import { ITimeSeriesChartConfig } from './model';

export const loadSqlData = async (s: ITimeSeriesChartConfig['data'][0], index: number) => {
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
  throw new Error(`Unsupported data source type: ${(s as any).type}`);
};
