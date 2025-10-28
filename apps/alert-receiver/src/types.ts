import type { JSONSchema7 } from 'json-schema';

export interface IAlertRecord {
  id: string;
  alert_name: string;
  current_value?: string;
  /** 'firing' | 'resolved' */
  status: string;
  /** 'UNKNOWN' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' */
  severity: string;
  summary?: string;
  description?: string;
  env: string;
  runbook_url?: string;
  group_name: string;
  labels: Record<string, string>;
  finalized: boolean;
  start_time: string;
  end_time?: string;
  message_ids?: IAlertMessageEntry[];
  created_at?: string;
  updated_at?: string;
}

export interface IAlertMessageEntry {
  route_id: string;
  message_id: string;
}

export interface IAlertGroup {
  alert_name: string;
  group_key: string;
  severity: string;
  alerts: IAlertRecord[];
  /** 'Firing' | 'PartialResolved' | 'Resolved' */
  status: string;
  finalized: boolean;
  version: string;
}

export interface IAlertReceiveRoute {
  chat_id: string;
  /**
   * 接收者会被加急的最低告警级别
   *
   * UNKNOWN > CRITICAL > ERROR > WARNING > INFO
   *
   * 例如，route 设置为 ERROR，则 ERROR, CRITICAL, UNKNOWN 级别的告警都会加急发送给该接收者
   */
  urgent_on_severity: string;
  urgent_user_list: string[];
  // 'app' | 'sms' | 'phone'
  urgent_type: string;
  label_schema?: JSONSchema7;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
