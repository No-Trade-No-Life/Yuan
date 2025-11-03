import type { DeploymentField } from '../constants';

export interface YuanCtlConfig {
  current_context?: string;
  preferences?: Record<string, unknown>;
  hosts: Record<
    string,
    {
      host_url: string;
      terminal_id?: string;
      tls_verify?: boolean;
      connect_timeout_ms?: number;
      reconnect_delay_ms?: number;
    }
  >;
  contexts?: Record<
    string,
    {
      host: string;
      default_node_unit?: string;
      terminal_id?: string;
    }
  >;
}

export interface ResolvedHostConfig {
  name: string;
  hostUrl: string;
  terminalId: string;
  tlsVerify?: boolean;
  connectTimeoutMs?: number;
  reconnectDelayMs?: number;
  defaultNodeUnit?: string;
}

export interface ResolvedClientConfig {
  contextName: string;
  host: ResolvedHostConfig;
  filters?: { field: DeploymentField; value: string }[];
}

export interface LoadConfigSuccess {
  ok: true;
  value: ResolvedClientConfig;
}

export interface LoadConfigFailure {
  ok: false;
  reason: 'NOT_FOUND' | 'INVALID';
  error?: Error;
}

export type LoadConfigResult = LoadConfigSuccess | LoadConfigFailure;
