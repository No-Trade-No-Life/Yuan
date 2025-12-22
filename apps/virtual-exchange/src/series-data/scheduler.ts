import { encodeInterestRateSeriesId } from '@yuants/data-interest-rate';
import { encodeOHLCSeriesId } from '@yuants/data-ohlc';
import {
  IIngestInterestRateRequest,
  IIngestOHLCRequest,
  ISeriesIngestResult,
  parseInterestRateServiceMetadataFromSchema,
  parseOHLCServiceMetadataFromSchema,
  SeriesFetchDirection,
} from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { convertDurationToOffset, encodePath, formatTime } from '@yuants/utils';
import { catchError, defer, EMPTY, filter, from, map, mergeMap, repeat, tap, toArray } from 'rxjs';
import { createFifoQueue } from './fifo-queue';

const terminal = Terminal.fromNodeEnv();

const isEnabled = process.env.VEX_SERIES_DATA_ENABLED === '1';

const MAX_INFLIGHT = Number(process.env.VEX_SERIES_DATA_MAX_INFLIGHT ?? '4');
const HEAD_QUEUE_TARGET_SIZE = Number(process.env.VEX_SERIES_DATA_HEAD_QUEUE_TARGET_SIZE ?? '200');
const TAIL_QUEUE_TARGET_SIZE = Number(process.env.VEX_SERIES_DATA_TAIL_QUEUE_TARGET_SIZE ?? '50');
const TAIL_ONLY_WHEN_HEAD_BELOW = Number(process.env.VEX_SERIES_DATA_TAIL_ONLY_WHEN_HEAD_BELOW ?? '20');

const SCAN_BATCH_SIZE = Number(process.env.VEX_SERIES_DATA_SCAN_BATCH_SIZE ?? '200');
const SCAN_FULL_LOOP_INTERVAL_MS = Number(process.env.VEX_SERIES_DATA_SCAN_FULL_LOOP_INTERVAL_MS ?? '300000'); // 5m

const DEFAULT_INTEREST_RATE_HEAD_LAG_MS = Number(
  process.env.VEX_SERIES_DATA_INTEREST_RATE_HEAD_LAG_MS ?? '28800000',
); // 8h
const DEFAULT_FORWARD_SEED_WINDOW_MS = Number(
  process.env.VEX_SERIES_DATA_FORWARD_SEED_WINDOW_MS ?? '31536000000',
); // 365d
const FILTER_NO_INTEREST_RATE = process.env.VEX_SERIES_DATA_FILTER_NO_INTEREST_RATE === '1';

// Service Discovery -> Scan Products -> Enqueue Jobs -> Tick -> Execute Job -> Merge Range -> Repeat
//
// 1) Service Discovery:
//    Subscribe `terminal.terminalInfos$`, find services with method `IngestOHLC` / `IngestInterestRate`,
//    parse schema -> capability metadata (product_id_prefix, direction, duration_list).
//
// 2) Scan Products:
//    For each capability, scan `product` table by `product_id_prefix` with a cursor:
//      SELECT product_id WHERE product_id LIKE '${prefix}%' AND product_id > cursor ORDER BY ... LIMIT ...
//    Then expand product -> series:
//      - OHLC: product x duration_list
//      - InterestRate: product
//
// 3) Schedule policy (per series):
//    - `head` (freshness) has higher priority: keep `union_end_ms` close to `now`
//    - `tail` (backfill) runs only when head queue is low, and uses `union_start_ms` to walk backward
//    Backpressure is controlled by:
//      - global `MAX_INFLIGHT`
//      - queue size targets (`HEAD_QUEUE_TARGET_SIZE`, `TAIL_QUEUE_TARGET_SIZE`)
//      - per-series de-dupe (`pendingHead/pendingTail/inFlight`)
//      - failure backoff (`nextEligibleAt`)
//
// 4) Progress source of truth:
//    We do NOT depend on wrote_count/inserted_count to decide progress.
//    After each successful ingest, we merge `series_data_range` and recompute union boundaries.
//
// 5) Routing / load balancing:
//    Scheduler does not pin a request to a specific instance; it uses `terminal.client.requestForResponseData`
//    and relies on Terminal's schema-based service selection + load balancing.

type ISeriesType = 'ohlc' | 'interest_rate';
type IJobKind = 'head' | 'tail';

type ISeriesState = {
  seriesKey: string;
  seriesType: ISeriesType;
  table_name: string;
  series_id: string;
  product_id: string;
  duration?: string;
  direction: SeriesFetchDirection;
  union_start_ms?: number;
  union_end_ms?: number;
  last_window_ms?: number;
  pendingHead: boolean;
  pendingTail: boolean;
  inFlight: boolean;
  nextEligibleAt: number;
  backoff_ms: number;
  tailExhausted: boolean;
};

type IJob = {
  kind: IJobKind;
  seriesKey: string;
};

type ICapability = {
  capKey: string;
  seriesType: ISeriesType;
  method: 'IngestOHLC' | 'IngestInterestRate';
  product_id_prefix: string;
  direction: SeriesFetchDirection;
  duration_list?: string[];
  scanCursorProductId: string;
  nextScanAt: number;
};

const capabilities: ICapability[] = [];
const mapCapKeyToCapability = new Map<string, ICapability>();

const mapSeriesKeyToState = new Map<string, ISeriesState>();

const headQueue = createFifoQueue<IJob>();
const tailQueue = createFifoQueue<IJob>();

let inflight = 0;
let scanIndex = 0;
let isTickRunning = false;

const computeDefaultHeadLagMs = (series: ISeriesState): number => {
  if (series.seriesType === 'interest_rate') return DEFAULT_INTEREST_RATE_HEAD_LAG_MS;
  const duration = series.duration ?? '';
  const offset = convertDurationToOffset(duration);
  if (!isFinite(offset) || offset <= 0) return 60_000;
  return Math.max(60_000, offset * 2);
};

const computeBackoffMs = (current: number): number => {
  const next = current <= 0 ? 5_000 : Math.min(300_000, current + 5_000);
  return next;
};

const markJobPending = (series: ISeriesState, kind: IJobKind) => {
  if (kind === 'head') series.pendingHead = true;
  else series.pendingTail = true;
};

const clearJobPending = (series: ISeriesState, kind: IJobKind) => {
  if (kind === 'head') series.pendingHead = false;
  else series.pendingTail = false;
};

const enqueueJob = (kind: IJobKind, seriesKey: string) => {
  const series = mapSeriesKeyToState.get(seriesKey);
  if (!series) return;
  if (kind === 'head') {
    if (series.pendingHead || series.inFlight) return;
    series.pendingHead = true;
    headQueue.enqueue({ kind, seriesKey });
  } else {
    if (series.pendingTail || series.inFlight) return;
    series.pendingTail = true;
    tailQueue.enqueue({ kind, seriesKey });
  }
};

const computeSeriesId = (seriesType: ISeriesType, product_id: string, duration?: string): string => {
  if (seriesType === 'ohlc') return encodeOHLCSeriesId(product_id, duration ?? '');
  return encodeInterestRateSeriesId(product_id);
};

const getOrCreateSeriesState = (params: {
  seriesType: ISeriesType;
  product_id: string;
  duration?: string;
  direction: SeriesFetchDirection;
}): ISeriesState => {
  const { seriesType, product_id, duration, direction } = params;
  const table_name = seriesType === 'ohlc' ? 'ohlc_v2' : 'interest_rate';
  const series_id = computeSeriesId(seriesType, product_id, duration);
  const seriesKey = encodePath(table_name, direction, product_id, duration ?? '');
  const existing = mapSeriesKeyToState.get(seriesKey);
  if (existing) return existing;
  const next: ISeriesState = {
    seriesKey,
    seriesType,
    table_name,
    series_id,
    product_id,
    duration,
    direction,
    pendingHead: false,
    pendingTail: false,
    inFlight: false,
    nextEligibleAt: 0,
    backoff_ms: 0,
    tailExhausted: false,
  };
  mapSeriesKeyToState.set(seriesKey, next);
  return next;
};

const mergeRangesAndGetUnion = async (
  series_id: string,
  table_name: string,
): Promise<{
  ranges: { start_time: string; end_time: string }[];
  union?: { startMs: number; endMs: number };
}> => {
  // Merge overlapping (or adjacent) ranges for the same (series_id, table_name).
  //
  // Why in SQL?
  // - vendor ingest may append many small ranges (and may do it concurrently)
  // - without merging, range fragments explode and make scheduling slower
  //
  // Concurrency:
  // - `FOR UPDATE` locks all rows for this key (series_id, table_name) in this transaction
  // - we recompute merged segments with window functions
  // - delete locked rows, insert merged rows, then re-select the final set
  const res = await requestSQL<{ start_time: string; end_time: string }[]>(
    terminal,
    `
    WITH locked AS (
      SELECT start_time, end_time
      FROM series_data_range
      WHERE series_id = ${escapeSQL(series_id)} AND table_name = ${escapeSQL(table_name)}
      ORDER BY start_time ASC, end_time ASC
      FOR UPDATE
    ),
    ordered AS (
      SELECT
        start_time,
        end_time,
        max(end_time) OVER (
          ORDER BY start_time ASC, end_time ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_end
      FROM locked
    ),
    marks AS (
      SELECT
        start_time,
        end_time,
        running_end,
        CASE
          WHEN start_time > COALESCE(
            lag(running_end) OVER (ORDER BY start_time ASC, end_time ASC),
            '-infinity'::timestamptz
          ) THEN 1
          ELSE 0
        END AS is_new_group
      FROM ordered
    ),
    groups AS (
      SELECT
        start_time,
        end_time,
        sum(is_new_group) OVER (
          ORDER BY start_time ASC, end_time ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS grp
      FROM marks
    ),
    merged AS (
      SELECT min(start_time) AS start_time, max(end_time) AS end_time
      FROM groups
      GROUP BY grp
    ),
    deleted AS (
      DELETE FROM series_data_range t
      USING locked l
      WHERE
        t.series_id = ${escapeSQL(series_id)}
        AND t.table_name = ${escapeSQL(table_name)}
        AND t.start_time = l.start_time
        AND t.end_time = l.end_time
      RETURNING 1
    ),
    inserted AS (
      INSERT INTO series_data_range (series_id, table_name, start_time, end_time)
      SELECT ${escapeSQL(series_id)}, ${escapeSQL(table_name)}, start_time, end_time
      FROM merged
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT start_time, end_time
    FROM series_data_range
    WHERE series_id = ${escapeSQL(series_id)} AND table_name = ${escapeSQL(table_name)}
    ORDER BY start_time ASC, end_time ASC;
    `,
  );

  if (res.length === 0) return { ranges: [] };
  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  for (const r of res) {
    const s = Date.parse(r.start_time);
    const e = Date.parse(r.end_time);
    if (!isNaN(s)) startMs = Math.min(startMs, s);
    if (!isNaN(e)) endMs = Math.max(endMs, e);
  }
  if (!isFinite(startMs) || !isFinite(endMs)) return { ranges: res };
  return { ranges: res, union: { startMs, endMs } };
};

const scheduleIfNeeded = (series: ISeriesState) => {
  const now = Date.now();
  if (series.inFlight) return;
  if (series.nextEligibleAt > now) return;

  // Head job keeps series fresh:
  // - If we never saw any range, seed it with a head job first.
  // - Else if `union_end_ms` lags behind now too much, schedule head.
  const headLagMs = computeDefaultHeadLagMs(series);
  const needHead = series.union_end_ms === undefined || now - series.union_end_ms > headLagMs;
  if (needHead && headQueue.size() < HEAD_QUEUE_TARGET_SIZE) {
    enqueueJob('head', series.seriesKey);
    return;
  }

  // Tail job backfills history:
  // - Only when we already have some range (need `union_start_ms`)
  // - Only when head queue is low (avoid starving freshness)
  // - Stop when tail keeps returning empty range (`tailExhausted=true`)
  if (series.tailExhausted) return;
  if (tailQueue.size() >= TAIL_QUEUE_TARGET_SIZE) return;
  if (headQueue.size() >= TAIL_ONLY_WHEN_HEAD_BELOW) return;
  if (series.union_start_ms === undefined) return;
  enqueueJob('tail', series.seriesKey);
};

const scanProductsOnce = async () => {
  if (capabilities.length === 0) return;
  if (headQueue.size() >= HEAD_QUEUE_TARGET_SIZE) return;

  // Fair scanning across capabilities:
  // - scanIndex rotates over `capabilities` to avoid a single prefix starving others
  // - each capability keeps its own cursor + cool-down (`nextScanAt`) for full-loop pacing
  const now = Date.now();
  const cap = capabilities[scanIndex++ % capabilities.length];
  if (cap.nextScanAt > now) return;

  const where = [
    `product_id LIKE ${escapeSQL(`${cap.product_id_prefix}%`)}`,
    cap.scanCursorProductId ? `product_id > ${escapeSQL(cap.scanCursorProductId)}` : '',
    FILTER_NO_INTEREST_RATE && cap.seriesType === 'interest_rate'
      ? `COALESCE(no_interest_rate, false) = false`
      : '',
  ]
    .filter(Boolean)
    .join(' AND ');

  const rows = await requestSQL<{ product_id: string }[]>(
    terminal,
    `
    SELECT product_id
    FROM product
    WHERE ${where}
    ORDER BY product_id ASC
    LIMIT ${SCAN_BATCH_SIZE};
    `,
  );

  if (rows.length === 0) {
    cap.scanCursorProductId = '';
    cap.nextScanAt = now + SCAN_FULL_LOOP_INTERVAL_MS;
    return;
  }

  cap.scanCursorProductId = rows[rows.length - 1].product_id;

  for (const row of rows) {
    if (cap.seriesType === 'ohlc') {
      for (const duration of cap.duration_list ?? []) {
        const series = getOrCreateSeriesState({
          seriesType: 'ohlc',
          product_id: row.product_id,
          duration,
          direction: cap.direction,
        });
        scheduleIfNeeded(series);
      }
    } else {
      const series = getOrCreateSeriesState({
        seriesType: 'interest_rate',
        product_id: row.product_id,
        direction: cap.direction,
      });
      scheduleIfNeeded(series);
    }

    if (headQueue.size() >= HEAD_QUEUE_TARGET_SIZE) break;
  }
};

const computeRequestTime = (series: ISeriesState, kind: IJobKind): number => {
  const now = Date.now();
  // Direction semantics:
  // - backward:
  //     head: keep fetching near now (to catch up new data)
  //     tail: walk backward from current earliest boundary (`union_start_ms`)
  // - forward:
  //     head: extend from current latest boundary (`union_end_ms`), or seed a window near now
  //     tail: go further into the past by "windowMs" steps (best-effort backfill)
  if (series.direction === 'backward') {
    if (kind === 'head') return now;
    return series.union_start_ms ?? now;
  }

  const windowMs = series.last_window_ms ?? DEFAULT_FORWARD_SEED_WINDOW_MS;
  if (kind === 'head') {
    if (series.union_end_ms !== undefined) return series.union_end_ms;
    return Math.max(0, now - windowMs);
  }
  const start = series.union_start_ms ?? Math.max(0, now - windowMs);
  return Math.max(0, start - windowMs);
};

const executeJob = async (job: IJob) => {
  const series = mapSeriesKeyToState.get(job.seriesKey);
  if (!series) return;

  // A job is dequeued only once, so we clear the `pending*` flag at the start.
  // If the series is still in backoff window, we re-enqueue it (and set pending again).
  clearJobPending(series, job.kind);

  const now = Date.now();
  if (series.nextEligibleAt > now) {
    markJobPending(series, job.kind);
    if (job.kind === 'head') headQueue.enqueue(job);
    else tailQueue.enqueue(job);
    return;
  }

  series.inFlight = true;
  inflight++;

  const time = computeRequestTime(series, job.kind);

  try {
    let result: ISeriesIngestResult;
    if (series.seriesType === 'ohlc') {
      const req: IIngestOHLCRequest = {
        product_id: series.product_id,
        duration: series.duration ?? '',
        direction: series.direction,
        time,
      };
      result = await terminal.client.requestForResponseData<IIngestOHLCRequest, ISeriesIngestResult>(
        'IngestOHLC',
        req,
      );
    } else {
      const req: IIngestInterestRateRequest = {
        product_id: series.product_id,
        direction: series.direction,
        time,
      };
      result = await terminal.client.requestForResponseData<IIngestInterestRateRequest, ISeriesIngestResult>(
        'IngestInterestRate',
        req,
      );
    }

    series.backoff_ms = 0;
    series.nextEligibleAt = 0;

    // Some services may return no range (e.g. empty response or no more history).
    // For tail, treat it as "exhausted" to avoid endless retries.
    if (!result.range) {
      if (job.kind === 'tail') {
        series.tailExhausted = true;
      }
      return;
    }

    const startMs = Date.parse(result.range.start_time);
    const endMs = Date.parse(result.range.end_time);
    if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
      series.last_window_ms = endMs - startMs;
    }

    // Merge range fragments and refresh union boundaries.
    const merged = await mergeRangesAndGetUnion(series.series_id, series.table_name);
    if (merged.union) {
      series.union_start_ms = merged.union.startMs;
      series.union_end_ms = merged.union.endMs;
    }

    // A successful head job likely means we are still behind `now`, so schedule more if needed.
    if (job.kind === 'head') {
      scheduleIfNeeded(series);
    }
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in (e as any) ? (e as any).code : undefined;
    series.backoff_ms = computeBackoffMs(series.backoff_ms);
    series.nextEligibleAt = Date.now() + series.backoff_ms;
    console.warn(
      formatTime(Date.now()),
      '[VEX][SeriesData]IngestFailed',
      `type=${series.seriesType}`,
      `dir=${series.direction}`,
      `product_id=${series.product_id}`,
      series.duration ? `duration=${series.duration}` : '',
      `code=${code ?? ''}`,
      `backoff_ms=${series.backoff_ms}`,
    );
  } finally {
    series.inFlight = false;
    inflight--;
  }
};

const tick = async () => {
  if (!isEnabled) return;
  if (isTickRunning) return;
  isTickRunning = true;
  try {
    // The tick loop is intentionally serial:
    // - each tick: scan once + drain one job at a time until reaching MAX_INFLIGHT
    // - no setInterval; it is driven by RxJS `defer + repeat`, making it easy to stop/observe
    while (inflight < MAX_INFLIGHT) {
      await scanProductsOnce().catch((e) => {
        console.error(formatTime(Date.now()), '[VEX][SeriesData]ScanFailed', `${e}`);
      });

      const next =
        headQueue.size() > 0 ? headQueue.dequeue() : tailQueue.size() > 0 ? tailQueue.dequeue() : undefined;
      if (!next) return;
      await executeJob(next);
    }
  } finally {
    isTickRunning = false;
  }
};

if (!isEnabled) {
  console.info(formatTime(Date.now()), '[VEX][SeriesData]Disabled', 'VEX_SERIES_DATA_ENABLED!=1');
} else {
  terminal.server.provideService('VEX/SeriesData/Peek', {}, async () => {
    return {
      res: {
        code: 0,
        message: 'OK',
        data: {
          enabled: true,
          inflight,
          capabilities: capabilities.map((x) => ({
            capKey: x.capKey,
            seriesType: x.seriesType,
            product_id_prefix: x.product_id_prefix,
            direction: x.direction,
            duration_count: x.duration_list?.length ?? 0,
            scanCursorProductId: x.scanCursorProductId,
            nextScanAt: x.nextScanAt,
          })),
          series_count: mapSeriesKeyToState.size,
          head_queue_size: headQueue.size(),
          tail_queue_size: tailQueue.size(),
        },
      },
    };
  });

  terminal.terminalInfos$
    .pipe(
      mergeMap((terminalInfos) =>
        from(terminalInfos).pipe(
          mergeMap((terminalInfo) =>
            from(Object.values(terminalInfo.serviceInfo || {})).pipe(
              filter(
                (serviceInfo) =>
                  serviceInfo.method === 'IngestOHLC' || serviceInfo.method === 'IngestInterestRate',
              ),
              map((serviceInfo): ICapability | undefined => {
                try {
                  if (serviceInfo.method === 'IngestOHLC') {
                    const meta = parseOHLCServiceMetadataFromSchema(serviceInfo.schema);
                    const duration_list = [...new Set(meta.duration_list)].sort();
                    const capKey = encodePath(
                      'IngestOHLC',
                      meta.product_id_prefix,
                      meta.direction,
                      duration_list.join(','),
                    );
                    const existing = mapCapKeyToCapability.get(capKey);
                    if (existing) {
                      existing.duration_list = duration_list;
                      return existing;
                    }
                    const cap: ICapability = {
                      capKey,
                      seriesType: 'ohlc',
                      method: 'IngestOHLC',
                      product_id_prefix: meta.product_id_prefix,
                      direction: meta.direction,
                      duration_list,
                      scanCursorProductId: '',
                      nextScanAt: 0,
                    };
                    return cap;
                  }
                  const meta = parseInterestRateServiceMetadataFromSchema(serviceInfo.schema);
                  const capKey = encodePath('IngestInterestRate', meta.product_id_prefix, meta.direction);
                  const existing = mapCapKeyToCapability.get(capKey);
                  if (existing) return existing;
                  const cap: ICapability = {
                    capKey,
                    seriesType: 'interest_rate',
                    method: 'IngestInterestRate',
                    product_id_prefix: meta.product_id_prefix,
                    direction: meta.direction,
                    scanCursorProductId: '',
                    nextScanAt: 0,
                  };
                  return cap;
                } catch {}
              }),
              filter((x): x is Exclude<typeof x, undefined> => !!x),
            ),
          ),
          toArray(),
          tap((nextCaps) => {
            const nextMap = new Map<string, ICapability>();
            for (const cap of nextCaps) {
              nextMap.set(cap.capKey, cap);
            }
            mapCapKeyToCapability.clear();
            nextMap.forEach((v, k) => mapCapKeyToCapability.set(k, v));
            capabilities.length = 0;
            nextMap.forEach((v) => capabilities.push(v));
          }),
        ),
      ),
    )
    .subscribe();

  defer(() => from(tick()))
    .pipe(
      catchError((e) => {
        console.error(formatTime(Date.now()), '[VEX][SeriesData]TickError', `${e}`);
        return EMPTY;
      }),
      repeat({ delay: 1000 }),
    )
    .subscribe();
}
