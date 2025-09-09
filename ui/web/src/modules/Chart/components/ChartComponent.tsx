import { Slider, Space } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/utils';
import {
  CandlestickSeries,
  ChartOptions,
  ColorType,
  createChart,
  createSeriesMarkers,
  DeepPartial,
  HistogramSeries,
  IChartApi,
  LineSeries,
  MouseEventParams,
  SeriesMarker,
  Time,
} from 'lightweight-charts';
import { memo, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ITimeSeriesChartConfig } from '../../Interactive';
import { useIsDarkMode } from '../../Workbench';
import { VertLine } from '../Plugins/VerticalLine';
import { useObservable, useObservableRef, useObservableState } from 'observable-hooks';
import { debounceTime } from 'rxjs';

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
  '#26a69a',
];

const AreaOption = {
  lineColor: '#2962FF',
  topColor: '#2962FF',
  bottomColor: 'rgba(41, 98, 255, 0.28)',
};
const ChartOption: DeepPartial<ChartOptions> = {
  layout: {
    textColor: 'rgba(0, 0, 0, 0.9)',
    background: { type: ColorType.Solid, color: 'white' },
    panes: {
      separatorColor: '#f22c3d',
      separatorHoverColor: 'rgba(255, 0, 0, 0.1)',
      // setting this to false will disable the resize of the panes by the user
      enableResize: true,
    },
  },
  grid: {
    vertLines: {
      color: 'rgba(197, 203, 206, 0.5)',
    },
    horzLines: {
      color: 'rgba(197, 203, 206, 0.5)',
    },
  },
  rightPriceScale: {
    borderColor: 'rgba(197, 203, 206, 0.8)',
  },
  timeScale: {
    borderColor: 'rgba(197, 203, 206, 0.8)',
  },
  localization: {
    timeFormatter: (v: Time) => new Date(Number(v) * 1000).toLocaleString(),
  },
};
const DarkModeChartOption: DeepPartial<ChartOptions> = {
  layout: {
    textColor: 'rgba(255, 255, 255, 0.9)',
    background: { type: ColorType.Solid, color: '#000000' },
    panes: {
      separatorColor: '#f22c3d',
      separatorHoverColor: 'rgba(255, 0, 0, 0.1)',
      // setting this to false will disable the resize of the panes by the user
      enableResize: true,
    },
  },
  grid: {
    vertLines: {
      color: 'rgba(197, 203, 206, 0.5)',
    },
    horzLines: {
      color: 'rgba(197, 203, 206, 0.5)',
    },
  },
  rightPriceScale: {
    borderColor: 'rgba(197, 203, 206, 0.8)',
  },
  timeScale: {
    borderColor: 'rgba(197, 203, 206, 0.8)',
  },
  localization: {
    timeFormatter: (v: Time) => new Date(Number(v) * 1000).toLocaleString(),
  },
};

const candlestickOption = {
  upColor: '#26a69a',
  downColor: '#ef5350',
  borderVisible: false,
  wickUpColor: '#26a69a',
  wickDownColor: '#ef5350',
};
const PAGE_SIZE = 5000;

function waitForPaneElement(pane: any, maxRetries: number = 20): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    let retries = 0;
    function check() {
      const el = pane.getHTMLElement();
      if (el) {
        resolve(el);
        return;
      }
      if (retries++ >= maxRetries) {
        reject(new Error('Pane element not available after retries'));
        return;
      }
      // 下一帧再试
      requestAnimationFrame(check);
    }
    check();
  });
}

interface Props {
  view: ITimeSeriesChartConfig['views'][0];
  topSlot?: ReactNode;
  data?: {
    filename: string;
    data_index: number;
    data_length: number;
    time_column_name: string;
    series: Map<string, any[]>;
  }[];
}

interface DisplayData {
  time: Time;
  value?: any;
  high?: number;
  open?: number;
  low?: number;
  close?: number;
  orderDirection?: string;
  tradePrice?: number;
  volume?: number;
}

const mergeTimeLine = (timeLine: number[][], mainTimeLine: number[]): number[][] => {
  const result: number[][] = [];
  let timeLineIndex = 0;

  for (let mainTimeLineIndex = 0; mainTimeLineIndex < mainTimeLine.length; mainTimeLineIndex++) {
    const mainTime = mainTimeLine[mainTimeLineIndex];
    for (; timeLineIndex < timeLine.length; timeLineIndex++) {
      const [currentTime, dataIndex] = timeLine[timeLineIndex];
      const [nextTime] = timeLine[timeLineIndex + 1] ?? [];
      if (currentTime > mainTime) break;
      if (timeLineIndex === timeLine.length - 1) {
        result.push([mainTime, dataIndex]);
      } else if (nextTime > mainTime) {
        result.push([mainTime, dataIndex]);
      }
    }
  }

  // 将剩余数据进行合并
  // timeLine.slice(timeLineIndex).forEach((data) => {
  //   if (result[result.length - 1][0] !== data[0]) {
  //     result.push(data);
  //   }
  // });
  return result;
};

export const ChartComponent = memo((props: Props) => {
  const { view, data } = props;
  const darkMode = useIsDarkMode();
  const [cursor, setCursor] = useState<number>();

  const [, sliderValue$] = useObservableRef(0);
  const viewStartIndex = useObservableState(
    useObservable(() => sliderValue$.pipe(debounceTime(100)), []),
    0,
  );
  const UpdateLegendFuncQueue: Function[] = [];

  const domRef = useRef<HTMLDivElement | null>(null);

  const chartRef = useRef<IChartApi | null>(null);

  const totalTimeLine = (data || [])
    .find((item) => item.data_index === view.time_ref.data_index)
    ?.series.get(view.time_ref.column_name);

  const totalItems = totalTimeLine?.length ?? 0;

  const startIndex = viewStartIndex;
  const endIndex = Math.min(totalItems, viewStartIndex + PAGE_SIZE);
  const endTime = ~~(parseFloat(totalTimeLine?.[endIndex - 1]) / 1000);
  const startTime = ~~(parseFloat(totalTimeLine?.[startIndex]) / 1000);

  const totalDisplayData = useMemo(() => {
    if (!view || !data) return null;
    const mainTimeLine = data
      .find((item) => item.data_index === view.time_ref.data_index)
      ?.series.get(view.time_ref.column_name)
      ?.map((t) => ~~(parseFloat(t) / 1000));
    if (!mainTimeLine) return null;

    return view.panes.map((pane) => {
      return pane.series.map((s) => {
        if (s.refs.length < 1) return null;
        //找到ref对应的timeline
        const dataItem = data.find((item) => item.data_index === s.refs[0].data_index);
        if (!dataItem) return null;
        let timeLine = dataItem.series
          .get(dataItem.time_column_name)
          ?.map((t, index) => [~~(parseFloat(t) / 1000), index]);
        if (!timeLine) return null;
        // 若ref与view timeline不一致则归并对其
        if (s.refs[0].data_index !== view.time_ref.data_index) {
          timeLine = mergeTimeLine(timeLine, mainTimeLine);
        }
        const displayDataList: DisplayData[] = [];
        // 通过data_index column_name找到数据
        const dataSeries = s.refs
          .map((ref) => data.find((item) => item.data_index === ref.data_index)?.series.get(ref.column_name))
          .filter((x) => !!x);
        if (s.type === 'line' || s.type === 'hist' || s.type === 'index') {
          // 通过data_index column_name找到数据，并完成映射为图表需要的结构
          if (dataSeries) {
            timeLine.forEach(([time], index) => {
              displayDataList.push({
                time: time as Time,
                value: parseFloat(dataSeries[0]![index]),
              });
            });
          }
        }
        if (s.type === 'ohlc') {
          if (dataSeries.length === 4) {
            timeLine
              .map(([time, index]) => ({
                time: time as Time,
                open: parseFloat(dataSeries[0]![index]),
                high: parseFloat(dataSeries[1]![index]),
                low: parseFloat(dataSeries[2]![index]),
                close: parseFloat(dataSeries[3]![index]),
              }))
              .filter((x) => !!x.time && !isNaN(x.open) && !isNaN(x.high) && !isNaN(x.low) && !isNaN(x.close))
              .forEach((item) => displayDataList.push(item));
          }
        }
        if (s.type === 'order') {
          if (dataSeries.length === 3) {
            let dataIndex = 0;
            timeLine
              .map(([time, index]) => {
                let volume = 0;
                let tradeValue = 0;
                let totalVolume = 0;
                for (; dataIndex <= index; dataIndex++) {
                  totalVolume += parseFloat(dataSeries[2]![dataIndex]);
                  tradeValue += parseFloat(dataSeries[2]![dataIndex]) * parseFloat(dataSeries[1]![dataIndex]);
                  const tempVolume = parseFloat(dataSeries[2]![dataIndex]);
                  const orderDirection = dataSeries[0]![index];
                  if (orderDirection === 'OPEN_LONG' || orderDirection === 'CLOSE_SHORT') {
                    volume += tempVolume;
                  } else {
                    volume -= tempVolume;
                  }
                }
                return {
                  time: time as Time,
                  volume,
                  tradePrice: tradeValue / totalVolume,
                  orderDirection: volume > 0 ? 'OPEN_LONG' : 'OPEN_SHORT',
                };
              })
              .filter((x) => !!x.time && !isNaN(x.tradePrice) && !!x.orderDirection && !isNaN(x.volume))
              .forEach((item) => displayDataList.push(item));
          }
        }

        return displayDataList;
      });
    });
  }, [data, view]);
  const displayData = useMemo(() => {
    if (totalDisplayData && totalTimeLine) {
      return totalDisplayData.map((paneDate) =>
        paneDate.map((seriesData) =>
          seriesData?.filter((data) => Number(data.time) >= startTime && Number(data.time) <= endTime),
        ),
      );
    }
  }, [totalDisplayData, totalTimeLine, viewStartIndex, startTime, endTime]);

  useEffect(() => {
    if (!displayData || !chartRef.current) return;
    const markerList: SeriesMarker<unknown>[] = [];
    view.panes.forEach((pane, paneIndex) => {
      pane.series.forEach((s, seriesIndex) => {
        const data = displayData[paneIndex][seriesIndex] ?? [];
        if (s.type === 'index') {
          if (cursor) {
            const indexData = data[cursor];
            const Index = data[indexData?.value - viewStartIndex];
            if (Index && Number(Index.time) >= startTime && Number(Index.time) <= endTime) {
              markerList.push({
                time: Index.time,
                position: 'aboveBar',
                shape: 'circle',
                color: DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length],
                text: `${s.refs[0].column_name}`,
              });
            }
          }
        }
      });
    });
    if (markerList.length > 0) {
      const lineSeries = chartRef.current.addSeries(LineSeries);
      lineSeries.setData([]);
      const lines = markerList.map((marker) => {
        const vertLine = new VertLine(chartRef.current!, lineSeries, marker.time as Time, {
          showLabel: true,
          labelText: marker.text,
          color: marker.color,
          width: 1,
        });
        lineSeries.attachPrimitive(vertLine);
        return vertLine;
      });
      return () => {
        lines.forEach((line) => lineSeries.detachPrimitive(line));
      };
    }
  }, [cursor, displayData, view, viewStartIndex]);

  useEffect(() => {
    if (!displayData || !domRef.current || !view) return;
    const handler = (param: MouseEventParams<Time>) => {
      if (param.logical) setCursor(param.logical);
      UpdateLegendFuncQueue.forEach((fn) => fn(param));
    };
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current.unsubscribeCrosshairMove(handler);
      chartRef.current = null;
    }
    const chart = createChart(domRef.current, darkMode ? DarkModeChartOption : ChartOption);
    chartRef.current = chart;
    chart.subscribeCrosshairMove(handler);
    view.panes.forEach((pane, paneIndex) => {
      pane.series.forEach((s, seriesIndex) => {
        const data = displayData[paneIndex][seriesIndex] ?? [];
        if (s.type === 'line') {
          const lineSeries = chart.addSeries(
            LineSeries,
            {
              color: DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length],
              lineWidth: 2,
            },
            paneIndex,
          );
          lineSeries.setData(data);
        }
        if (s.type === 'hist') {
          const histogramSeries = chart.addSeries(
            HistogramSeries,
            {
              color: DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length],
            },
            paneIndex,
          );
          histogramSeries.setData(data);
        }
        if (s.type === 'ohlc') {
          const candlestickSeries = chart.addSeries(CandlestickSeries, candlestickOption, paneIndex);
          candlestickSeries.setData(data);
        }
        if (s.type === 'order') {
          const lineSeries = chart.addSeries(
            LineSeries,
            {
              color: 'red',
              lineWidth: 3,
            },
            paneIndex,
          );
          lineSeries.setData(data.map((item) => ({ time: item.time, value: item.tradePrice })));
          const markers = data.map((item) => ({
            time: item.time,
            position: 'aboveBar' as const,
            color: item.orderDirection?.includes('LONG') ? 'green' : 'red',
            shape: item.orderDirection?.includes('LONG') ? ('arrowUp' as const) : ('arrowDown' as const),
            text: item.volume !== 0 ? `P: ${item.tradePrice} | Vol: ${item.volume}` : 'T',
            price: item.tradePrice || 0,
          }));
          const seriesMarkers = createSeriesMarkers(lineSeries, markers);
        }
      });
      const currentPane = chart.panes()[paneIndex];
      waitForPaneElement(currentPane).then((container) => {
        container.setAttribute('style', 'position:relative');
        const legend = document.createElement('div');
        legend.setAttribute(
          'style',
          `position: absolute; left: 12px; top: 0px; z-index: 1; font-size: 14px; font-family: sans-serif; line-height: 18px; font-weight: 300;`,
        );
        container.appendChild(legend);
        pane.series.forEach((s, seriesIndex) => {
          const data = displayData[paneIndex][seriesIndex] ?? [];
          const firstRow = document.createElement('div');
          firstRow.style.fontSize = '14px';
          firstRow.style.fontWeight = '400';
          if (s.type === 'line' || s.type === 'hist' || s.type === 'index') {
            legend.appendChild(firstRow);
            firstRow.style.color =
              DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length];
            UpdateLegendFuncQueue.push((param: MouseEventParams<Time>) => {
              if (!param || !param.logical) return;
              firstRow.innerHTML = `${s.refs[0]?.column_name} : ${
                data[param.logical] ? data[param.logical].value : ''
              }`;
            });
          }
          if (s.type === 'ohlc') {
            legend.appendChild(firstRow);
            UpdateLegendFuncQueue.push((param: MouseEventParams<Time>) => {
              if (!param || !param.logical) return;
              firstRow.innerHTML = data[param.logical]
                ? `O:${data[param.logical].open} H:${data[param.logical].high} L:${
                    data[param.logical].low
                  } C:${data[param.logical].close}`
                : '';
            });
          }
        });
      });
    });

    const el = domRef.current;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        chart.resize(entry.contentRect.width, entry.contentRect.height);
      });
    });
    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, [view, displayData, darkMode]);

  return (
    <Space vertical align="start" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Space>
        {props.topSlot}
        {totalItems > PAGE_SIZE && (
          <Slider
            key={totalItems}
            style={{ width: 200 }}
            showBoundary={false}
            min={0}
            max={Math.max(0, totalItems - PAGE_SIZE)}
            step={1}
            tipFormatter={(v) => {
              return formatTime(Number(totalTimeLine?.[v as number]));
            }}
            onChange={(v) => {
              sliderValue$.next(v as number);
            }}
          />
        )}
        {formatTime(startTime * 1000)}-{formatTime(endTime * 1000)}
        -- Cursor: {(cursor ?? 0) + viewStartIndex}
      </Space>
      <div style={{ width: '100%', height: '100%', flexGrow: 1 }} ref={domRef} />
    </Space>
  );
});
