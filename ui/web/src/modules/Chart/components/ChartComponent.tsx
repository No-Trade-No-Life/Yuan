import { IconClose } from '@douyinfe/semi-icons';
import { Slider, Space } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/utils';
import {
  ChartOptions,
  ColorType,
  createChart,
  CrosshairMode,
  DeepPartial,
  IChartApi,
  MouseEventParams,
  Time,
} from 'lightweight-charts';
import { useObservable, useObservableRef, useObservableState } from 'observable-hooks';
import { memo, ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { debounceTime, Subject } from 'rxjs';
import { Button } from '../../Interactive';
import { ErrorBoundary } from '../../Pages';
import { useIsDarkMode } from '../../Workbench';
import { customSeries } from './CustomSeries';
import { ILoadedData, ITimeSeriesChartConfig } from './model';
import { resolveDataRefToDataArray, resolveDataRefToTimeArray } from './resolveDataRef';
import './TimeSeriesChart.css';
import { useLegendContainers } from './useLegendContainers';

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
  crosshair: {
    mode: CrosshairMode.Normal, // 关键：Normal 表示跟随鼠标像素
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
  crosshair: {
    mode: CrosshairMode.Normal, // 关键：Normal 表示跟随鼠标像素
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

interface Props {
  view?: ITimeSeriesChartConfig['views'][0];
  onViewChange: (newView: ITimeSeriesChartConfig['views'][0]) => Promise<void>;
  topSlot?: ReactNode;
  data?: ILoadedData[];
}

const mergeTimeLine = (
  timeLine: [time: number, dataIndex: number][],
  mainTimeLine: number[],
): [time: number, dataIndex: number][] => {
  const result: [time: number, dataIndex: number][] = [];
  let timeLineIndex = 0;

  for (let mainTimeLineIndex = 1; mainTimeLineIndex < mainTimeLine.length; mainTimeLineIndex++) {
    const nextMainTime = mainTimeLine[mainTimeLineIndex];
    const currentMainTime = mainTimeLine[mainTimeLineIndex - 1];

    for (; timeLineIndex < timeLine.length; timeLineIndex++) {
      const [currentTime, dataIndex] = timeLine[timeLineIndex];
      const [nextTime] = timeLine[timeLineIndex + 1] ?? [];
      if (currentTime > nextMainTime) break;
      if (timeLineIndex === timeLine.length - 1) {
        result.push([currentMainTime, dataIndex]);
      } else if (nextTime > nextMainTime) {
        result.push([currentMainTime, dataIndex]);
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
  const [, cursor$] = useObservableRef<number | undefined>();
  const cursor = useObservableState(cursor$);

  const [, sliderValue$] = useObservableRef(0);
  const viewStartIndex = useObservableState(
    useObservable(() => sliderValue$.pipe(debounceTime(100)), []),
    0,
  );

  const [domRef, dom$] = useObservableRef<HTMLDivElement | null>(null);

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

  const totalTimeLine = view ? resolveDataRefToDataArray(data || [], view.time_ref) : undefined;

  const totalItems = totalTimeLine?.length ?? 0;
  // 自动调整 slider 的位置到最右侧
  useEffect(() => {
    sliderValue$.next(Math.max(0, totalItems - PAGE_SIZE));
  }, [view, data, totalItems]);

  const startIndex = viewStartIndex;
  const endIndex = Math.min(totalItems, viewStartIndex + PAGE_SIZE);
  const endTime = ~~(parseFloat(totalTimeLine?.[endIndex - 1]) / 1000);
  const startTime = ~~(parseFloat(totalTimeLine?.[startIndex]) / 1000);

  const mainTimeLine = (totalTimeLine ?? [])
    .map((t) => ~~(parseFloat(t) / 1000))
    ?.filter((t) => t >= startTime && t <= endTime);

  // 同步鼠标位置到 cursor 状态
  useEffect(() => {
    if (chart) {
      const handler = (param: MouseEventParams<Time>) => {
        if (param.logical !== undefined && param.logical !== null) cursor$.next(param.logical);
      };
      chart.subscribeCrosshairMove(handler);
      return () => {
        chart.unsubscribeCrosshairMove(handler);
      };
    }
  }, [chart]);

  // 管理 panes / series 的创建和销毁
  useEffect(() => {
    if (!data || !chart || !view || startTime >= endTime || !totalTimeLine) return;
    const dispose$ = new Subject<void>();
    view.panes.forEach((pane, paneIndex) => {
      pane.series.forEach((s, seriesIndex) => {
        if (s.refs.length < 1) return;

        const _timeLine: [number, number][] | undefined = resolveDataRefToTimeArray(data, s.refs[0])
          ?.map((t, index) => [~~(parseFloat(t) / 1000), index] as [time: number, dataIndex: number])
          ?.filter(([t]) => t >= startTime && t <= endTime);

        if (!_timeLine) return; // 无法找到 series 对应的时间序列 (无法确定 data 自身每个点的时间)
        // 若ref与view timeline不一致则对其归并
        const timeLine =
          s.refs[0].data_index !== view.time_ref.data_index
            ? mergeTimeLine(_timeLine, mainTimeLine)
            : _timeLine;

        const dataSeries = s.refs
          .map((ref) => resolveDataRefToDataArray(data, ref))
          .filter((x): x is Exclude<typeof x, undefined | null> => !!x);

        // 根据不同的 series type 创建不同的图表逻辑 (可拓展点)
        const seriesComponent = customSeries.find((cs) => cs.type === s.type);
        if (seriesComponent) {
          try {
            seriesComponent.addSeries({
              chart,
              paneIndex,
              seriesIndex,
              timeLine,
              dataSeries,
              cursor$,
              viewStartIndex,
              seriesConfig: s,
              dispose$,
            });
          } catch (e) {}
          return;
        }
      });
    });

    // 管理 pane 高度比例
    const panes = chart.panes();
    panes.forEach((pane, index) => {
      pane.setStretchFactor(view.panes[index].height_weight || 1);
    });

    return () => {
      dispose$.next();
      chart.panes().forEach((pane) => {
        pane.getSeries().forEach((s) => {
          chart.removeSeries(s);
        });
      });
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

  const legendContainers = useLegendContainers(dom$);

  // 根据 cursor, viewStartIndex, visibleLogicalRange 来自动翻页 (待完善)
  // useObservableState(
  //   useObservable(
  //     pipe(
  //       switchMap(([totalItems]) =>
  //         chart$.pipe(
  //           switchMap((chart) => {
  //             if (!chart) return EMPTY;
  //             return new Observable<LogicalRange | null>((sub) => {
  //               const handler: LogicalRangeChangeEventHandler = (t) => {
  //                 sub.next(t);
  //               };
  //               chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
  //               return () => {
  //                 chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
  //               };
  //             });
  //           }),
  //           debounceTime(1000),
  //           tap((t) => {
  //             const cursor = cursor$.value || 0;
  //             const STEP = 100;
  //             console.info('timeScale change', t, sliderValue$.value);
  //             if (t) {
  //               if (t.from < 0 && cursor < 0 && sliderValue$.value > 0) {
  //                 const nextV = Math.max(0, sliderValue$.value - STEP);
  //                 console.info('timeScale change, move left', nextV, sliderValue$.value, '?');
  //                 sliderValue$.next(nextV);
  //                 // chart$.value?.timeScale().setVisibleLogicalRange({ from: 0, to: t.to - t.from });
  //               }
  //               if (t.to > PAGE_SIZE && cursor > PAGE_SIZE && sliderValue$.value < totalItems - PAGE_SIZE) {
  //                 const nextV = Math.min(totalItems - PAGE_SIZE, Math.ceil(sliderValue$.value + STEP));
  //                 console.info('timeScale change, move right', nextV, sliderValue$.value, '?');
  //                 sliderValue$.next(nextV);
  //               }
  //             }
  //           }),
  //         ),
  //       ),
  //     ),
  //     [totalItems],
  //   ),
  // );

  return (
    <Space vertical align="start" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Space wrap style={{ width: '100%' }}>
        {props.topSlot}
        {totalItems > PAGE_SIZE && (
          <Slider
            key={totalItems + viewStartIndex}
            style={{ width: 200 }}
            showBoundary={false}
            min={0}
            max={Math.max(0, totalItems - PAGE_SIZE)}
            step={1}
            defaultValue={viewStartIndex}
            tipFormatter={(v) => {
              return formatTime(Number(totalTimeLine?.[v as number]));
            }}
            onChange={(v) => {
              sliderValue$.next(v as number);
            }}
          />
        )}
        {formatTime(startTime * 1000)}-{formatTime(endTime * 1000)}
        -- Cursor: {(cursor ?? 0) + viewStartIndex} ({cursor ?? 0} + {viewStartIndex})
      </Space>
      <div key="canvas" style={{ width: '100%', flex: 1, overflow: 'hidden' }} ref={domRef} />
      <>
        {view?.panes.map((pane, paneIndex) => {
          const legendDom = legendContainers?.[paneIndex];

          return legendDom
            ? createPortal(
                <Space vertical align="start" spacing={0} key={paneIndex}>
                  {pane.series.map((s, seriesIndex) => {
                    const cursorIndex = cursor! + viewStartIndex;
                    const globalDataSeries = s.refs
                      .map((ref) => resolveDataRefToDataArray(data || [], ref))
                      .filter((x): x is Exclude<typeof x, null | undefined> => !!x);

                    const LegendComponent = customSeries.find((cs) => cs.type === s.type)?.Legend;

                    return (
                      <Space style={{ fontSize: 14, fontWeight: 400 }} key={`${paneIndex}/${seriesIndex}`}>
                        {LegendComponent && (
                          <ErrorBoundary>
                            <LegendComponent
                              globalDataSeries={globalDataSeries}
                              seriesConfig={s}
                              seriesIndex={seriesIndex}
                              cursorIndex={cursorIndex}
                            />
                          </ErrorBoundary>
                        )}
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
                  })}
                </Space>,
                legendDom,
                paneIndex.toString(),
              )
            : null;
        })}
      </>
    </Space>
  );
});
