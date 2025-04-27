import { formatTime, UUID } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import type {} from '@yuants/sql';
// import { Pool } from 'pg';
// import { parse } from 'pg-connection-string';
import postgres from 'postgres';
import { first, from, tap } from 'rxjs';

const HOST_URL = process.env.HOST_URL!;
const TERMINAL_ID = process.env.TERMINAL_ID || `Postgres/${UUID()}`;
const terminal = new Terminal(HOST_URL, {
  terminal_id: TERMINAL_ID,
  enable_WebRTC: process.env.ENABLE_WEBRTC === 'true',
  name: 'Postgres Storage',
});

const sql = postgres(process.env.POSTGRES_URI!, {
  // ISSUE: automatically close the connection after 20 seconds of inactivity or 30 minutes of lifetime
  //   otherwise, the connection will not be closed and will cause the client memory to leak
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

// const config = parse(process.env.POSTGRES_URI!);
// //@ts-ignore
// config.ssl = {
//   rejectUnauthorized: false,
// };

// // @ts-ignore
// const pool = new Pool({
//   max: 20,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 2000,
//   keepAlive: true,
//   ...config,
// });

terminal.provideService(
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
      console.info(formatTime(Date.now()), 'SQL RESPONSE', msg.trace_id, results.length);
      return { res: { code: 0, message: 'OK', data: results } };
    } catch (e) {
      console.error(formatTime(Date.now()), 'SQL ERROR', msg.trace_id, e);
      throw e;
    }
  },
);
