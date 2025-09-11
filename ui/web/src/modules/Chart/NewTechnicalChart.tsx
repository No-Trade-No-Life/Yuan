import { useObservable, useObservableRef, useObservableState } from 'observable-hooks';
import { useEffect } from 'react';
import { combineLatestWith, debounceTime, pipe, Subject, switchMap } from 'rxjs';
import { fs } from '../FileSystem';
import { registerPage, usePageParams } from '../Pages';
import { ITimeSeriesChartConfig } from './components/model';
import { TimeSeriesChart } from './components/TimeSeriesChart';

const reloadSignals = new Map<string, Subject<void>>();

/**
 * 重新加载指定配置文件名的图表
 * @param configFilename 图表配置文件名
 */
export const reloadTimeSeriesChart = (configFilename: string) => {
  reloadSignals.get(configFilename)?.next();
};

registerPage('TimeSeriesChart', () => {
  const params = usePageParams<{ filename: string }>();

  const [, refresh$] = useObservableRef<void>();

  useEffect(() => {
    reloadSignals.set(params.filename, refresh$);
    return () => {
      reloadSignals.delete(params.filename);
    };
  }, []);

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

  return config ? (
    <TimeSeriesChart
      config={config}
      onConfigChange={async (config) => {
        await fs.writeFile(params.filename, JSON.stringify(config, null, 2));
      }}
    />
  ) : null;
});
