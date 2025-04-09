import { formatTime, UUID } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import type {} from '@yuants/sql';
import { Pool } from 'pg';
import { parse } from 'pg-connection-string';
import { first, from } from 'rxjs';

const HOST_URL = process.env.HOST_URL!;
const TERMINAL_ID = process.env.TERMINAL_ID || `Postgres/${UUID()}`;
const terminal = new Terminal(HOST_URL, {
  terminal_id: TERMINAL_ID,
  enable_WebRTC: process.env.ENABLE_WEBRTC === 'true',
  name: 'Postgres Storage',
});

const config = parse(process.env.POSTGRES_URI!);
//@ts-ignore
config.ssl = {
  rejectUnauthorized: false,
};

// @ts-ignore
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  keepAlive: true,
  ...config,
});

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
    const sql = await pool.connect();
    // @ts-ignore
    const query = sql.query(msg.req.query);
    from(isAborted$)
      .pipe(first((x) => x))
      .subscribe(() => {
        console.info(formatTime(Date.now()), 'SQL ABORTED', msg.trace_id);
        sql.release();
        throw new Error('Aborted');
      });
    const results = await query;
    sql.release();
    const rows = Array.isArray(results) ? results.map((result) => result.rows) : results.rows;
    // @ts-ignore
    console.info(formatTime(Date.now()), 'SQL RESPONSE', msg.trace_id, rows.length);
    return { res: { code: 0, message: 'OK', data: rows } };
  },
);
