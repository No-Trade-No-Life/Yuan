import { IconRefresh, IconSetting } from '@douyinfe/semi-icons';
import { Button, Empty, Space } from '@douyinfe/semi-ui';
import { PeriodDataUnit, Series, SeriesDataUnit } from '@yuants/kernel';
import { useObservableState } from 'observable-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentKernel$ } from '../Kernel/model';
import { orders$ } from '../Order/model';
import { registerPage } from '../Pages';
import {
  CandlestickSeries,
  Chart,
  ChartGroup,
  HistogramSeries,
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
  const [periodKey, setPeriodKey] = useState(undefined as string | undefined);

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

  const orders = useObservableState(orders$);

  if (!kernel || periodsOptions.length === 0) {
    return <Empty title={t('empty_reminder')} description={t('empty_reminder_description')} />;
  }

  const hasAuxChart =
    // more than 1 charts
    Object.keys(displayConfigList).length > 1 ||
    // only 1 chart but not the main chart
    (Object.keys(displayConfigList).length === 1 && !displayConfigList[timeSeriesList[0]?.series_id]);

  return (
    <Space vertical align="start" style={{ height: '100%', width: '100%' }}>
      <Space>
        <Button
          icon={<IconRefresh />}
          onClick={() => {
            setFrame((x) => x + 1);
          }}
        ></Button>
        <Button icon={<IconSetting />} disabled></Button>
      </Space>
      <ChartGroup key={kernel.id + frame}>
        <div style={{ width: '100%', minHeight: '50%', flex: 'auto' }}>
          <Chart>
            <CandlestickSeries data={selectedPeriodData}>
              <OrderSeries orders={orders} />
            </CandlestickSeries>
            {displayConfigList[timeSeriesList[0]?.series_id]?.map((chartData) => (
              <LineSeries
                options={{ title: chartData.title, color: chartData.color }}
                data={chartData.data}
              />
            ))}
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
