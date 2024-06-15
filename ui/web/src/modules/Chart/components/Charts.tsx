import { IOrder, IPeriod } from '@yuants/data-model';
import { format } from 'date-fns';
import {
  ChartOptions,
  CrosshairMode,
  DeepPartial,
  IChartApi,
  ISeriesApi,
  LineData,
  MouseEventParams,
  SeriesMarker,
  Time,
  TimeRange,
  UTCTimestamp,
  createChart,
} from 'lightweight-charts/dist/lightweight-charts.esm.development.js'; // must use development version to dynamically inject API
import React, { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BehaviorSubject } from 'rxjs';

const upColor = 'rgba(255,82,82, 0.8)';
const downColor = 'rgba(0, 150, 136, 0.8)';

const chartDefaultOptions: DeepPartial<ChartOptions> = {
  layout: {
    backgroundColor: '#000000',
    textColor: 'rgba(255, 255, 255, 0.9)',
  },
  grid: {
    vertLines: {
      color: 'rgba(197, 203, 206, 0.5)',
    },
    horzLines: {
      color: 'rgba(197, 203, 206, 0.5)',
    },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
  },
  rightPriceScale: {
    borderColor: 'rgba(197, 203, 206, 0.8)',
  },
  timeScale: {
    borderColor: 'rgba(197, 203, 206, 0.8)',
  },
  localization: {
    timeFormatter: (time: UTCTimestamp) => format(time * 1000, 'yyyy-MM-dd HH:mm:ss eee'),
  },
};
const ChartApiContext = createContext<IChartApi | null>(null);

// ISSUE: This is Lightweight Chart unmerged API
// TODO: This API is merged and publish in lightweight-charts 4.1, re-eval it.
// Reference: https://github.com/tradingview/lightweight-charts/issues/438
let injected = false;
const injectApiToChart = (chart: any) => {
  if (injected) {
    return;
  }
  const paneWidget = chart._private__chartWidget._internal_paneWidgets()[0];
  const model = paneWidget._private__model();
  // Object.assign(globalThis, { chart, paneWidget, model });
  const mobileTouch = false;
  const isMobile = false;
  const ChartApi = chart.constructor;
  ChartApi.prototype.setCrossHairXY = function (x: number, y: number, visible: boolean) {
    this._private__chartWidget._internal_paneWidgets()[0].setCrossHair(x, y, visible);
  };
  const PaneWidget = paneWidget.constructor;
  const Model = model.constructor;
  PaneWidget.prototype._setCrosshairPositionNoFire = function (x: any, y: any): void {
    this._private__model().setAndSaveCurrentPositionFire(
      this._private__correctXCoord(x),
      this._private__correctYCoord(y),
      false,
      this._private__state,
    );
  };
  PaneWidget.prototype.setCrossHair = function (xx: number, yy: number, visible: boolean): void {
    if (!this._private__state) {
      return;
    }
    if (visible) {
      const x = xx;
      const y = yy;

      if (!mobileTouch) {
        this._setCrosshairPositionNoFire(x, y);
      }
    } else {
      this._private__state._internal_model()._internal_setHoveredSource(null);
      if (!isMobile) {
        this._private__clearCrosshairPosition();
      }
    }
  };
  Model.prototype.setAndSaveCurrentPositionFire = function (x: any, y: any, fire: boolean, pane: any): void {
    this._private__crosshair._internal_saveOriginCoord(x, y);
    let price = NaN;
    let index = this._private__timeScale._internal_coordinateToIndex(x);

    const visibleBars = this._private__timeScale._internal_visibleStrictRange();
    if (visibleBars !== null) {
      index = Math.min(Math.max(visibleBars._internal_left(), index), visibleBars._internal_right());
    }

    const priceScale = pane._internal_defaultPriceScale();
    const firstValue = priceScale._internal_firstValue();
    if (firstValue !== null) {
      price = priceScale._internal_coordinateToPrice(y, firstValue);
    }
    price = this._private__magnet._internal_align(price, index, pane);

    this._private__crosshair._internal_setPosition(index, price, pane);
    this._internal_cursorUpdate();
    if (fire) {
      this._private__crosshairMoved._internal_fire(this._private__crosshair._internal_appliedIndex(), {
        x,
        y,
      });
    }
  };
  injected = true;
};

export const Chart = React.memo((props: { children: ReactNode }) => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const [chartApi, setChartApi] = useState(null as IChartApi | null);
  const group = useContext(ChartGroupApiContext);

  const chartApi$ = useMemo(() => new BehaviorSubject<IChartApi | null>(null), []);

  // create chart api
  useEffect(() => {
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = ''; // clear HTML
      const chart = createChart(
        chartContainerRef.current,
        Object.assign({}, chartDefaultOptions, {
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        }),
      );
      injectApiToChart(chart);
      setChartApi(chart);
      chartApi$.next(chart);
    }
  }, []);

  // auto resize chart
  useEffect(() => {
    const el = chartContainerRef.current;
    if (chartApi && el) {
      const observer = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          chartApi.resize(entry.contentRect.width, entry.contentRect.height);
        });
      });
      observer.observe(el);
      return () => {
        observer.unobserve(el);
      };
    }
  }, [chartApi]);

  // Legend
  useEffect(() => {
    if (chartApi && legendRef.current) {
      const handler = () => {
        const texts: string[] = [];
        const model = (chartApi as any)._private__chartWidget._private__model;
        const crosshair = model._private__crosshair;
        const index = crosshair._private__index;
        // TODO: Emit Event with index
        const serieses = model._private__serieses;
        serieses.forEach((series: any) => {
          const { yuan_title: title, color } = series._private__options;
          const p = series._internal_dataAt(index);
          // console.info('##', p, index, series);
          if (p === undefined || p === null || Number.isNaN(p)) {
            // hide null data
          } else if (typeof p === 'number') {
            texts.push(`<div style="color:${color}">${title}=${p}</div>`);
          } else {
            texts.push(
              `<div style="color:${color}">${title} O=${p.open} H=${p.high} L=${p.low} C=${p.close} #${index}</div>`,
            );
          }
        });
        if (texts.length > 0) {
          legendRef.current!.innerHTML = texts.join(' ');
        }
      };
      (chartApi as any).__updateLegend = handler;
      chartApi.subscribeCrosshairMove(handler);
      return () => {
        delete (chartApi as any).__updateLegend;
        chartApi.unsubscribeCrosshairMove(handler);
      };
    }
  }, [chartApi]);

  // join to ChartGroup
  useEffect(() => {
    if (chartApi && group) {
      group.add(chartApi);
      return () => {
        group.delete(chartApi);
      };
    }
  }, [chartApi]);

  // sync time range among charts in a group.
  useEffect(() => {
    if (chartApi) {
      const timeScaleApi = chartApi.timeScale();
      const handler = (timeRange: TimeRange | null) => {
        if (!timeRange) return;
        if (group) {
          group.forEach((otherChart) => {
            // if (otherChart === chartApi) return;
            try {
              otherChart.timeScale().setVisibleRange(timeRange);
            } catch (e) {
              console.error(e);
            }
          });
        }
      };
      timeScaleApi.subscribeVisibleTimeRangeChange(handler);
      return () => {
        timeScaleApi.unsubscribeVisibleTimeRangeChange(handler);
      };
    }
  }, [chartApi]);

  // Sync Crosshair
  useEffect(() => {
    if (chartApi && group) {
      const handler = (e: MouseEventParams) => {
        // Sync crosshair of charts in one group
        // NOTE: use injected API.
        const { time, point } = e;
        if (time !== undefined) {
          group.forEach((otherChart: IChartApi) => {
            if (otherChart !== chartApi) {
              var xx = otherChart.timeScale().timeToCoordinate(time);
              (otherChart as any).setCrossHairXY(xx, 0, true);
              (otherChart as any).__updateLegend();
            }
          });
        } else if (point !== undefined) {
          group.forEach((otherChart) => {
            if (otherChart !== chartApi) {
              (otherChart as any).setCrossHairXY(point.x, 0, false);
              (otherChart as any).__updateLegend();
            }
          });
        }
      };
      chartApi.subscribeCrosshairMove(handler);
      return () => {
        chartApi.unsubscribeCrosshairMove(handler);
      };
    }
  }, [chartApi]);

  return (
    <ChartApiContext.Provider value={chartApi}>
      <div style={{ position: 'relative' }}>
        <div
          ref={legendRef}
          style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, color: 'white' }}
        ></div>
      </div>
      <div style={{ width: '100%', height: '100%' }} ref={chartContainerRef} />
      {props.children}
    </ChartApiContext.Provider>
  );
});

export const CandlestickSeries = React.memo(
  (props: { title?: string; data: IPeriod[]; children?: React.ReactElement }) => {
    const chartApi = useContext(ChartApiContext);
    const [seriesApi, setSeriesApi] = useState<ISeriesApi<'Candlestick'>>();
    const [volumeSeriesApi, setVolumeSeriesApi] = useState<ISeriesApi<'Histogram'>>();

    useEffect(() => {
      if (chartApi) {
        const precision = 5;
        const sample = props.data[0];
        const series = chartApi.addCandlestickSeries({
          borderVisible: false,
          lastValueVisible: false,
          priceFormat: { type: 'price', precision, minMove: +(0.1 ** precision).toFixed(precision) },
          upColor: upColor,
          downColor: downColor,
          wickUpColor: upColor,
          wickDownColor: downColor,
          borderUpColor: upColor,
          borderDownColor: downColor,
          ...{
            yuan_title:
              props.title || `${sample?.datasource_id} ${sample?.product_id} ${sample?.period_in_sec}`,
          },
        });
        setSeriesApi(series);

        const volumeSeries = chartApi.addHistogramSeries({
          lastValueVisible: false,
          priceFormat: {
            type: 'volume',
          },
          color: 'white',
          priceScaleId: 'volume',
          ...{ yuan_title: 'VOL' },
        });
        chartApi.priceScale('volume').applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });
        setVolumeSeriesApi(volumeSeries);

        return () => {
          chartApi.removeSeries(series);
          setSeriesApi(undefined);
        };
      }
    }, [chartApi, props.title]);

    const candlestickData = useMemo(
      () =>
        props.data.map((period) => ({
          time: (period.timestamp_in_us / 1e6) as UTCTimestamp,
          open: period.open,
          high: period.high,
          low: period.low,
          close: period.close,
        })),
      [props.data],
    );
    const volumeData = useMemo(
      () =>
        props.data.map((period) => ({
          time: (period.timestamp_in_us / 1e6) as UTCTimestamp,
          value: period.volume || 0,
          color: period.close > period.open ? upColor : downColor,
        })),
      [props.data],
    );

    useEffect(() => {
      if (chartApi && seriesApi) {
        //
        seriesApi.setData(candlestickData);
      }
    }, [chartApi, seriesApi, candlestickData]);
    useEffect(() => {
      if (chartApi && volumeSeriesApi) {
        //
        volumeSeriesApi.setData(volumeData);
      }
    }, [chartApi, volumeSeriesApi, volumeData]);

    if (props.children) {
      return React.cloneElement(props.children, { ...props.children.props, seriesApi: seriesApi });
    }
    return null;
  },
);

export const LineSeries = React.memo(
  (props: {
    options?: { title?: string; color?: string };
    data: Array<{ timestamp: number; value: number }>;
  }) => {
    const chartApi = useContext(ChartApiContext);
    const seriesApiRef = useRef<ISeriesApi<'Line'>>();

    useEffect(() => {
      if (chartApi) {
        const precision = 5;
        const series = chartApi.addLineSeries({
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: 'price', precision, minMove: +(0.1 ** precision).toFixed(precision) },
          ...props.options,
          title: undefined,
          ...{ yuan_title: props.options?.title },
        });
        seriesApiRef.current = series;
        return () => {
          chartApi.removeSeries(series);
          seriesApiRef.current = undefined;
        };
      }
    }, [chartApi]);

    const seriesData = useMemo(
      () =>
        props.data.map(
          (period): LineData => ({
            time: (period.timestamp / 1e3) as UTCTimestamp,
            // ISSUE: Inf / -Inf cause axis disappear, norm to NaN
            value: period.value === Infinity || period.value === -Infinity ? NaN : period.value,
            color:
              Number.isNaN(period.value) || period.value === Infinity || period.value === -Infinity
                ? 'transparent'
                : undefined,
          }),
        ),
      [props.data],
    );

    useEffect(() => {
      if (chartApi && seriesApiRef.current) {
        //
        seriesApiRef.current.setData(seriesData);
      }
    }, [chartApi, seriesData]);

    return null;
  },
);

export const HistogramSeries = React.memo(
  (props: {
    options?: { title?: string; color?: string };
    data: Array<{ timestamp: number; value: number }>;
  }) => {
    const chartApi = useContext(ChartApiContext);
    const seriesApiRef = useRef<ISeriesApi<'Histogram'>>();

    useEffect(() => {
      if (chartApi) {
        const precision = 5;
        const series = chartApi.addHistogramSeries({
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: 'price', precision, minMove: +(0.1 ** precision).toFixed(precision) },
          ...props.options,
          title: undefined,
          ...{ yuan_title: props.options?.title },
        });
        seriesApiRef.current = series;
        return () => {
          chartApi.removeSeries(series);
          seriesApiRef.current = undefined;
        };
      }
    }, [chartApi]);

    const color = props.options?.color ?? '#000000';
    const getRGB = (value: string) => {
      const [r, g, b] = value
        .slice(1)
        .match(/.{2}/g)!
        .map((x) => parseInt(x, 16));
      return { r, g, b };
    };
    const rgb = getRGB(color);

    const seriesData = useMemo(
      () =>
        props.data.map(
          (period): LineData => ({
            time: (period.timestamp / 1e3) as UTCTimestamp,
            value: period.value,
            color: Number.isNaN(period.value)
              ? 'transparent'
              : period.value > 0
              ? undefined
              : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`,
          }),
        ),
      [props.data],
    );

    useEffect(() => {
      if (chartApi && seriesApiRef.current) {
        //
        seriesApiRef.current.setData(seriesData);
      }
    }, [chartApi, seriesData]);

    return null;
  },
);

export const ChartGroupApiContext = React.createContext<Set<IChartApi> | null>(null);

export const ChartGroup = React.memo((props: { children: React.ReactNode }) => {
  const chartGroup = useRef(new Set<IChartApi>());

  return (
    <ChartGroupApiContext.Provider value={chartGroup.current}>{props.children}</ChartGroupApiContext.Provider>
  );
});

interface IOrderSeriesProps {
  period_in_sec: number;
  orders: IOrder[];
  seriesApi?: ISeriesApi<any>;
}

export const OrderSeries = React.memo((props: IOrderSeriesProps) => {
  const { t } = useTranslation(['OrderSeries', 'common']);
  const directionMapper: Record<string, string> = {
    //
    ['OPEN_LONG']: t('common:order_direction_open_long'),
    ['OPEN_SHORT']: t('common:order_direction_open_short'),
    ['CLOSE_LONG']: t('common:order_direction_close_long'),
    ['CLOSE_SHORT']: t('common:order_direction_close_short'),
  };
  const ordersMarkers = useMemo((): SeriesMarker<Time>[] => {
    return props.orders.map((order): SeriesMarker<Time> => {
      const dir = {
        //
        ['OPEN_LONG']: 1,
        ['OPEN_SHORT']: -1,
        ['CLOSE_SHORT']: 1,
        ['CLOSE_LONG']: -1,
      }[order.order_direction!]!;
      const text = directionMapper[order.order_direction!];
      // Issue: TradingView Chart will place order annotation in the next bar, so we need to align the order's time to bar's start-time
      const divider = (props.period_in_sec ?? 1) * 1e3;
      const alignedTimestamp = Math.floor(order.submit_at! / divider) * divider;
      return {
        time: (alignedTimestamp / 1e3) as UTCTimestamp,
        position: dir > 0 ? 'belowBar' : 'aboveBar',
        color: dir > 0 ? '#2196F3' : '#e91e63',
        shape: dir > 0 ? 'arrowUp' : 'arrowDown',
        text: `${text} @ ${order.traded_price} (${order.traded_volume})`,
      };
    });
  }, [props.period_in_sec, props.orders, directionMapper]);
  useEffect(() => {
    if (props.seriesApi) {
      props.seriesApi.setMarkers(ordersMarkers);
    }
  }, [props.seriesApi, ordersMarkers]);
  return null;
});
