import { Select, Space } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/utils';
import { useObservable, useObservableState } from 'observable-hooks';
import { createContext } from 'react';
import { useTranslation } from 'react-i18next';
import { BehaviorSubject, combineLatestWith, debounceTime, mergeWith, pipe, switchMap, tap } from 'rxjs';
import { registerPage, usePageParams } from '../Pages';
import { CSV } from '../Util';
import { Button, ITimeSeriesChartConfig } from '../Interactive';
import { ChartComponent } from './components/ChartComponent';
import { fs } from '../FileSystem';
import { IconRefresh, IconSetting } from '@douyinfe/semi-icons';

const refresh$ = new BehaviorSubject(undefined);

export const ChartDataContext = createContext<
  | {
      filename: string;
      data_index: number;
      data_length: number;
      time_column_name: string;
      series: Map<string, any[]>;
    }[]
  | undefined
>(undefined);

registerPage('NewTechnicalChart', () => {
  const [t] = useTranslation('TechnicalChart');

  const params = usePageParams() as { filename: string };

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
        tap((data) => console.info(formatTime(Date.now()), 'Data loaded:', data)),
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
        tap((data) => console.info(formatTime(Date.now()), 'Data loaded:', data)),
      ),
      [config?.data],
    ),
  );
  console.log({ data, config });
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
                <Button disabled icon={<IconSetting />} />
                <Button
                  icon={<IconRefresh />}
                  onClick={() => {
                    refresh$.next(undefined);
                  }}
                />
                <Select prefix="View" optionList={[]}></Select>
              </>
            }
            view={config.views[0]}
            data={data}
          />
        )}
      </Space>
    </Space>
  );
});
