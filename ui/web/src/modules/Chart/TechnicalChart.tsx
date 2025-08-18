import { IconRefresh, IconSetting } from '@douyinfe/semi-icons';
import { Button, Empty, Input, Slider, Space } from '@douyinfe/semi-ui';
import { IOrder } from '@yuants/data-model';
import { PeriodDataUnit, Series, SeriesDataUnit } from '@yuants/kernel';
import { formatTime } from '@yuants/utils';
import { useObservable, useObservableRef, useObservableState } from 'observable-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { catchError, debounceTime, defer, map, of, pipe, switchMap } from 'rxjs';
import { AccountSelector } from '../AccountInfo';
import { fs } from '../FileSystem';
import { currentKernel$ } from '../Kernel/model';
import { registerPage } from '../Pages';
import { CSV } from '../Util';
import {
  CandlestickSeries,
  Chart,
  ChartGroup,
  HistogramSeries,
  IndexSeries,
  LineSeries,
  OrderSeries,
} from './components/Charts';

const DEFAULT_SINGLE_COLOR_SCHEME: string[] = [
  '#5B8FF9',
  '#61DDAA',
  '#F6BD16',
  '#7262fd',
  '#78D3F8',
  '#9661BC',
  '#F6903D',
  '#008685',
  '#F08BB4',
];

const resolveChartId = (series: Series): string => {
  const chartConfig = series.tags['chart'];
  if (series.parent === undefined) {
    // Main Chart ID is the TimeSeries's ID
    return series.series_id;
  }
  if (chartConfig === undefined) {
    return resolveChartId(series.parent);
  }
  if (chartConfig === 'new') {
    return series.series_id;
  }
  if (typeof chartConfig === 'string') {
    return chartConfig;
  }
  throw new Error(`chart config illegal: ${series.series_id} (${series.name})`);
};

registerPage('TechnicalChart', () => {
  const [t] = useTranslation('TechnicalChart');
  const [frame, setFrame] = useState(0);
  const kernel = useObservableState(currentKernel$);

  const [ordersFilename, setOrdersFilename] = useState('');

  useEffect(() => {
    if (kernel) {
      setOrdersFilename(`/.Y/kernels/${encodeURIComponent(kernel.id)}/orders.csv`);
    }
  }, [kernel]);

  const all_orders = useObservableState(
    useObservable(
      pipe(
        debounceTime(200),
        switchMap(([ordersFilename]) =>
          defer(() => fs.readFile(ordersFilename)).pipe(
            //
            map((content) => CSV.parse<IOrder>(content)),
            catchError(() => of([] as IOrder[])),
          ),
        ),
      ),
      [ordersFilename],
    ),
    [],
  );

  const [periodKey, setPeriodKey] = useState(undefined as string | undefined);

  const [page, setPage] = useState(1);

  const PAGE_SIZE = 20000;

  const periodDataMap = useMemo(() => {
    return kernel?.units.find((unit): unit is PeriodDataUnit => unit instanceof PeriodDataUnit)?.data ?? {};
  }, [kernel]);

  const periodsOptions = useMemo(
    () => Object.entries(periodDataMap).map(([key, value]) => ({ label: key, value: key })) ?? [],
    [periodDataMap],
  );
  useEffect(() => {
    setPeriodKey(periodsOptions[0]?.value);
  }, [periodsOptions]);
  const selectedPeriodData = periodDataMap[periodKey || ''] ?? [];

  const series = useMemo(
    () => kernel?.units.find((unit): unit is SeriesDataUnit => unit instanceof SeriesDataUnit)?.series ?? [],
    [kernel],
  );

  const noData = series.length === 0;

  const timeSeriesList = useMemo(() => [...new Set(series.map((series) => series.resolveRoot()))], [series]);

  const displayConfigList = useMemo(() => {
    const mapChartIdToDisplayConfigList: Record<
      string,
      {
        chartId: string;
        title: string;
        type: string;
        color: string;
        data: Array<{ timestamp: number; value: number }>;
      }[]
    > = {};
    series.forEach((series) => {
      const display = series.tags['display'] || 'none';
      if (display === 'none') return;
      const time_series = series.resolveRoot();
      const chartId = resolveChartId(series);
      const title = series.name || 'no-title';
      const colorConfig = series.resolveValue('color') || 'auto';
      const brothers = (mapChartIdToDisplayConfigList[chartId] ??= []);
      const color =
        colorConfig === 'auto'
          ? DEFAULT_SINGLE_COLOR_SCHEME[brothers.length % DEFAULT_SINGLE_COLOR_SCHEME.length]
          : colorConfig;
      const data = Array.from({ length: time_series.length }, (_, i) => ({
        timestamp: time_series[i],
        value: series[i],
      }));
      brothers.push({
        chartId,
        title,
        type: display,
        color,
        data,
      });
    });
    return mapChartIdToDisplayConfigList;
  }, [series]);

  const accountIdOptions = useMemo(
    () => [...new Set(all_orders.map((order) => order.account_id))],
    [all_orders],
  );
  const [accountId, setAccountId] = useState('');
  const orders = all_orders.filter((order) => order.account_id === accountId);

  const [hoverIndex, setHoverIndex] = useState(-1);
  // const [viewStartIndex, setViewStartIndex] = useState(0);
  const [viewStartIndexRef, viewStartIndex$] = useObservableRef(0);
  const viewStartIndex = useObservableState(
    useObservable(() => viewStartIndex$.pipe(debounceTime(500))),
    0,
  );

  if (noData) {
    return <Empty title={t('empty_reminder')} description={t('empty_reminder_description')} />;
  }

  const hasAuxChart =
    // more than 1 charts
    Object.keys(displayConfigList).length > 1 ||
    // only 1 chart but not the main chart
    (Object.keys(displayConfigList).length === 1 && !displayConfigList[timeSeriesList[0]?.series_id]);

  const viewEndIndex = viewStartIndex + PAGE_SIZE;
  const totalItems = series?.[0].length ?? 0;
  return (
    <Space vertical align="start" style={{ height: '100%', width: '100%' }}>
      <Space>
        <Space>
          <Input prefix="订单文件路径" value={ordersFilename} onChange={(v) => setOrdersFilename(v)} />
        </Space>
        <AccountSelector value={accountId} onChange={setAccountId} candidates={accountIdOptions} />
        <Button
          icon={<IconRefresh />}
          onClick={() => {
            setFrame((x) => x + 1);
          }}
        ></Button>
        <Button icon={<IconSetting />} disabled></Button>
        {totalItems - PAGE_SIZE > 0 && (
          <Slider
            showBoundary
            style={{ width: 200 }}
            min={0}
            max={totalItems - PAGE_SIZE}
            step={PAGE_SIZE / 10}
            tipFormatter={(v) => {
              return formatTime(selectedPeriodData[v as number]?.created_at);
            }}
            onChange={(v) => {
              viewStartIndex$.next(v as number);
            }}
          />
        )}
        {formatTime(selectedPeriodData[viewStartIndex]?.created_at)}
        {' - '}
        {formatTime(
          (selectedPeriodData[viewEndIndex] || selectedPeriodData[selectedPeriodData.length - 1])?.created_at,
        )}{' '}
        #{hoverIndex + viewStartIndex}
      </Space>
      <ChartGroup
        key={frame}
        viewStartIndex={viewStartIndex}
        viewEndIndex={viewEndIndex}
        hoverIndex={hoverIndex}
        onHoverIndexChange={setHoverIndex}
      >
        <div style={{ width: '100%', minHeight: '50%', flex: 'auto' }}>
          <Chart>
            <CandlestickSeries data={selectedPeriodData}>
              <OrderSeries duration={selectedPeriodData[0]?.duration ?? 'PT1M'} orders={orders} />
              {displayConfigList[timeSeriesList[0]?.series_id]?.map((chartData) =>
                chartData.type === 'index' ? (
                  <IndexSeries
                    options={{ title: chartData.title, color: chartData.color }}
                    data={chartData.data}
                  />
                ) : (
                  <LineSeries
                    options={{ title: chartData.title, color: chartData.color }}
                    data={chartData.data}
                  />
                ),
              )}
            </CandlestickSeries>
          </Chart>
        </div>
        {hasAuxChart && (
          <div style={{ width: '100%', overflow: 'scroll' }}>
            {Object.entries(displayConfigList)
              .filter(([k, v]) => !timeSeriesList.find((series) => series.series_id === k))
              .map(([chartId, chartDataList]) => (
                <div style={{ height: 150 }}>
                  <Chart>
                    {chartDataList.map((chartData) =>
                      chartData.type === 'hist' ? (
                        <HistogramSeries
                          options={{ title: chartData.title, color: chartData.color }}
                          data={chartData.data}
                        />
                      ) : chartData.type === 'index' ? (
                        <IndexSeries
                          options={{ title: chartData.title, color: chartData.color }}
                          data={chartData.data}
                        />
                      ) : (
                        <LineSeries
                          options={{ title: chartData.title, color: chartData.color }}
                          data={chartData.data}
                        />
                      ),
                    )}
                  </Chart>
                </div>
              ))}
          </div>
        )}
      </ChartGroup>
    </Space>
  );
});
