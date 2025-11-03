export const DEPLOYMENT_TABLE = 'deployment';

export const DEPLOYMENT_FIELDS = [
  'id',
  'package_name',
  'package_version',
  'command',
  'args',
  'env',
  'address',
  'enabled',
  'created_at',
  'updated_at',
] as const;

export type DeploymentField = (typeof DEPLOYMENT_FIELDS)[number];

export const BOOLEAN_FIELDS: ReadonlySet<string> = new Set(['enabled']);

export const DEFAULT_TAIL_LINES = 200;
export const MAX_TAIL_LINES = 10_000;
export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
export const DEFAULT_RECONNECT_DELAY_MS = 2_000;
export const DEFAULT_WATCH_POLL_INTERVAL_MS = 2_000;
export const DEFAULT_WATCH_RETRY_MS = 2_000;

export const DEFAULT_CONTEXT_NAME = 'default';
