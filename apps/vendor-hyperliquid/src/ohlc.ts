import { IOHLC } from '@yuants/data-ohlc';
import { createSeriesProvider } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { client } from './api';

// Hyperliquid supported intervals
// 支持的时间间隔: "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "3d", "1w", "1M"

const DURATION_TO_HYPERLIQUID_INTERVAL: Record<string, string> = {
  PT1M: '1m',
  PT3M: '3m',
  PT5M: '5m',
  PT15M: '15m',
  PT30M: '30m',

  PT1H: '1h',
  PT2H: '2h',
  PT4H: '4h',
  PT8H: '8h',
  PT12H: '12h',

  P1D: '1d',
  P3D: '3d',
  P1W: '1w',
  P1M: '1M',
};

const DURATION_TO_PERIOD_IN_SEC: Record<string, number> = {
  PT1M: 60,
  PT3M: 180,
  PT5M: 300,
  PT15M: 900,
  PT30M: 1800,

  PT1H: 3600,
  PT2H: 7200,
  PT4H: 14400,
  PT8H: 28800,
  PT12H: 43200,

  P1D: 86400,
  P3D: 259200,
  P1W: 604800,
  P1M: 2592000,
};

createSeriesProvider<IOHLC>(Terminal.fromNodeEnv(), {
  tableName: 'ohlc',
  series_id_prefix_parts: ['HYPERLIQUID'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, ended_at }) {
    const [datasource_id, product_id, duration] = decodePath(series_id);
    const period_in_sec = DURATION_TO_PERIOD_IN_SEC[duration];

    if (!datasource_id) {
      throw 'datasource_id is required';
    }
    if (!product_id) {
      throw 'product_id is required';
    }
    if (!period_in_sec) {
      throw 'period_in_sec is required';
    }

    const [instType, instId] = decodePath(product_id);
    if (!instId) {
      throw `invalid product_id: ${product_id}`;
    }

    // 从 instId 中提取币种名称，例如 "BTC-USDC" -> "BTC"
    const coin = instId.split('-')[0];

    const interval = DURATION_TO_HYPERLIQUID_INTERVAL[duration];
    if (!interval) {
      throw `unsupported duration: ${duration}`;
    }

    try {
      // 获取最近 5000 根 K 线，从很早的时间开始到 ended_at
      const startTime = 0; // 从很早开始，让 API 返回最近的数据

      const res = await client.getCandleSnapshot({
        req: {
          coin: coin,
          interval: interval,
          startTime: startTime,
          endTime: ended_at,
        },
      });

      console.info(
        formatTime(Date.now()),
        'getCandleSnapshot',
        coin,
        interval,
        `${startTime}-${ended_at}`,
        `returned ${res?.length || 0} candles`,
      );

      if (!res || !res.length || res.length === 0) {
        return;
      }

      // Hyperliquid candle 数据格式: 对象格式
      // { T: number, c: string, h: string, i: string, l: string, o: string, n: number, s: string, t: number, v: string }
      // t: 时间戳（毫秒），o: 开盘价，h: 最高价，l: 最低价，c: 收盘价，v: 成交量
      const data = res
        .filter((x) => x.t < ended_at) // 确保不包含 ended_at 时间点
        .map(
          (x): IOHLC => ({
            series_id,
            datasource_id,
            product_id,
            duration,
            created_at: formatTime(x.t),
            closed_at: formatTime(x.t + period_in_sec * 1000),
            open: x.o,
            high: x.h,
            low: x.l,
            close: x.c,
            volume: x.v,
            open_interest: '0',
          }),
        )
        .sort((a: IOHLC, b: IOHLC) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); // 按时间降序排列

      if (data.length > 0) {
        yield data;
      }
    } catch (error) {
      console.error(formatTime(Date.now()), 'getCandleSnapshot failed', coin, interval, error);
      throw error;
    }
  },
});
