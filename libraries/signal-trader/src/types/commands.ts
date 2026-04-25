import { encodePath } from '@yuants/utils';

export type SignalValue = -1 | 0 | 1;

export interface SubmitSignalCommand {
  command_type: 'submit_signal';
  signal_id: string;
  signal_key: string;
  product_id: string;
  signal: SignalValue;
  source: 'model' | 'manual' | 'agent';
  entry_price?: number;
  reference_price?: number;
  reference_price_source?: string;
  reference_price_datasource_id?: string;
  reference_price_updated_at?: string;
  stop_loss_price?: number;
  upstream_emitted_at?: number;
  metadata?: Record<string, unknown>;
}

export interface UpsertSubscriptionCommand {
  command_type: 'upsert_subscription';
  subscription_id: string;
  investor_id: string;
  signal_key: string;
  product_id: string;
  vc_budget: number;
  daily_burn_amount: number;
  profit_target_value?: number;
  signing_public_key?: string;
  reserve_account_ref?: string;
  status: 'active' | 'paused' | 'closed';
  effective_at: number;
  contract_multiplier?: number;
  lot_size?: number;
}

export interface ApplyExecutionReportCommand {
  command_type: 'apply_execution_report';
  order_id: string;
  report_id: string;
  product_id: string;
  status: 'accepted' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected' | 'stop_triggered';
  filled_qty?: number;
  avg_fill_price?: number;
  fee?: number;
  reported_at: number;
  raw_report?: Record<string, unknown>;
}

export interface CaptureAuthorizedAccountSnapshotCommand {
  command_type: 'capture_authorized_account_snapshot';
  snapshot_id: string;
  account_id: string;
  balance: number;
  equity?: number;
  captured_at: number;
  metadata?: Record<string, unknown>;
}

export interface RestoreAuditModeCommand {
  command_type: 'restore_audit_mode';
  recovery_id: string;
  account_id: string;
  restored_at: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export type DomainCommand =
  | SubmitSignalCommand
  | UpsertSubscriptionCommand
  | ApplyExecutionReportCommand
  | CaptureAuthorizedAccountSnapshotCommand
  | RestoreAuditModeCommand;

export const getCommandIdempotencyKey = (command: DomainCommand): string => {
  switch (command.command_type) {
    case 'submit_signal':
      return encodePath(command.command_type, command.signal_id);
    case 'upsert_subscription':
      return encodePath(command.command_type, command.subscription_id, command.effective_at);
    case 'apply_execution_report':
      return encodePath(command.command_type, command.report_id);
    case 'capture_authorized_account_snapshot':
      return encodePath(command.command_type, command.snapshot_id);
    case 'restore_audit_mode':
      return encodePath(command.command_type, command.recovery_id);
  }
};
