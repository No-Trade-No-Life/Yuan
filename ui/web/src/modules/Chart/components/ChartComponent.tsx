import { Slider, Space } from '@douyinfe/semi-ui';
import { encodePath, formatTime } from '@yuants/utils';
import {
  CandlestickSeries,
  ChartOptions,
  ColorType,
  createChart,
  createSeriesMarkers,
  DeepPartial,
  HistogramSeries,
  IChartApi,
  IPaneApi,
  ISeriesApi,
  LineSeries,
  MouseEventParams,
  SeriesMarker,
  Time,
} from 'lightweight-charts';
import { useObservable, useObservableRef, useObservableState } from 'observable-hooks';
import { memo, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { debounceTime } from 'rxjs';
import { Button, ITimeSeriesChartConfig } from '../../Interactive';
import { useIsDarkMode } from '../../Workbench';
import { VertLine } from '../Plugins/VerticalLine';
import { IconClose } from '@douyinfe/semi-icons';

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

const PAGE_SIZE = 5000;

function waitForPaneElement(pane: IPaneApi<Time>, maxRetries: number = 50): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    let retries = 0;
    function check() {
      const el = pane?.getHTMLElement();
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
  onViewChange: (newView: ITimeSeriesChartConfig['views'][0]) => Promise<void>;
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

const mergeTimeLine = (
  timeLine: [time: number, dataIndex: number][],
  mainTimeLine: number[],
): [time: number, dataIndex: number][] => {
  const result: [time: number, dataIndex: number][] = [];
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

  const legendDomRef = useRef<Map<string, HTMLElement>>(new Map()).current;

  useEffect(() => {
    return () => {
      legendDomRef.clear();
    };
  }, []);

  const [, sliderValue$] = useObservableRef(0);
  const viewStartIndex = useObservableState(
    useObservable(() => sliderValue$.pipe(debounceTime(100)), []),
    0,
  );

  const domRef = useRef<HTMLDivElement | null>(null);

  const [chartRef, chart$] = useObservableRef<IChartApi | null>(null);
  const chart = useObservableState(chart$);

  // 管理 chart 实例的创建和销毁
  useEffect(() => {
    if (!domRef.current) return;
    const chart = createChart(domRef.current, darkMode ? DarkModeChartOption : ChartOption);
    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // 响应暗黑模式
  useEffect(() => {
    if (chart) {
      chart.applyOptions(darkMode ? DarkModeChartOption : ChartOption);
    }
  }, [darkMode, chart]);

  const totalTimeLine = (data || [])
    .find((item) => item.data_index === view.time_ref.data_index)
    ?.series.get(view.time_ref.column_name);

  const totalItems = totalTimeLine?.length ?? 0;

  const startIndex = viewStartIndex;
  const endIndex = Math.min(totalItems, viewStartIndex + PAGE_SIZE);
  const endTime = ~~(parseFloat(totalTimeLine?.[endIndex - 1]) / 1000);
  const startTime = ~~(parseFloat(totalTimeLine?.[startIndex]) / 1000);

  const mainTimeLine = (totalTimeLine ?? [])
    .map((t) => ~~(parseFloat(t) / 1000))
    ?.filter((t) => t >= startTime && t <= endTime);

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
        let timeLine: [time: number, dataIndex: number][] | undefined = dataItem.series
          .get(dataItem.time_column_name)
          ?.map((t, index) => [~~(parseFloat(t) / 1000), index] as [time: number, dataIndex: number]);
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
            return displayDataList;
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
            return displayDataList;
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
            return displayDataList;
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

  // draw index
  useEffect(() => {
    if (!chartRef.current || !data) return;
    const markerList: SeriesMarker<unknown>[] = [];
    view.panes.forEach((pane) => {
      pane.series.forEach((s, seriesIndex) => {
        if (s.type === 'index') {
          const displayData = calculateDisplayData(s);
          if (cursor) {
            const indexData = displayData[cursor];
            const Index = displayData[indexData?.value - viewStartIndex];
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
      const lineSeries = chartRef.current.addSeries(LineSeries, { priceLineVisible: false });
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
  }, [cursor, view, viewStartIndex, data]);

  // 同步鼠标位置到 cursor 状态
  useEffect(() => {
    if (chart) {
      const handler = (param: MouseEventParams<Time>) => {
        if (param.logical !== undefined && param.logical !== null) setCursor(param.logical);
      };
      chart.subscribeCrosshairMove(handler);
      return () => {
        chart.unsubscribeCrosshairMove(handler);
      };
    }
  }, [chart]);

  const calculateDisplayData = (
    s: {
      type: string;
      refs: Array<{
        data_index: number;
        column_name: string;
      }>;
    },
    // timeLine: [time: number, dataIndex: number][],
  ) => {
    if (!data) return [];
    const dataItem = data.find((item) => item.data_index === s.refs[0].data_index);
    if (!dataItem) return [];
    let timeLine: [number, number][] | undefined = dataItem.series
      .get(dataItem.time_column_name)
      ?.map((t, index) => [~~(parseFloat(t) / 1000), index] as [time: number, dataIndex: number])
      ?.filter(([t]) => t >= startTime && t <= endTime);
    if (!timeLine) return [];
    // 若ref与view timeline不一致则归并对其
    if (s.refs[0].data_index !== view.time_ref.data_index) {
      timeLine = mergeTimeLine(timeLine, mainTimeLine);
    }
    const displayDataList: DisplayData[] = [];
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
        return displayDataList;
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
        return displayDataList;
      }
    }
    if (s.type === 'order') {
      if (dataSeries.length === 3) {
        let dataIndex = timeLine[0]?.[1] || 0;
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
        return displayDataList;
      }
    }
    return displayDataList;
  };

  // 管理 panes / series 的创建和销毁
  useEffect(() => {
    if (!data || !chart || !view || startTime >= endTime || !totalTimeLine) return;
    const seriesList: ISeriesApi<any>[] = [];
    view.panes.forEach((pane, paneIndex) => {
      pane.series.forEach((s, seriesIndex) => {
        if (s.refs.length < 1) return;
        const displayData = calculateDisplayData(s);
        if (s.type === 'line') {
          const lineSeries = chart.addSeries(
            LineSeries,
            {
              color: DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length],
              lineWidth: 2,
              priceLineVisible: false,
            },
            paneIndex,
          );
          lineSeries.setData(displayData);
          seriesList.push(lineSeries);
        }
        if (s.type === 'hist') {
          const histogramSeries = chart.addSeries(
            HistogramSeries,
            {
              color: DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length],
              priceLineVisible: false,
            },
            paneIndex,
          );
          histogramSeries.setData(displayData);
          seriesList.push(histogramSeries);
        }
        if (s.type === 'ohlc') {
          const candlestickSeries = chart.addSeries(
            CandlestickSeries,
            {
              upColor: '#26a69a',
              downColor: '#ef5350',
              borderVisible: false,
              wickUpColor: '#26a69a',
              wickDownColor: '#ef5350',
              priceLineVisible: false,
            },
            paneIndex,
          );
          candlestickSeries.setData(displayData);
          seriesList.push(candlestickSeries);
        }
        if (s.type === 'order') {
          const lineSeries = chart.addSeries(
            LineSeries,
            {
              color: 'red',
              lineWidth: 3,
              priceLineVisible: false,
            },
            paneIndex,
          );
          lineSeries.setData(displayData.map((item) => ({ time: item.time, value: item.tradePrice })));
          const markers = displayData.map((item) => ({
            time: item.time,
            position: 'aboveBar' as const,
            color: item.orderDirection?.includes('LONG') ? 'green' : 'red',
            shape: item.orderDirection?.includes('LONG') ? ('arrowUp' as const) : ('arrowDown' as const),
            text: item.volume !== 0 ? `P: ${item.tradePrice} | Vol: ${item.volume}` : 'T',
            price: item.tradePrice || 0,
          }));
          const seriesMarkers = createSeriesMarkers(lineSeries, markers);
          seriesList.push(lineSeries);
        }
      });
      const currentPane = chart.panes()[paneIndex];
      waitForPaneElement(currentPane).then((container) => {
        container.setAttribute('style', 'position:relative');
        const legend = document.createElement('div');
        legend.setAttribute(
          'style',
          `position: absolute; left: 12px; top: 0px; z-index: 10; font-size: 14px; font-family: sans-serif; line-height: 18px; font-weight: 300;`,
        );
        container.appendChild(legend);
        pane.series.forEach((s, seriesIndex) => {
          const div = document.createElement('div');
          legendDomRef.set(encodePath(paneIndex, seriesIndex), div);
          legend.appendChild(div);
        });
      });
    });
    return () => {
      seriesList.forEach((s) => {
        chart.removeSeries(s);
      });
      for (let i = chart.panes().length - 1; i >= 0; i--) {
        chart.removePane(i);
      }
    };
  }, [chart, view, startTime, endTime, data]);

  // Resize chart on container resize
  useEffect(() => {
    if (chart) {
      const el = chart.chartElement().parentElement;
      if (!el) return;
      const observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          chart.resize(entry.contentRect.width, entry.contentRect.height);
        });
      });
      observer.observe(el);
      return () => {
        observer.unobserve(el);
      };
    }
  }, [chart]);

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
      <div key="canvas" style={{ width: '100%', flex: 1, overflow: 'hidden' }} ref={domRef} />
      <>
        {view.panes.flatMap((pane, paneIndex) =>
          pane.series.map((s, seriesIndex) => {
            const key = encodePath(paneIndex, seriesIndex);
            const legendDom = legendDomRef.get(key);

            function renderTitle(): ReactNode {
              if (!data) return null;

              if (s.type === 'line' || s.type === 'hist' || s.type === 'index') {
                const dataRef = s.refs[0];
                if (!dataRef) return null;
                const dataItem = data.find((item) => item.data_index === dataRef.data_index);
                if (!dataItem) return null;
                const dataArray = dataItem.series.get(dataRef.column_name);
                if (!dataArray) return null;
                return (
                  <div
                    style={{
                      color: DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length],
                    }}
                  >
                    {s.refs[0]?.column_name}: {dataArray[cursor! + viewStartIndex]}
                  </div>
                );
              }

              if (s.type === 'ohlc') {
                const dataRefOpen = s.refs[0];
                const dataRefHigh = s.refs[1];
                const dataRefLow = s.refs[2];
                const dataRefClose = s.refs[3];
                if (!dataRefOpen || !dataRefHigh || !dataRefLow || !dataRefClose) return null;
                const dataItemOpen = data.find((item) => item.data_index === dataRefOpen.data_index);
                const dataItemHigh = data.find((item) => item.data_index === dataRefHigh.data_index);
                const dataItemLow = data.find((item) => item.data_index === dataRefLow.data_index);
                const dataItemClose = data.find((item) => item.data_index === dataRefClose.data_index);
                if (!dataItemOpen || !dataItemHigh || !dataItemLow || !dataItemClose) return null;
                const dataArrayOpen = dataItemOpen.series.get(dataRefOpen.column_name);
                const dataArrayHigh = dataItemHigh.series.get(dataRefHigh.column_name);
                const dataArrayLow = dataItemLow.series.get(dataRefLow.column_name);
                const dataArrayClose = dataItemClose.series.get(dataRefClose.column_name);
                if (!dataArrayOpen || !dataArrayHigh || !dataArrayLow || !dataArrayClose) return null;
                return (
                  <div>
                    O: {dataArrayOpen[cursor! + viewStartIndex]} H: {dataArrayHigh[cursor! + viewStartIndex]}{' '}
                    L: {dataArrayLow[cursor! + viewStartIndex]} C: {dataArrayClose[cursor! + viewStartIndex]}
                  </div>
                );
              }

              if (s.type === 'order') {
                return <div>订单</div>;
              }

              return null;
            }

            const render = () => {
              const title = renderTitle();
              return (
                <Space style={{ fontSize: 14, fontWeight: 400 }}>
                  {title}
                  <Button
                    size="small"
                    theme="borderless"
                    icon={<IconClose />}
                    onClick={async () => {
                      const newView = structuredClone(view);
                      newView.panes[paneIndex].series.splice(seriesIndex, 1);
                      if (newView.panes[paneIndex].series.length === 0) {
                        newView.panes.splice(paneIndex, 1);
                      }
                      await props.onViewChange(newView);
                    }}
                  />
                </Space>
              );
            };

            return legendDom ? createPortal(render(), legendDom, key) : null;
          }),
        )}
      </>
    </Space>
  );
});
