import { decodePath, formatTime, IPeriod, UUID } from '@yuants/data-model';
import { IOHLC } from '@yuants/data-ohlc';
import { IProduct } from '@yuants/data-product';
import { createSeriesProvider } from '@yuants/data-series';
import { providePeriods, Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import {
  catchError,
  defer,
  delayWhen,
  EMPTY,
  filter,
  firstValueFrom,
  from,
  map,
  mergeAll,
  mergeMap,
  Observable,
  of,
  repeat,
  retry,
  shareReplay,
  skip,
  Subject,
  takeWhile,
  tap,
  timeout,
  toArray,
} from 'rxjs';
import { ITQResponse } from './common/tq-datatype';
import { createConnectionTq } from './common/ws';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `TQ/${UUID()}`,
  name: 'TQ-SDK WS-API',
});

const DATASOURCE_ID = process.env.DATASOURCE_ID || 'TQ';
const CONCURRENCY = +(process.env.CONCURRENCY || 200);

// const realtimePeriods: Record<string, Observable<IPeriod>> = {};
const queryChart = (product_id: string, period_in_sec: number, periods_length: number) => {
  const id = UUID();
  console.info(new Date(), 'QueryChart', id, product_id, period_in_sec, periods_length);
  return defer(() => of(createConnectionTq())).pipe(
    delayWhen((conn) => from(conn.connection$)),
    mergeMap((conn) => {
      const period_in_ns = period_in_sec * 1e9;
      conn.output$.next({
        aid: 'set_chart',
        chart_id: id,
        ins_list: product_id,
        duration: period_in_ns,
        view_width: periods_length,
      });

      const loop$ = defer(() => {
        console.debug(new Date(), 'QueryChart', 'Peek', id);
        conn.output$.next({ aid: 'peek_message' });
        return EMPTY;
      }).pipe(
        //
        repeat({ delay: 1000 }),
      );
      const sub = loop$.subscribe();

      return conn.input$
        .pipe(
          //
          filter((msg): msg is ITQResponse => msg.aid === 'rtn_data'),
          // 如果 mdhis_more_data 为 true，则继续等待下一条数据
          takeWhile((msg) => {
            if (
              msg.data.find((x) => x.klines) &&
              msg.data.find((x) => x.charts?.[id])?.mdhis_more_data !== true
            ) {
              return false;
            }
            return true;
          }, true),
          mergeMap((x) => x.data),
          map((msg) => msg?.klines?.[product_id]?.[period_in_ns]?.data),
          filter((x): x is Exclude<typeof x, undefined | null> => !!x),
          map((records) => Object.values(records)),
        )
        .pipe(
          tap({
            next: (records) => {
              console.info(new Date(), 'QueryChart', '拉回结果', id, records.length);
            },
            finalize: () => {
              sub.unsubscribe();
              // cancel chart
              conn.output$.next({
                aid: 'set_chart',
                chart_id: id,
                ins_list: '',
                duration: period_in_ns,
                view_width: 1,
              });
              conn.output$.complete();
            },
          }),
          mergeAll(),
          toArray(),
        )
        .pipe(
          // ISSUE: 可能会有一些请求没有成功完成任务，为了防止泄漏堆积，加上一个超时，并将轮询和连接中止掉，防止最终被 TQ 封 IP。
          timeout({
            meta: `request Timeout for query product_id=${product_id} period_in_sec=${period_in_sec}`,
            each: 60_000,
          }),
          catchError((err) => {
            console.error(err);
            sub.unsubscribe();
            conn.output$.complete();
            throw err;
          }),
        );
    }),
  );
};

// 订阅 K 线需要维护 chart_id https://doc.shinnytech.com/diff/latest/funcset/mdhis.html
// TODO: 所有订阅使用同一个 WS 连接
const subscribePeriods = (product_id: string, period_in_sec: number): Observable<IPeriod[]> => {
  const id = UUID();
  return defer(() => of(createConnectionTq())).pipe(
    //
    delayWhen((conn) => from(conn.connection$)),
    mergeMap((conn) => {
      const period_in_ns = period_in_sec * 1e9;
      conn.output$.next({
        aid: 'set_chart',
        chart_id: id,
        ins_list: product_id,
        duration: period_in_ns,
        view_width: 2,
      });
      const loop$ = defer(() => {
        console.debug(new Date(), 'QueryChart', 'Peek', id);
        conn.output$.next({ aid: 'peek_message' });
        return EMPTY;
      }).pipe(
        //
        repeat({ delay: 1000 }),
      );
      const sub = loop$.subscribe();

      return conn.input$
        .pipe(
          //
          filter((msg) => msg.aid === 'rtn_data'),
          map((msg: ITQResponse) => msg.data?.[0]?.klines?.[product_id]?.[period_in_ns]?.data ?? {}),
          map((records) => Object.values(records)),
          filter((records) => records.length > 0),
          tap((records) => {
            console.info(
              new Date(),
              'Chart',
              `${product_id}-${period_in_sec}`,
              '拉回结果',
              id,
              JSON.stringify(records),
              records.length,
            );
          }),
          mergeMap((v) =>
            from(v).pipe(
              //
              map(
                (record): IPeriod => ({
                  datasource_id: DATASOURCE_ID,
                  product_id,
                  period_in_sec,
                  timestamp_in_us: record.datetime / 1e3,
                  open: record.open,
                  high: record.high,
                  low: record.low,
                  close: record.close,
                  volume: record.volume,
                  open_interest: record.close_oi,
                }),
              ),
              toArray(),
            ),
          ),
        )
        .pipe(
          // ISSUE: 可能会有一些请求没有成功完成任务，为了防止泄漏堆积，加上一个超时，并将轮询和连接中止掉，防止最终被 TQ 封 IP。
          timeout({
            meta: `request Timeout for subscribe product_id=${product_id} period_in_sec=${period_in_sec}`,
            each: 60_000,
          }),
          catchError((err) => {
            console.error(err);
            sub.unsubscribe();
            conn.output$.complete();
            throw err;
          }),
        );
    }),
    retry({ delay: 5000 }),
    // ISSUE: 重连时候会出现重复的 K 线，此处去重
    skip(1),
  );
};

const usePeriods = (() => {
  const hub: Record<string, Observable<IPeriod[]>> = {};
  return (product_id: string, period_in_sec: number) =>
    (hub[[product_id, period_in_sec].join('\n')] ??= subscribePeriods(product_id, period_in_sec).pipe(
      shareReplay(1),
    ));
})();

const product$ = new Subject<IProduct>();

createSQLWriter(terminal, {
  data$: product$,
  tableName: 'product',
  writeInterval: 1_000,
  ignoreConflict: true,
});

defer(() =>
  // ISSUE: >200MB
  fetch('https://openmd.shinnytech.com/t/md/symbols/latest.json').then((x) => x.json()),
)
  .pipe(
    mergeMap((resp) => Object.values(resp)),
    filter((item: any) => ['FUTURE', 'FUTURE_INDEX', 'INDEX'].includes(item.class)),
    map(
      (item): IProduct => ({
        datasource_id: DATASOURCE_ID,
        product_id: item.instrument_id,
        name: item.ins_name,
        quote_currency: 'CNY',
        base_currency: '',
        value_scale_unit: '',
        value_based_cost: 0,
        volume_based_cost: 0,
        max_volume: 0,
        price_step: +item.price_tick,
        volume_step: 1,
        value_scale: item.volume_multiple,
        allow_long: true,
        allow_short: true,
        margin_rate: 0,
        max_position: 0,
      }),
    ),
    tap((product) => {
      product$.next(product);
    }),
    toArray(),
  )
  .pipe(
    //
    timeout(120_000),
    retry(),
    repeat({ delay: 86400_000 }),
  )
  .subscribe();

defer(() => of(createConnectionTq()))
  .pipe(
    delayWhen((conn) => from(conn.connection$)),
    tap((conn) => {
      console.info(new Date(), 'Ctrl', '连接 TQ 服务器成功');
      conn.output$.complete();
    }),
  )
  .subscribe();

providePeriods(terminal, DATASOURCE_ID, usePeriods);

const calcNumPeriods = (start_time: number, period_in_sec: number) => {
  const now = Date.now();
  const num_periods = Math.min(Math.max(Math.ceil((now - start_time) / 1000 / period_in_sec) + 1, 2), 8000);
  return num_periods;
};

createSeriesProvider<IOHLC>(terminal, {
  tableName: 'ohlc',
  series_id_prefix_parts: [DATASOURCE_ID],
  reversed: false,
  serviceOptions: { concurrent: CONCURRENCY },
  queryFn: async ({ series_id, started_at }) => {
    const [datasource_id, product_id, duration] = decodePath(series_id);
    const period_in_sec = {
      PT1M: 60,
      PT5M: 300,
      PT15M: 900,
      PT30M: 1800,
      PT1H: 3600,
      PT2H: 7200,
      PT4H: 14400,
      P1D: 86400,
      P1W: 604800,
      P1M: 2592000,
      P1Y: 31536000,
    }[duration];
    if (!period_in_sec) throw new Error(`Unsupported duration: ${duration}`);
    const count = calcNumPeriods(started_at, period_in_sec);
    const data = await firstValueFrom(queryChart(product_id, period_in_sec, count));

    return data.map((x) => ({
      series_id,
      created_at: formatTime(x.datetime / 1e6),
      datasource_id: datasource_id,
      product_id: product_id,
      duration: duration,
      closed_at: formatTime(x.datetime / 1e6 + period_in_sec * 1000),
      open: `${x.open}`,
      high: `${x.high}`,
      low: `${x.low}`,
      close: `${x.close}`,
      volume: `${x.volume}`,
      open_interest: `${x.close_oi}`,
    }));
  },
});
