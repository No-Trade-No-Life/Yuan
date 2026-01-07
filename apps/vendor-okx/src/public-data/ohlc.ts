import { decodeOHLCSeriesId, encodeOHLCSeriesId, IOHLC } from '@yuants/data-ohlc';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { convertDurationToOffset, decodePath, encodePath, formatTime } from '@yuants/utils';
import { map } from 'rxjs';
import { useOHLC } from '../ws';

const terminal = Terminal.fromNodeEnv();

// 时间粒度，默认值1m
// 如 [1m/3m/5m/15m/30m/1H/2H/4H]
// 香港时间开盘价k线：[6H/12H/1D/1W/1M]
// UTC时间开盘价k线：[6Hutc/12Hutc/1Dutc/1Wutc/1Mutc]

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

const OHLC_V2_WRITE_COLUMNS: Array<keyof IOHLC> = [
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

terminal.channel.publishChannel('ohlc', { pattern: `^OKX/` }, (series_id) => {
  const { product_id, duration } = decodeOHLCSeriesId(series_id);
  const [datasource_id, instType, instId] = decodePath(product_id);
  const offset = convertDurationToOffset(duration);
  if (!datasource_id) {
    throw 'datasource_id is required';
  }
  if (!instType || !instId) {
    throw `invalid product_id: ${product_id}`;
  }
  if (!offset) {
    throw 'duration is invalid';
  }
  const product_id_path = encodePath(datasource_id, instType, instId);
  const candleType = DURATION_TO_OKX_CANDLE_TYPE[duration];
  if (!candleType) {
    throw `unsupported duration: ${duration}`;
  }
  const normalized_series_id = encodeOHLCSeriesId(product_id_path, duration);
  console.info(formatTime(Date.now()), `subscribe`, normalized_series_id, product_id_path);

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
        series_id: normalized_series_id,
        datasource_id,
        duration,
        product_id: product_id_path,
        volume,
        open_interest: '0',
      };
    }),
    writeToSQL({
      tableName: 'ohlc_v2',
      columns: OHLC_V2_WRITE_COLUMNS,
      conflictKeys: ['series_id', 'created_at'],
      writeInterval: 1000,
      terminal,
    }),
  );
});
