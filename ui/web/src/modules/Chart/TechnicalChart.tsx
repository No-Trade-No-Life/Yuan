import { IconRefresh, IconSetting } from '@douyinfe/semi-icons';
import { Button, Empty, Space } from '@douyinfe/semi-ui';
import { HistoryOrderUnit, PeriodDataUnit, Series, SeriesDataUnit } from '@yuants/kernel';
import { TabNode } from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import React, { useEffect, useMemo, useState } from 'react';
import { currentKernel$ } from '../Kernel/model';
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
    // 主图ID = TimeSeries 的 ID
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

export const TechnicalChart = React.memo((props: { node?: TabNode }) => {
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
        data: Array<{ timestamp_in_us: number; value: number }>;
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
        timestamp_in_us: time_series[i],
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

  const orders = useMemo(
    () =>
      kernel?.units.find((unit): unit is HistoryOrderUnit => unit instanceof HistoryOrderUnit)
        ?.historyOrders ?? [],
    [kernel],
  );

  if (!kernel || periodsOptions.length === 0) {
    return <Empty title="无走势图可用" description={'请先运行代码 或 账户回放'} />;
  }

  const hasAuxChart =
    // 有两个或以上的图
    Object.keys(displayConfigList).length > 1 ||
    // 有一个图，但不是主图
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
