import { Terminal } from '@yuants/protocol';
import type {} from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import postgres from 'postgres';
import { first, from, tap } from 'rxjs';

const terminal = Terminal.fromNodeEnv();
// 创建指标
const MetricsPostgresStorageRequestTotal = terminal.metrics
  .counter('postgres_storage_request_total', '')
  .labels({ terminal_id: terminal.terminal_id });

const MetricsPostgresStorageRequestDurationMs = terminal.metrics
  .histogram(
    'postgres_storage_request_duration_milliseconds',
    'postgres_storage_request_duration',
    [10, 50, 100, 500, 1000, 2000, 5000, 10000],
  )
  .labels({ terminal_id: terminal.terminal_id });

const totalSuccess = MetricsPostgresStorageRequestTotal.labels({ status: 'success' });
const durationWhenSuccess = MetricsPostgresStorageRequestDurationMs.labels({ status: 'success' });
const totalError = MetricsPostgresStorageRequestTotal.labels({ status: 'error' });
const durationWhenError = MetricsPostgresStorageRequestDurationMs.labels({ status: 'error' });

const sql = postgres(process.env.POSTGRES_URI!, {
  // ISSUE: automatically close the connection after 20 seconds of inactivity or 30 minutes of lifetime
  //   otherwise, the connection will not be closed and will cause the client memory to leak
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  max: 20,
});

terminal.server.provideService(
  'SQL',
  {
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'SQL query to execute',
      },
    },
  },
  async (msg, { isAborted$ }) => {
    console.info(formatTime(Date.now()), 'SQL REQUEST', msg.trace_id);
    const startTime = Date.now();
    // 从msg中获取source_terminal_id
    const source_terminal_id = msg.source_terminal_id || 'unknown';
    // @ts-ignore
    const query = sql.unsafe(msg.req.query);

    from(isAborted$)
      .pipe(
        //
        first((x) => x),
        tap(() => {
          console.info(formatTime(Date.now()), 'SQL ABORTED', msg.trace_id);
          // ISSUE: cancel will break the sql query, which will cause the query to fail and be caught in the catch block
          query.cancel();
        }),
      )
      .subscribe();

    try {
      const results = await query;
      const duration = Date.now() - startTime;
      console.info(formatTime(Date.now()), 'SQL RESPONSE', msg.trace_id, results.length);

      // 记录成功请求，添加source_terminal_id标签
      totalSuccess.inc();
      durationWhenSuccess.observe(duration);

      return { res: { code: 0, message: 'OK', data: results } };
    } catch (e) {
      const duration = Date.now() - startTime;
      console.error(formatTime(Date.now()), 'SQL ERROR', msg.trace_id, e);

      // 记录失败请求，添加source_terminal_id标签
      totalError.inc();
      durationWhenError.observe(duration);

      throw e;
    }
  },
);

// SQL v2: 支持流式返回结果，需要在 requestSQL 中使用 for await 进行迭代
terminal.server.provideService(
  'SQL/v2',
  {
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'SQL query to execute',
      },
    },
  },
  async function* (msg, { isAborted$ }) {
    console.info(formatTime(Date.now()), 'SQL REQUEST', msg.trace_id);
    const startTime = Date.now();
    // 从msg中获取source_terminal_id
    const source_terminal_id = msg.source_terminal_id || 'unknown';
    // @ts-ignore
    const query = sql.unsafe(msg.req.query);

    from(isAborted$)
      .pipe(
        //
        first((x) => x),
        tap(() => {
          console.info(formatTime(Date.now()), 'SQL ABORTED', msg.trace_id);
          // ISSUE: cancel will break the sql query, which will cause the query to fail and be caught in the catch block
          query.cancel();
        }),
      )
      .subscribe();

    try {
      const cursor = query.cursor(1000);
      for await (const rows of cursor) {
        yield { frame: { data: rows } };
      }
      // 记录成功请求，添加source_terminal_id标签
      totalSuccess.inc();
      return { res: { code: 0, message: 'OK' } };
    } catch (e) {
      const duration = Date.now() - startTime;
      console.error(formatTime(Date.now()), 'SQL ERROR', msg.trace_id, e);

      // 记录失败请求，添加source_terminal_id标签
      totalError.inc();
      durationWhenError.observe(duration);

      throw e;
    }
  },
);
