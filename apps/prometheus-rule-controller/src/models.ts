export interface IPrometheusRule {
  id: string;
  group_name: string;
  // alerting || recording
  type: string;
  name: string;
  expr: string;

  alert_for?: string;
  alert_keep_firing_for?: string;

  record?: string;

  labels: Record<string, string>;
  annotations: Record<string, string>;

  created_at: string;
  updated_at: string;
}

export interface IRawPrometheusRuleGroup {
  name: string;
  rules: IRawPrometheusRule[];
}

export interface IRawPrometheusRule {
  // alerting rule
  alert?: string;
  expr: string;
  for?: string;
  keep_firing_for?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;

  // recording rule
  record?: string;
}
