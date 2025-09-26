import {
  CandlestickSeries,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  Time,
} from 'lightweight-charts';
import { Observable, switchMap, takeUntil } from 'rxjs';
import { VertLine } from '../Plugins/VerticalLine';
import { ICustomSeries } from './model';

export const DEFAULT_SINGLE_COLOR_SCHEME: string[] = [
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

const SimpleKeyValueLegend: ICustomSeries['Legend'] = ({
  globalDataSeries,
  seriesIndex,
  seriesConfig,
  cursorIndex,
}) => {
  if (globalDataSeries.length < 1) return null;

  const name = seriesConfig.name || seriesConfig.refs[0]?.column_name;

  return (
    <div
      style={{
        color: DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length],
      }}
    >
      {name}: {globalDataSeries[0][cursorIndex]}
    </div>
  );
};

export const customSeries: ICustomSeries[] = [
  {
    type: 'line',
    addSeries: ({ chart, paneIndex, seriesIndex, dataSeries, timeLine }) => {
      if (dataSeries.length < 1) return;
      const lineSeries = chart.addSeries(
        LineSeries,
        {
          color: DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length],
          lineWidth: 2,
          priceLineVisible: false,
        },
        paneIndex,
      );
      lineSeries.setData(
        timeLine.map(([time, index]) => {
          return {
            time: time as Time,
            value: parseFloat(dataSeries[0]![index]),
          };
        }),
      );
    },
    Legend: SimpleKeyValueLegend,
  },
  {
    type: 'hist',
    addSeries: ({ chart, paneIndex, seriesIndex, timeLine, dataSeries }) => {
      if (dataSeries.length < 1) return;
      const histogramSeries = chart.addSeries(
        HistogramSeries,
        {
          color: DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length],
          priceLineVisible: false,
        },
        paneIndex,
      );
      histogramSeries.setData(
        timeLine.map(([time, index]) => {
          return {
            time: time as Time,
            value: parseFloat(dataSeries[0]![index]),
          };
        }),
      );
    },
    Legend: SimpleKeyValueLegend,
  },
  {
    type: 'ohlc',
    addSeries: ({ chart, paneIndex, seriesIndex, dataSeries, timeLine }) => {
      if (dataSeries.length < 4) return;
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
      const displayDataList: { time: Time; open: number; high: number; low: number; close: number }[] = [];
      timeLine.forEach(([time, index]) => {
        const x = {
          time: time as Time,
          open: parseFloat(dataSeries[0]![index]),
          high: parseFloat(dataSeries[1]![index]),
          low: parseFloat(dataSeries[2]![index]),
          close: parseFloat(dataSeries[3]![index]),
        };
        if (!!x.time && !isNaN(x.open) && !isNaN(x.high) && !isNaN(x.low) && !isNaN(x.close)) {
          displayDataList.push(x);
        }
      });

      candlestickSeries.setData(displayDataList);
    },
    Legend: ({ globalDataSeries, cursorIndex, seriesConfig }) => {
      if (globalDataSeries.length < 4) return null;
      const open = globalDataSeries[0][cursorIndex];
      const high = globalDataSeries[1][cursorIndex];
      const low = globalDataSeries[2][cursorIndex];
      const close = globalDataSeries[3][cursorIndex];
      const ratio = (close / (globalDataSeries[3][cursorIndex - 1] ?? open) - 1) * 100;
      const isBullish = close > open;
      const isBearish = close < open;
      const ratioText = `${ratio > 0 ? '+' : ''}${+ratio.toFixed(2)}%`;
      return (
        <div style={{ color: isBullish ? '#26a69a' : isBearish ? '#ef5350' : undefined }}>
          {seriesConfig.name} 开: {open} 高: {high} 低: {low} 收: {close} ({ratioText})
        </div>
      );
    },
  },
  {
    type: 'order',
    addSeries: ({ chart, paneIndex, seriesIndex, timeLine, dataSeries }) => {
      if (dataSeries.length < 3) return;
      const seriesData: Array<{ time: Time; value: number }> = [];
      const markerData: {
        time: Time;
        position: 'aboveBar';
        color: string;
        shape: 'arrowUp' | 'arrowDown';
        text: string;
        price: number;
      }[] = [];

      let dataIndex = timeLine[0]?.[1] || 0;
      timeLine.forEach(([_time, index]) => {
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

        const orderDirection = volume > 0 ? 'OPEN_LONG' : 'OPEN_SHORT';
        const tradePrice = tradeValue / totalVolume;
        const time = _time as Time;
        if (!!time && !isNaN(tradePrice) && !!orderDirection && !isNaN(volume)) {
          seriesData.push({ time, value: tradeValue / totalVolume });
          markerData.push({
            time,
            position: 'aboveBar' as const,
            color: orderDirection?.includes('LONG') ? 'green' : 'red',
            shape: orderDirection?.includes('LONG') ? ('arrowUp' as const) : ('arrowDown' as const),
            text: volume !== 0 ? `P: ${tradePrice} | Vol: ${volume}` : 'T',
            price: tradePrice || 0,
          });
        }
      });

      const lineSeries = chart.addSeries(
        LineSeries,
        {
          color: 'red',
          lineWidth: 3,
          priceLineVisible: false,
        },
        paneIndex,
      );
      lineSeries.setData(seriesData);
      const seriesMarkers = createSeriesMarkers(lineSeries, markerData);
    },
    Legend: ({ seriesConfig }) => {
      return <div>{seriesConfig.name || '订单'}</div>;
    },
  },
  {
    type: 'index',
    addSeries: ({
      chart,
      paneIndex,
      seriesIndex,
      seriesConfig,
      dataSeries,
      timeLine,
      cursor$,
      viewStartIndex,
      dispose$,
    }) => {
      if (dataSeries.length < 1) return;
      const lineSeries = chart.addSeries(LineSeries, { priceLineVisible: false });
      lineSeries.setData([]);

      cursor$
        .pipe(
          takeUntil(dispose$),
          switchMap(
            (cursor) =>
              new Observable((sub) => {
                if (cursor === undefined) return;

                if (!timeLine[cursor]) return;
                const [time, index] = timeLine[cursor];

                const indexData = parseFloat(dataSeries[0][index]);
                const Index = timeLine[indexData - viewStartIndex];

                if (!Index) return;
                if (Index[0] < timeLine[0][0]) return;
                if (Index[0] > timeLine[timeLine.length - 1][0]) return;

                const theTime = Index[0] as Time;

                const vertLine = new VertLine(chart, lineSeries, theTime, {
                  showLabel: true,
                  labelText: `${seriesConfig.refs[0].column_name}`,
                  color: DEFAULT_SINGLE_COLOR_SCHEME[seriesIndex % DEFAULT_SINGLE_COLOR_SCHEME.length],
                  width: 1,
                });
                lineSeries.attachPrimitive(vertLine);
                return () => {
                  lineSeries.detachPrimitive(vertLine);
                };
              }),
          ),
        )
        .subscribe();
    },
    Legend: SimpleKeyValueLegend,
  },
];
