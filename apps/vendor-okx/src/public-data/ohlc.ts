import { IOHLC } from '@yuants/data-ohlc';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { convertDurationToOffset, decodePath, encodePath, formatTime } from '@yuants/utils';
import { firstValueFrom, map, timer } from 'rxjs';
import { getHistoryCandles } from '../api/public-api';
import { provideOHLCFromTimeBackwardService } from '../utils/provideOHLCFromTimeBackwardService';
import { useOHLC } from '../ws';

const terminal = Terminal.fromNodeEnv();

// 时间粒度，默认值1m
// 如 [1m/3m/5m/15m/30m/1H/2H/4H]
// 香港时间开盘价k线：[6H/12H/1D/1W/1M]
// UTC时间开盘价k线：[6Hutc/12Hutc/1Dutc/1Wutc/1Mutc]

const DURATION_TO_OKX_BAR_TYPE: Record<string, string> = {
  PT1M: '1m',
  PT3M: '3m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',

  PT1H: '1H',
  PT2H: '2H',
  PT4H: '4H',
  PT6H: '6H',
  PT12H: '12H',

  P1D: '1D',
  P1W: '1W',
  P1M: '1M',
};

const DURATION_TO_OKX_CANDLE_TYPE: Record<string, string> = {
  PT1M: 'candle1m',
  PT3M: 'candle3m',
  PT5M: 'candle5m',
  PT15M: 'candle15m',
  PT30M: 'candle30m',

  PT1H: 'candle1H',
  PT2H: 'candle2H',
  PT4H: 'candle4H',
  PT6H: 'candle6H',
  PT12H: 'candle12H',

  P1D: 'candle1D',
  P1W: 'candle1W',
  P1M: 'candle1M',
};

type IOHLCV2WriteRow = Pick<
  IOHLC,
  'series_id' | 'created_at' | 'closed_at' | 'open' | 'high' | 'low' | 'close' | 'volume' | 'open_interest'
> & { __origin: IOHLC };

const OHLC_V2_WRITE_COLUMNS: Array<keyof IOHLCV2WriteRow> = [
  'series_id',
  'created_at',
  'closed_at',
  'open',
  'high',
  'low',
  'close',
  'volume',
  'open_interest',
];

createSeriesProvider<IOHLC>(terminal, {
  tableName: 'ohlc',
  series_id_prefix_parts: ['OKX'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, ended_at }) {
    const [datasource_id, product_id, duration] = decodePath(series_id);
    const offset = convertDurationToOffset(duration);
    if (!datasource_id) {
      throw 'datasource_id is required';
    }
    if (!product_id) {
      throw 'product_id is required';
    }
    if (!offset) {
      throw 'duration is invalid';
    }
    const [instType, instId] = decodePath(product_id);
    if (!instId) {
      throw `invalid product_id: ${product_id}`;
    }

    const bar = DURATION_TO_OKX_BAR_TYPE[duration];
    if (!bar) {
      throw `unsupported duration: ${duration}`;
    }

    let currentStartTime = ended_at;

    while (true) {
      // 向前翻页，时间降序，不含 after 时间点
      const res = await getHistoryCandles({
        instId,
        bar,
        after: `${currentStartTime}`,
        limit: '100',
      });
      if (res.code !== '0') {
        throw `API failed: ${res.code} ${res.msg}`;
      }
      if (res.data.length === 0) break;
      currentStartTime = +res.data[res.data.length - 1][0];
      const data = res.data.map(
        (x): IOHLC => ({
          series_id,
          datasource_id,
          product_id,
          duration,
          created_at: formatTime(+x[0]),
          closed_at: formatTime(+x[0] + offset),
          open: x[1],
          high: x[2],
          low: x[3],
          close: x[4],
          volume: x[5],
          open_interest: '0',
        }),
      );
      yield data;
      await firstValueFrom(timer(1000));
    }
  },
});

terminal.channel.publishChannel('ohlc', { pattern: `^OKX/` }, (series_id) => {
  const [datasource_id, product_id, duration] = decodePath(series_id);
  const [instType, instId] = decodePath(product_id);
  const offset = convertDurationToOffset(duration);
  if (!datasource_id) {
    throw 'datasource_id is required';
  }
  if (!product_id) {
    throw 'product_id is required';
  }
  if (!instType || !instId) {
    throw `invalid product_id: ${product_id}`;
  }
  if (!offset) {
    throw 'duration is invalid';
  }
  const series_id_v2 = `${encodePath(datasource_id, instType, instId)}/${duration}`;
  const candleType = DURATION_TO_OKX_CANDLE_TYPE[duration];
  console.info(formatTime(Date.now()), `subscribe`, series_id, product_id);

  return useOHLC(candleType, instId).pipe(
    map((data): IOHLC => {
      const created_at = Number(data[0][0]);
      const closed_at = created_at + offset;
      const open = data[0][1];
      const high = data[0][2];
      const low = data[0][3];
      const close = data[0][4];
      const volume = data[0][5];
      return {
        closed_at: formatTime(closed_at),
        created_at: formatTime(created_at),
        open,
        high,
        low,
        close,
        series_id,
        datasource_id,
        duration,
        product_id,
        volume,
        open_interest: '0',
      };
    }),
    map(
      (x): IOHLCV2WriteRow => ({
        __origin: x,
        series_id: series_id_v2,
        created_at: x.created_at,
        closed_at: x.closed_at,
        open: x.open,
        high: x.high,
        low: x.low,
        close: x.close,
        volume: x.volume,
        open_interest: x.open_interest,
      }),
    ),
    writeToSQL({
      tableName: 'ohlc_v2',
      columns: OHLC_V2_WRITE_COLUMNS,
      conflictKeys: ['series_id', 'created_at'],
      writeInterval: 1000,
      terminal,
    }),
    map((x) => x.__origin),
    writeToSQL({
      tableName: 'ohlc',
      conflictKeys: ['series_id', 'created_at'],
      writeInterval: 1000,
      terminal,
    }),
  );
});

provideOHLCFromTimeBackwardService({
  terminal,
  datasource_id: 'OKX',
  supported_durations: Object.keys(DURATION_TO_OKX_BAR_TYPE),
  queryFn: async ({ series_id, datasource_id, product_id, duration, offset, time }) => {
    const [instType, instId] = decodePath(product_id);
    if (!instId) {
      throw `invalid product_id: ${product_id}`;
    }

    const bar = DURATION_TO_OKX_BAR_TYPE[duration];
    if (!bar) {
      throw `unsupported duration: ${duration}`;
    }

    // 从指定时间点向过去获取一页数据
    const res = await getHistoryCandles({
      instId,
      bar,
      after: `${new Date(time).getTime()}`, // 不包含该时间点 (标准的右开)
      limit: `300`,
    });

    if (res.code !== '0') {
      throw `API failed: ${res.code} ${res.msg}`;
    }

    return res.data.map(
      (x): IOHLC => ({
        series_id,
        datasource_id,
        product_id,
        duration,
        created_at: formatTime(+x[0]),
        closed_at: formatTime(+x[0] + offset),
        open: x[1],
        high: x[2],
        low: x[3],
        close: x[4],
        volume: x[5],
        open_interest: '0',
      }),
    );
  },
  serviceOptions: {
    // Rate limit: 20 requests per 2 seconds
    egress_token_capacity: 20,
    egress_token_refill_interval: 2000,
  },
});
