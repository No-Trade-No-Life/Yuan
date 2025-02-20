import { formatTime, UUID } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import type {} from '@yuants/sql';
import postgres from 'postgres';

const HOST_URL = process.env.HOST_URL!;
const TERMINAL_ID = process.env.TERMINAL_ID || `Postgres/${UUID()}`;
const terminal = new Terminal(HOST_URL, {
  terminal_id: TERMINAL_ID,
  enable_WebRTC: process.env.ENABLE_WEBRTC === 'true',
  name: 'Postgres Storage',
});

const sql = postgres(process.env.POSTGRES_URI!);

terminal.provideService('SQL', {}, async (msg) => {
  console.info(formatTime(Date.now()), 'SQL REQUEST', msg.trace_id, msg.req.query.replace(/\s+/g, ' '));
  const results = await sql.unsafe(msg.req.query);
  console.info(formatTime(Date.now()), 'SQL RESPONSE', msg.trace_id, results.length);
  return { res: { code: 0, message: 'OK', data: results } };
});
