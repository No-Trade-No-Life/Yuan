export interface IAlertMessageEntry {
  receiver_id: string;
  message_id: string;
}

export interface IAlertRecord {
  id: string;
  alert_name: string;
  current_value?: string;
  /** 'firing' | 'resolved' */
  status: string;
  /** 'UNKNOWN' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' */
  severity: string;
  description?: string;
  env: string;
  runbook_url?: string;
  group_name: string;
  finalized: boolean;
  start_time: string;
  end_time?: string;
  message_ids?: IAlertMessageEntry[];
  created_at?: string;
  updated_at?: string;
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
