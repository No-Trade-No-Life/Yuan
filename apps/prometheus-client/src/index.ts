import { Terminal } from '@yuants/protocol';
import { UUID, formatTime } from '@yuants/utils';
import { join } from 'path';
import { stringify } from 'querystring';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `PrometheusClient/${UUID()}`,
  name: `@yuants/app-prometheus-client`,
});

// See: https://prometheus.io/docs/prometheus/latest/querying/api/
const request = async (path: string, params: any) => {
  const url = new URL(process.env.PROM_API_ENDPOINT!);
  url.pathname = join(url.pathname, path);
  const body = stringify(params);
  console.info(formatTime(Date.now()), path, body);
  const res = await fetch(url.toString(), {
    method: 'POST',
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
terminal.provideService(
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
    const data = await request('/api/v1/query', msg.req);
    return { res: { code: 0, message: 'OK', data } };
  },
);

// Range Query
terminal.provideService(
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
    const data = await request('/api/v1/query_range', msg.req);
    return { res: { code: 0, message: 'OK', data } };
  },
);

// Metadata: Finding series by label matchers
terminal.provideService(
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
    const data = await request('/api/v1/series', msg.req);
    return { res: { code: 0, message: 'OK', data } };
  },
);

// Metadata: Getting label names
terminal.provideService(
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
    const data = await request('/api/v1/labels', msg.req);
    return { res: { code: 0, message: 'OK', data } };
  },
);

// Metadata: Querying label values
terminal.provideService(
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
    const data = await request(`/api/v1/label/${label_name}/values`, rest);
    return { res: { code: 0, message: 'OK', data } };
  },
);
