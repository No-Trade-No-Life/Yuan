import { decodePath, formatTime, getDataRecordWrapper, IPeriod, IProduct, UUID } from '@yuants/data-model';
import { provideDataSeries } from '@yuants/data-series';
import { providePeriods, Terminal, writeDataRecords } from '@yuants/protocol';
import {
  catchError,
  combineLatest,
  defer,
  delayWhen,
  EMPTY,
  filter,
  first,
  firstValueFrom,
  from,
  map,
  mergeMap,
  Observable,
  of,
  repeat,
  retry,
  shareReplay,
  skip,
  tap,
  timeout,
  toArray,
} from 'rxjs';
import { ITQResponse } from './common/tq-datatype';
import { createConnectionTq } from './common/ws';

const DATASOURCE_ID = process.env.DATASOURCE_ID || 'TQ';
const TERMINAL_ID = process.env.TERMINAL_ID || `TQ/${UUID()}`;
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const CONCURRENCY = +(process.env.CONCURRENCY || 200);

globalThis.console = {
  ...console,
  debug: ['DEBUG'].includes(LOG_LEVEL) ? console.debug : () => {},
  log: ['DEBUG'].includes(LOG_LEVEL) ? console.log : () => {},
};

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
          filter((msg) => msg.aid === 'rtn_data'),
          map((msg: ITQResponse) => msg.data?.[0]?.klines?.[product_id]?.[period_in_ns]?.data ?? {}),
          map((records) => Object.values(records)),
          first((records) => records.length > 0),
          tap((records) => {
            console.info(new Date(), 'QueryChart', '拉回结果', id, records.length);
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
          }),
          mergeMap((v) => v),
          map(
            (record): IPeriod => ({
              datasource_id: DATASOURCE_ID,
              product_id,
              period_in_sec,
              timestamp_in_us: record.datetime / 1e3,
              start_at: record.datetime / 1e6,
              open: record.open,
              high: record.high,
              low: record.low,
              close: record.close,
              volume: record.volume,
            }),
          ),
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
  // return (realtimePeriods[[product_id, period_in_sec].join('\n')] ??= )
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

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: TERMINAL_ID,
  name: '天勤量化 WS-API',
});

const products$ = defer(() =>
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
        price_step: +item.price_tick,
        volume_step: 1,
        value_scale: item.volume_multiple,
        allow_long: true,
        allow_short: true,
      }),
    ),
    toArray(),
  )
  .pipe(
    //
    timeout(120_000),
    retry(),
    repeat({ delay: 86400_000 }),
    shareReplay(1),
  );

combineLatest([
  defer(() => of(createConnectionTq())).pipe(
    delayWhen((conn) => from(conn.connection$)),
    tap((conn) => {
      console.info(new Date(), 'Ctrl', '连接 TQ 服务器成功');
      conn.output$.complete();
    }),
  ),
  products$.pipe(
    delayWhen((products) => from(writeDataRecords(terminal, products.map(getDataRecordWrapper('product')!)))),
    tap((products) => console.info(new Date(), 'Ctrl', `获取品种列表成功 ${products.length} 项`)),
  ),
]).subscribe(() => {
  terminal.terminalInfo.status = 'OK';
});

providePeriods(terminal, DATASOURCE_ID, usePeriods);

terminal.provideService(
  'QueryProducts',
  {
    required: ['datasource_id'],
    properties: {
      datasource_id: {
        const: DATASOURCE_ID,
      },
    },
  },
  () =>
    products$.pipe(
      //
      map((products) => ({ res: { code: 0, message: 'OK', data: products } })),
    ),
);

const calcNumPeriods = (start_time: number, period_in_sec: number) => {
  const now = Date.now();
  const num_periods = Math.min(Math.max(Math.ceil((now - start_time) / 1000 / period_in_sec) + 1, 2), 8000);
  return num_periods;
};

provideDataSeries(terminal, {
  type: 'period',
  series_id_prefix_parts: [DATASOURCE_ID],
  reversed: false,
  serviceOptions: { concurrent: CONCURRENCY },
  queryFn: async ({ series_id, started_at }) => {
    const [datasource_id, product_id, _period_in_sec] = decodePath(series_id);
    const period_in_sec = +_period_in_sec;
    const klines = calcNumPeriods(started_at, period_in_sec);
    console.info(formatTime(Date.now()), 'Periods', JSON.stringify({ product_id, period_in_sec, klines }));
    let periods = await firstValueFrom(queryChart(product_id, period_in_sec, klines));
    console.info(formatTime(Date.now()), 'Periods', JSON.stringify(periods[0]), periods.length);
    // 避免过量写入
    periods = periods.filter((v) => v.start_at! >= started_at);
    console.info(formatTime(Date.now()), 'Periods', JSON.stringify(periods[0]), periods.length);
    return periods;
  },
});
