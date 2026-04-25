import { CaptureAuthorizedAccountSnapshotCommand } from '@yuants/signal-trader';
import { encodePath } from '@yuants/utils';
import { NormalizeObservationInput } from '../types';

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
};

const mapHistoryStatus = (status?: string) => {
  switch ((status ?? '').toUpperCase()) {
    case 'FILLED':
      return 'filled' as const;
    case 'PARTIALLY_FILLED':
      return 'partially_filled' as const;
    case 'CANCELLED':
      return 'cancelled' as const;
    case 'REJECTED':
      return 'rejected' as const;
    case 'ACCEPTED':
    case 'LIVE':
    case 'OPEN':
      return 'accepted' as const;
    default:
      return undefined;
  }
};

export const normalizeObservation = (input: NormalizeObservationInput) => {
  if (!input.binding.external_operate_order_id) {
    return { commands: [], lock_reason: 'MISSING_EXTERNAL_OPERATE_ORDER_ID' };
  }

  const commands: Array<ReturnType<typeof buildExecutionCommand> | CaptureAuthorizedAccountSnapshotCommand> =
    [];

  if (input.account_snapshot) {
    commands.push({
      command_type: 'capture_authorized_account_snapshot',
      snapshot_id: encodePath(
        'account-snapshot',
        input.runtime.runtime_id,
        input.account_snapshot.updated_at,
      ),
      account_id: input.account_snapshot.account_id,
      balance: Number(input.account_snapshot.money.balance),
      captured_at: input.account_snapshot.updated_at,
      metadata: { source: 'observer' },
    });
  }

  const historyStatus = mapHistoryStatus(input.history_order?.order_status);
  if (historyStatus) {
    commands.push(
      buildExecutionCommand({
        binding: input.binding,
        product_id: input.binding.product_id,
        report_id: encodePath('observe', 'history', input.binding.external_operate_order_id, historyStatus),
        status: historyStatus,
        filled_qty: toNumber(input.history_order?.traded_volume),
        avg_fill_price: toNumber(input.history_order?.traded_price),
        now_ms: input.now_ms,
      }),
    );
    return { commands };
  }

  if (input.open_order) {
    commands.push(
      buildExecutionCommand({
        binding: input.binding,
        product_id: input.binding.product_id,
        report_id: encodePath('observe', 'open', input.binding.external_operate_order_id),
        status: toNumber(input.open_order.traded_volume) ? 'partially_filled' : 'accepted',
        filled_qty: toNumber(input.open_order.traded_volume),
        avg_fill_price: toNumber(input.open_order.traded_price),
        now_ms: input.now_ms,
      }),
    );
    return { commands };
  }

  return { commands, lock_reason: 'MISSING_TERMINAL_OBSERVATION' };
};

const buildExecutionCommand = (input: {
  binding: NormalizeObservationInput['binding'];
  product_id: string;
  report_id: string;
  status: 'accepted' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected';
  filled_qty?: number;
  avg_fill_price?: number;
  now_ms?: number;
}) => ({
  command_type: 'apply_execution_report' as const,
  order_id: input.binding.internal_order_id,
  report_id: input.report_id,
  product_id: input.product_id,
  status: input.status,
  filled_qty: input.filled_qty,
  avg_fill_price: input.avg_fill_price,
  fee: 0,
  reported_at: input.now_ms ?? Date.now(),
  raw_report: { source: 'observation_normalizer' },
});
