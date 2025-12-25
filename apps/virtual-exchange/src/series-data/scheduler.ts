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
const onlyProductIdPrefix = (process.env.VEX_SERIES_DATA_ONLY_PRODUCT_ID_PREFIX ?? '').trim();

const CONFIG = {
  tickIntervalMs: 1_000,
  scanFullLoopIntervalMs: 5 * 60_000,
  maxInflight: 20,
  tailOnlyWhenGlobalHeadBelow: 20,
  defaultInterestRateHeadLagMs: 8 * 60 * 60_000,
  defaultForwardSeedWindowMs: 24 * 60 * 60_000,
  maxBackoffMs: 5 * 60_000,
  backoffStepMs: 5_000,
} as const;

// Per-capability bucket scheduler.
//
// Service Discovery -> Scan Products -> Schedule Series -> Tick -> Execute Job -> Merge Range -> Repeat
//
// 1) Service Discovery:
//    Subscribe `terminal.terminalInfos$`, find services with method `IngestOHLC` / `IngestInterestRate`,
//    parse schema -> capability metadata (product_id_prefix, direction, duration_list).
//
// 2) Capability buckets (capKey):
//    capKey = encodePath(method, product_id_prefix, direction)
//    - each cap has its own headQueue/tailQueue and runs serially (cap inflight=1)
//    - tick chooses a cap in round-robin; cap runs head first
//    - tail runs only when global head backlog is low (avoid hurting freshness)
//    - errors/backoff are isolated per-cap (a noisy cap won't block others)
//
// 3) Scan Products:
//    For each capability, scan `product` table by `product_id_prefix` (full scan) and expand product -> series:
//      - OHLC: product x duration_list
//      - InterestRate: product
//
// 4) Progress source of truth:
//    We do NOT depend on wrote_count/inserted_count to decide progress.
//    After each successful ingest, we merge `series_data_range` and recompute:
//      - segments[]: merged ranges (used for gap detection)
//      - union: { min(start), max(end) } (used for head/tail decisions; union does NOT mean continuous coverage)
//
// 5) Gap semantics:
//    - merge only on strict overlap: prev.end_time > next.start_time
//    - touch (prev.end_time == next.start_time): NOT merged, and NOT a gap
//    - gap only when prev.end_time < next.start_time
//    Tail will prioritize filling the nearest-now gap (by range boundaries).
//
// 6) Each request must overlap:
//    Because merge is strict-overlap only, a "touching" page would keep accumulating fragments.
//    Therefore we deliberately shift request `time` into the already-covered area by `overlapMs`:
//      - backward: time += overlapMs (clamp to <= now)
//      - forward:  time -= overlapMs (clamp to >= 0)
//    Duplicate writes are OK (unique key / ON CONFLICT absorbs them).
//
// 7) Retry/backoff:
//    When request fails or returns no range, we apply backoff and reschedule,
//    otherwise the queue may be consumed to empty and appear "stuck".
//
// 8) Routing / load balancing:
//    Scheduler does not pin a request to a specific instance; it uses `terminal.client.requestForResponseData`
//    and relies on Terminal's schema-based service selection + load balancing.

type ISeriesType = 'ohlc' | 'interest_rate';
type IJobKind = 'head' | 'tail';

type IJob = {
  kind: IJobKind;
  seriesKey: string;
};

type ISeriesState = {
  capKey: string;
  seriesKey: string;
  seriesType: ISeriesType;
  table_name: string;
  series_id: string;
  product_id: string;
  duration?: string;
  direction: SeriesFetchDirection;
  ranges: { startMs: number; endMs: number }[];
  union_start_ms?: number;
  union_end_ms?: number;
  last_window_ms?: number;
};

type ICapability = {
  capKey: string;
  method: 'IngestOHLC' | 'IngestInterestRate';
  seriesType: ISeriesType;
  product_id_prefix: string;
  direction: SeriesFetchDirection;
  duration_list?: string[];
  nextScanAt: number;
};

type ICapabilityState = {
  capKey: string;
  headQueue: ReturnType<typeof createFifoQueue<IJob>>;
  tailQueue: ReturnType<typeof createFifoQueue<IJob>>;
  pendingHead: Set<string>;
  pendingTail: Set<string>;
  inflight: boolean;
  nextEligibleAt: number;
  backoffMs: number;
};

const capabilities: ICapability[] = [];
const mapCapKeyToCapability = new Map<string, ICapability>();
const mapCapKeyToState = new Map<string, ICapabilityState>();

const mapSeriesKeyToState = new Map<string, ISeriesState>();

let inflight = 0;
let scanIndex = 0;
let capRunIndex = 0;
let lastQueueLogAt = 0;
const LOG_QUEUE_INTERVAL_MS = Number(process.env.VEX_SERIES_DATA_LOG_QUEUE_INTERVAL_MS ?? '10000');

const getOrCreateCapState = (capKey: string): ICapabilityState => {
  const existing = mapCapKeyToState.get(capKey);
  if (existing) return existing;
  const next: ICapabilityState = {
    capKey,
    headQueue: createFifoQueue<IJob>(),
    tailQueue: createFifoQueue<IJob>(),
    pendingHead: new Set<string>(),
    pendingTail: new Set<string>(),
    inflight: false,
    nextEligibleAt: 0,
    backoffMs: 0,
  };
  mapCapKeyToState.set(capKey, next);
  return next;
};

const computeSeriesId = (seriesType: ISeriesType, product_id: string, duration?: string): string => {
  if (seriesType === 'ohlc') return encodeOHLCSeriesId(product_id, duration ?? '');
  return encodeInterestRateSeriesId(product_id);
};

const getOrCreateSeriesState = (params: {
  capKey: string;
  seriesType: ISeriesType;
  product_id: string;
  duration?: string;
  direction: SeriesFetchDirection;
}): ISeriesState => {
  const { capKey, seriesType, product_id, duration, direction } = params;
  const table_name = seriesType === 'ohlc' ? 'ohlc_v2' : 'interest_rate';
  const series_id = computeSeriesId(seriesType, product_id, duration);
  const seriesKey = encodePath(table_name, direction, product_id, duration ?? '');

  const existing = mapSeriesKeyToState.get(seriesKey);
  if (existing) {
    existing.capKey = capKey;
    return existing;
  }

  const next: ISeriesState = {
    capKey,
    seriesKey,
    seriesType,
    table_name,
    series_id,
    product_id,
    duration,
    direction,
    ranges: [],
  };
  mapSeriesKeyToState.set(seriesKey, next);
  return next;
};

const computeHeadLagMs = (series: ISeriesState): number => {
  if (series.seriesType === 'interest_rate') return CONFIG.defaultInterestRateHeadLagMs;
  const offset = convertDurationToOffset(series.duration ?? '');
  if (!isFinite(offset) || offset <= 0) return 60_000;
  return Math.max(60_000, offset);
};

const computeOverlapMs = (series: ISeriesState): number => {
  const maxOverlapMs = 60 * 60_000;
  let overlapMs = 60_000;
  if (series.seriesType === 'ohlc') {
    const offset = convertDurationToOffset(series.duration ?? '');
    if (isFinite(offset) && offset > 0) overlapMs = offset;
  } else {
    overlapMs = 60 * 60_000;
  }
  if (series.last_window_ms && isFinite(series.last_window_ms) && series.last_window_ms > 0) {
    overlapMs = Math.min(overlapMs, Math.max(1, series.last_window_ms - 1));
  }
  return Math.max(1, Math.min(maxOverlapMs, overlapMs));
};

const applyOverlapToRequestTime = (series: ISeriesState, baseTime: number): number => {
  const hasAnyRange =
    series.union_start_ms !== undefined || series.union_end_ms !== undefined || series.ranges.length > 0;
  if (!hasAnyRange) return baseTime;
  const overlapMs = computeOverlapMs(series);
  if (series.direction === 'backward') return Math.min(baseTime + overlapMs, Date.now());
  return Math.max(0, baseTime - overlapMs);
};

const computeBackoffMs = (current: number): number => {
  const next =
    current <= 0 ? CONFIG.backoffStepMs : Math.min(CONFIG.maxBackoffMs, current + CONFIG.backoffStepMs);
  return next;
};

const enqueueCapJob = (capKey: string, kind: IJobKind, seriesKey: string) => {
  const capState = getOrCreateCapState(capKey);
  const pendingSet = kind === 'head' ? capState.pendingHead : capState.pendingTail;
  const queue = kind === 'head' ? capState.headQueue : capState.tailQueue;
  if (pendingSet.has(seriesKey)) return;
  pendingSet.add(seriesKey);
  queue.enqueue({ kind, seriesKey });
};

const scheduleSeries = (series: ISeriesState) => {
  const now = Date.now();

  const headLagMs = computeHeadLagMs(series);
  const needHead = series.union_end_ms === undefined || now - series.union_end_ms > headLagMs;
  if (needHead) {
    enqueueCapJob(series.capKey, 'head', series.seriesKey);
    return;
  }

  if (series.union_start_ms === undefined) return;
  enqueueCapJob(series.capKey, 'tail', series.seriesKey);
};

const mergeRangesAndGetUnion = async (
  series_id: string,
  table_name: string,
): Promise<{
  segments: { startMs: number; endMs: number }[];
  union?: { startMs: number; endMs: number };
}> => {
  const rows = await requestSQL<{ start_time: string; end_time: string }[]>(
    terminal,
    `
    WITH locked AS (
      SELECT series_id, table_name, start_time, end_time
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
          WHEN start_time >= COALESCE(
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
    to_delete AS (
      SELECT l.series_id, l.table_name, l.start_time, l.end_time
      FROM locked l
      WHERE NOT EXISTS (
        SELECT 1
        FROM merged m
        WHERE m.start_time = l.start_time AND m.end_time = l.end_time
      )
    ),
    deleted AS (
      DELETE FROM series_data_range t
      USING to_delete d
      WHERE
        t.series_id = d.series_id
        AND t.table_name = d.table_name
        AND t.start_time = d.start_time
        AND t.end_time = d.end_time
      RETURNING 1
    ),
    to_insert AS (
      SELECT m.start_time, m.end_time
      FROM merged m
      WHERE NOT EXISTS (
        SELECT 1
        FROM locked l
        WHERE l.start_time = m.start_time AND l.end_time = m.end_time
      )
    ),
    inserted AS (
      INSERT INTO series_data_range (series_id, table_name, start_time, end_time)
      SELECT ${escapeSQL(series_id)}, ${escapeSQL(table_name)}, start_time, end_time
      FROM to_insert
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT start_time, end_time
    FROM series_data_range
    WHERE series_id = ${escapeSQL(series_id)} AND table_name = ${escapeSQL(table_name)}
    ORDER BY start_time ASC, end_time ASC;
    `,
  );

  if (rows.length === 0) return { segments: [] };
  const segments: { startMs: number; endMs: number }[] = [];
  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    const s = Date.parse(r.start_time);
    const e = Date.parse(r.end_time);
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      segments.push({ startMs: s, endMs: e });
      startMs = Math.min(startMs, s);
      endMs = Math.max(endMs, e);
    }
  }
  if (!isFinite(startMs) || !isFinite(endMs)) return { segments };
  return { segments, union: { startMs, endMs } };
};

const findNearestGap = (
  segments: { startMs: number; endMs: number }[],
): { left: { startMs: number; endMs: number }; right: { startMs: number; endMs: number } } | undefined => {
  for (let i = segments.length - 2; i >= 0; i--) {
    const left = segments[i];
    const right = segments[i + 1];
    if (left.endMs < right.startMs) return { left, right };
  }
};

const computeTailTime = (series: ISeriesState, now: number): number => {
  const gap = findNearestGap(series.ranges);
  if (gap) {
    return series.direction === 'backward' ? gap.right.startMs : gap.left.endMs;
  }

  const first = series.ranges[0];
  const mostRecent = series.ranges[series.ranges.length - 1];
  if (series.direction === 'backward') {
    return series.union_start_ms ?? first?.startMs ?? mostRecent?.startMs ?? now;
  }

  const windowMs = series.last_window_ms ?? CONFIG.defaultForwardSeedWindowMs;
  const start = series.union_start_ms ?? Math.max(0, now - windowMs);
  return Math.max(0, start - windowMs);
};

const computeRequestTime = (series: ISeriesState, kind: IJobKind): number => {
  const now = Date.now();
  if (series.direction === 'backward') {
    if (kind === 'head') return applyOverlapToRequestTime(series, now);
    return applyOverlapToRequestTime(series, computeTailTime(series, now));
  }

  const windowMs = series.last_window_ms ?? CONFIG.defaultForwardSeedWindowMs;
  if (kind === 'head') {
    if (series.union_end_ms !== undefined) return applyOverlapToRequestTime(series, series.union_end_ms);
    return applyOverlapToRequestTime(series, Math.max(0, now - windowMs));
  }
  return applyOverlapToRequestTime(series, computeTailTime(series, now));
};

const requestIngest = async (series: ISeriesState, time: number): Promise<ISeriesIngestResult> => {
  if (series.seriesType === 'ohlc') {
    const req: IIngestOHLCRequest = {
      product_id: series.product_id,
      duration: series.duration ?? '',
      direction: series.direction,
      time,
    };
    return terminal.client.requestForResponseData<IIngestOHLCRequest, ISeriesIngestResult>('IngestOHLC', req);
  }

  const req: IIngestInterestRateRequest = {
    product_id: series.product_id,
    direction: series.direction,
    time,
  };
  return terminal.client.requestForResponseData<IIngestInterestRateRequest, ISeriesIngestResult>(
    'IngestInterestRate',
    req,
  );
};

const executeJob = async (capState: ICapabilityState, job: IJob) => {
  const series = mapSeriesKeyToState.get(job.seriesKey);
  if (!series) return;

  if (job.kind === 'head') capState.pendingHead.delete(job.seriesKey);
  else capState.pendingTail.delete(job.seriesKey);

  try {
    const time = computeRequestTime(series, job.kind);
    const result = await requestIngest(series, time);

    capState.backoffMs = 0;
    capState.nextEligibleAt = 0;

    if (!result.range) {
      capState.backoffMs = computeBackoffMs(capState.backoffMs);
      capState.nextEligibleAt = Date.now() + capState.backoffMs;
      scheduleSeries(series);
      return;
    }

    const startMs = Date.parse(result.range.start_time);
    const endMs = Date.parse(result.range.end_time);
    if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
      series.last_window_ms = endMs - startMs;
    }

    const merged = await mergeRangesAndGetUnion(series.series_id, series.table_name);
    series.ranges = merged.segments;
    if (merged.union) {
      series.union_start_ms = merged.union.startMs;
      series.union_end_ms = merged.union.endMs;
    }

    scheduleSeries(series);
  } catch (e) {
    capState.backoffMs = computeBackoffMs(capState.backoffMs);
    capState.nextEligibleAt = Date.now() + capState.backoffMs;
    console.warn(
      formatTime(Date.now()),
      '[VEX][SeriesData]CapFailed',
      `cap=${capState.capKey}`,
      `backoff_ms=${capState.backoffMs}`,
      `${e}`,
    );
    scheduleSeries(series);
  }
};

const logQueuesIfNeeded = () => {
  const now = Date.now();
  if (now - lastQueueLogAt < LOG_QUEUE_INTERVAL_MS) return;
  lastQueueLogAt = now;

  const caps = capabilities
    .map((cap) => {
      const s = getOrCreateCapState(cap.capKey);
      return {
        capKey: cap.capKey,
        head: s.headQueue.size(),
        tail: s.tailQueue.size(),
        inflight: s.inflight,
        backoffMs: s.backoffMs,
        nextEligibleAt: s.nextEligibleAt,
      };
    })
    .filter((x) => x.inflight || x.head > 0 || x.tail > 0 || x.nextEligibleAt > now)
    .slice(0, 20)
    .map(
      (x) =>
        `cap=${x.capKey} head=${x.head} tail=${x.tail} inflight=${x.inflight ? 1 : 0} backoff_ms=${
          x.backoffMs
        }${x.nextEligibleAt > now ? ` next=${formatTime(x.nextEligibleAt)}` : ''}`,
    );

  console.info(
    formatTime(now),
    '[VEX][SeriesData]Queues',
    `inflight=${inflight}`,
    `cap_count=${capabilities.length}`,
    `global_head_backlog=${computeGlobalHeadBacklog()}`,
    `series_count=${mapSeriesKeyToState.size}`,
    caps.length ? `caps=[${caps.join(' | ')}]` : 'caps=[]',
  );
};

const computeGlobalHeadBacklog = (): number => {
  let total = 0;
  for (const s of mapCapKeyToState.values()) {
    total += s.headQueue.size();
  }
  return total;
};

const pickNextRunnableCap = (now: number): ICapabilityState | undefined => {
  if (capabilities.length === 0) return;
  const n = capabilities.length;
  for (let i = 0; i < n; i++) {
    const cap = capabilities[capRunIndex++ % n];
    const capState = getOrCreateCapState(cap.capKey);
    if (capState.inflight) continue;
    if (capState.nextEligibleAt > now) continue;
    if (capState.headQueue.size() === 0 && capState.tailQueue.size() === 0) continue;
    return capState;
  }
};

const dequeueFromCap = (
  capState: ICapabilityState,
  canRunTail: boolean,
): { job: IJob; kind: IJobKind } | undefined => {
  const head = capState.headQueue.dequeue();
  if (head) return { job: head, kind: 'head' };
  if (!canRunTail) return;
  const tail = capState.tailQueue.dequeue();
  if (!tail) return;
  return { job: tail, kind: 'tail' };
};

const scanProductsOnce = async () => {
  if (capabilities.length === 0) return;

  const now = Date.now();
  const cap = capabilities[scanIndex++ % capabilities.length];
  if (cap.nextScanAt > now) return;

  const where = [
    `product_id LIKE ${escapeSQL(`${cap.product_id_prefix}%`)}`,
    onlyProductIdPrefix ? `product_id LIKE ${escapeSQL(`${onlyProductIdPrefix}%`)}` : '',
    cap.seriesType === 'interest_rate' ? `COALESCE(no_interest_rate, false) = false` : '',
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
    `,
  );
  cap.nextScanAt = now + CONFIG.scanFullLoopIntervalMs;

  for (const row of rows) {
    if (cap.seriesType === 'ohlc') {
      for (const duration of cap.duration_list ?? []) {
        const series = getOrCreateSeriesState({
          capKey: cap.capKey,
          seriesType: 'ohlc',
          product_id: row.product_id,
          duration,
          direction: cap.direction,
        });
        scheduleSeries(series);
      }
    } else {
      const series = getOrCreateSeriesState({
        capKey: cap.capKey,
        seriesType: 'interest_rate',
        product_id: row.product_id,
        direction: cap.direction,
      });
      scheduleSeries(series);
    }
  }
};

const tick = async () => {
  if (!isEnabled) return;

  try {
    await scanProductsOnce();
  } catch (e) {
    console.error(formatTime(Date.now()), '[VEX][SeriesData]ScanFailed', `${e}`);
  }

  logQueuesIfNeeded();

  const now = Date.now();
  while (inflight < CONFIG.maxInflight) {
    const capState = pickNextRunnableCap(now);
    if (!capState) return;

    const globalHeadBacklog = computeGlobalHeadBacklog();
    const canRunTail =
      globalHeadBacklog < CONFIG.tailOnlyWhenGlobalHeadBelow && capState.headQueue.size() === 0;
    const next = dequeueFromCap(capState, canRunTail);
    if (!next) return;

    capState.inflight = true;
    inflight++;
    void executeJob(capState, next.job).finally(() => {
      capState.inflight = false;
      inflight--;
    });
  }
};

if (!isEnabled) {
  console.info(formatTime(Date.now()), '[VEX][SeriesData]Disabled', 'VEX_SERIES_DATA_ENABLED!=1');
} else {
  terminal.server.provideService('VEX/SeriesData/Peek', {}, async () => {
    const now = Date.now();
    const caps = capabilities.map((cap) => {
      const s = getOrCreateCapState(cap.capKey);
      return {
        capKey: cap.capKey,
        method: cap.method,
        product_id_prefix: cap.product_id_prefix,
        direction: cap.direction,
        head_queue_size: s.headQueue.size(),
        tail_queue_size: s.tailQueue.size(),
        inflight: s.inflight,
        backoff_ms: s.backoffMs,
        nextEligibleAt: s.nextEligibleAt > now ? formatTime(s.nextEligibleAt) : undefined,
      };
    });
    return {
      res: {
        code: 0,
        message: 'OK',
        data: {
          enabled: true,
          only_product_id_prefix: onlyProductIdPrefix || undefined,
          inflight,
          cap_count: capabilities.length,
          global_head_backlog: computeGlobalHeadBacklog(),
          series_count: mapSeriesKeyToState.size,
          caps: caps.slice(0, 50),
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
                    const capKey = encodePath('IngestOHLC', meta.product_id_prefix, meta.direction);
                    const existing = mapCapKeyToCapability.get(capKey);
                    const duration_list = [...new Set(meta.duration_list)].sort();
                    if (existing) {
                      existing.duration_list = duration_list;
                      return existing;
                    }
                    return {
                      capKey,
                      method: 'IngestOHLC',
                      seriesType: 'ohlc',
                      product_id_prefix: meta.product_id_prefix,
                      direction: meta.direction,
                      duration_list,
                      nextScanAt: 0,
                    };
                  }

                  const meta = parseInterestRateServiceMetadataFromSchema(serviceInfo.schema);
                  const capKey = encodePath('IngestInterestRate', meta.product_id_prefix, meta.direction);
                  const existing = mapCapKeyToCapability.get(capKey);
                  if (existing) return existing;
                  return {
                    capKey,
                    method: 'IngestInterestRate',
                    seriesType: 'interest_rate',
                    product_id_prefix: meta.product_id_prefix,
                    direction: meta.direction,
                    nextScanAt: 0,
                  };
                } catch {
                  console.info(
                    formatTime(Date.now()),
                    '[VEX][SeriesData]ParseServiceMetadataFailed',
                    `method=${serviceInfo.method}`,
                    `terminal_id=${terminalInfo.terminal_id}`,
                  );
                  return;
                }
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
      repeat({ delay: CONFIG.tickIntervalMs }),
    )
    .subscribe();
}
