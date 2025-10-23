import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { join } from 'path';
import { stringify } from 'querystring';

const terminal = Terminal.fromNodeEnv();

// See: https://prometheus.io/docs/prometheus/latest/querying/api/
const request = async (method: string, path: string, params: any) => {
  const url = new URL(process.env.PROM_API_ENDPOINT!);
  url.pathname = join(url.pathname, path);
  const body = stringify(params);
  console.info(formatTime(Date.now()), path, body);
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${process.env.BASIC_AUTH_USERNAME}:${process.env.BASIC_AUTH_PASSWORD}`)}`,
    },
    body,
  });
  console.info(formatTime(Date.now()), path, body, res.status, res.statusText);
  return res.json();
};

// Instant Query
terminal.server.provideService(
  'prometheus/query',
  {
    required: ['query'],
    properties: {
      query: { type: 'string' },
      time: { type: 'string' },
      timeout: { type: 'string' },
    },
  },
  async (msg) => {
    const data = await request('POST', '/api/v1/query', msg.req);
    return { res: { code: 0, message: 'OK', data } };
  },
);

// Range Query
terminal.server.provideService(
  'prometheus/query_range',
  {
    required: ['query', 'start', 'end', 'step'],
    properties: {
      query: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      step: { type: 'string' },
      timeout: { type: 'string' },
    },
  },
  async (msg) => {
    const data = await request('POST', '/api/v1/query_range', msg.req);
    return { res: { code: 0, message: 'OK', data } };
  },
);

// Metadata: Finding series by label matchers
terminal.server.provideService(
  'prometheus/series',
  {
    required: ['match', 'start', 'end'],
    properties: {
      match: { type: 'array', items: { type: 'string' } },
      start: { type: 'string' },
      end: { type: 'string' },
      limit: { type: 'number' },
    },
  },
  async (msg) => {
    const data = await request('POST', '/api/v1/series', msg.req);
    return { res: { code: 0, message: 'OK', data } };
  },
);

// Metadata: Getting label names
terminal.server.provideService(
  'prometheus/labels',
  {
    properties: {
      start: { type: 'string' },
      end: { type: 'string' },
      match: { type: 'array', items: { type: 'string' } },
      limit: { type: 'number' },
    },
  },
  async (msg) => {
    const data = await request('POST', '/api/v1/labels', msg.req);
    return { res: { code: 0, message: 'OK', data } };
  },
);

// Metadata: Querying label values
terminal.server.provideService(
  'prometheus/label_values',
  {
    required: ['label_name'],
    properties: {
      label_name: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      match: { type: 'array', items: { type: 'string' } },
      limit: { type: 'number' },
    },
  },
  async (msg) => {
    const { label_name, ...rest } = msg.req! as {
      label_name: string;
      start?: string;
      end?: string;
      matchers?: string[];
      limit?: number;
    };
    const data = await request('POST', `/api/v1/label/${label_name}/values`, rest);
    return { res: { code: 0, message: 'OK', data } };
  },
);

// List Alerts
terminal.server.provideService('prometheus/alerts', {}, async (msg) => {
  const data = await request('GET', '/api/v1/alerts', {});
  return { res: { code: 0, message: 'OK', data } };
});
