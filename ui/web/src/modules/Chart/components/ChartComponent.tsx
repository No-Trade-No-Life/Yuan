import { memo, useEffect, useMemo, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  LineSeries,
  HistogramSeries,
  Time,
  DeepPartial,
  ChartOptions,
} from 'lightweight-charts';
import { ITimeSeriesChartConfig } from '../../Interactive';
import { formatTime } from '@yuants/utils';

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
    textColor: 'black',
    background: { type: ColorType.Solid, color: 'white' },
    panes: {
      separatorColor: '#f22c3d',
      separatorHoverColor: 'rgba(255, 0, 0, 0.1)',
      // setting this to false will disable the resize of the panes by the user
      enableResize: true,
    },
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

interface Props {
  view: ITimeSeriesChartConfig['views'][0];
  data?: {
    filename: string;
    data_index: number;
    data_length: number;
    time_column_name: string;
    series: Map<string, any[]>;
  }[];
}

export const ChartComponent = memo((props: Props) => {
  const { view, data } = props;

  const domRef = useRef<HTMLDivElement | null>(null);

  const displayData = useMemo(() => {
    if (!view || !data) return null;
    const mainTimeLine = data
      .find((item) => item.data_index === view.time_ref.data_index)
      ?.series.get(view.time_ref.column_name);
    if (!mainTimeLine) return null;

    return view.panes.map((pane) => {
      return pane.series
        .map((s) => {
          if (s.refs.length < 1) return null;
          //找到ref对应的timeline
          const dataItem = data.find((item) => item.data_index === s.refs[0].data_index);
          if (!dataItem) return null;
          const timeLine = dataItem.series.get(dataItem.time_column_name);
          if (!timeLine) return null;
          const displayDataList: {
            time: Time;
            value?: any;
            high?: number;
            open?: number;
            low?: number;
            close?: number;
          }[] = [];

          if (s.type === 'line' || s.type === 'bar' || s.type === 'index') {
            // 通过data_index column_name找到数据，并完成映射为图表需要的结构
            const dataSeries = data
              .find((item) => item.data_index === s.refs[0].data_index)
              ?.series.get(s.refs[0].column_name);
            if (dataSeries) {
              timeLine.forEach((time, index) => {
                displayDataList.push({
                  time: ~~(new Date(formatTime(Number(time))).getTime() / 1000) as Time,
                  value: Number(dataSeries[index]),
                });
              });
            }
          }
          if (s.type === 'ohlc') {
            const dataSeries = s.refs
              .map((ref) =>
                data.find((item) => item.data_index === ref.data_index)?.series.get(ref.column_name),
              )
              .filter((x) => !!x);
            if (dataSeries.length === 4) {
              timeLine
                .map((time, index) => ({
                  time: ~~(new Date(formatTime(Number(time))).getTime() / 1000) as Time,
                  open: Number(dataSeries[0]![index]),
                  high: Number(dataSeries[1]![index]),
                  low: Number(dataSeries[2]![index]),
                  close: Number(dataSeries[3]![index]),
                }))
                .filter(
                  (x) => !!x.time && !isNaN(x.open) && !isNaN(x.high) && !isNaN(x.low) && !isNaN(x.close),
                )
                .forEach((item) => displayDataList.push(item));
            }
          }
          // 若ref timeline与main timeline 不一致，则需要对齐
          if (s.refs[0].data_index !== view.time_ref.data_index) {
            const result: {
              time: Time;
              value?: any;
              high?: number;
              open?: number;
              low?: number;
              close?: number;
            }[] = [];
            const newDisplayDataList = [...displayDataList];
            const newMainTimeLine = [...mainTimeLine];
            while (newDisplayDataList.length > 0 && newMainTimeLine.length > 0) {
              const mainTime = newMainTimeLine.shift();
              let tempDataItem = newDisplayDataList[0];
              while (newDisplayDataList.length > 0) {
                const dataItem = newDisplayDataList[0];
                if (
                  new Date(Number(dataItem.time) * 1000).getTime() <=
                  new Date(formatTime(Number(mainTime))).getTime()
                ) {
                  tempDataItem = {
                    ...dataItem,
                    time: ~~(new Date(formatTime(Number(mainTime))).getTime() / 1000) as Time,
                  };
                  newDisplayDataList.shift();
                } else {
                  break;
                }
              }
              result.push(tempDataItem);
            }
            result.push(...newDisplayDataList);
            return result;
          }
          return displayDataList;
        })
        .filter((x) => !!x);
    });
  }, [data, view]);
  console.log({ displayData });
  useEffect(() => {
    if (!domRef.current || !view || !displayData) return;
    const chart = createChart(domRef.current, ChartOption);
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
        if (s.type === 'bar') {
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
      });
    });

    const el = domRef.current;
    if (el) {
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

    const candlesPane = chart.panes()[1];
    // candlesPane.getHTMLElement()?.appendChild
    // console.log({ candlesPane });
    // candlesPane.moveTo(0);
    // candlesPane.attachPrimitive()
    // // candlesPane.setHeight(150);
    // chart.timeScale().fitContent();
  }, [view, displayData]);

  return <div id="App" style={{ width: '100%', height: '100%' }} ref={domRef} />;
});
