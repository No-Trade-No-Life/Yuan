import { PlannedEffect } from '@yuants/signal-trader';
import { encodePath } from '@yuants/utils';
import {
  AdapterExecutionResult,
  LiveExecutionVenue,
  OrderBindingRepository,
  SignalTraderOrderBinding,
  SignalTraderRuntimeConfig,
  SignalTraderTransferConfig,
  SignalTraderTransferDirection,
  SignalTraderTransferOrder,
  TransferCapableExecutionAdapter,
  TypedCredential,
} from '../types';

export class LiveExecutionAdapter<T = unknown> implements TransferCapableExecutionAdapter {
  constructor(
    private readonly orderBindingRepository: OrderBindingRepository,
    private readonly resolveLiveCredential: (
      runtime: SignalTraderRuntimeConfig,
    ) => Promise<TypedCredential<T>>,
    private readonly venue: LiveExecutionVenue<T>,
  ) {}

  async execute(runtime: SignalTraderRuntimeConfig, rawEffects: unknown[]): Promise<AdapterExecutionResult> {
    const effects = rawEffects as PlannedEffect[];
    if (effects.some((item) => item.effect_type === 'modify_order')) {
      return { commands: [], bindings: [], lock_reason: 'MODIFY_ORDER_NOT_SUPPORTED_IN_LIVE_V1' };
    }

    const credential = await this.resolveLiveCredential(runtime);
    const bindings: SignalTraderOrderBinding[] = [];
    const commands: AdapterExecutionResult['commands'] = [];

    for (const effect of effects) {
      const { account_id } = await this.venue.authorizeOrder({ credential, effect });
      if (account_id !== runtime.account_id) {
        return { commands: [], bindings: [], lock_reason: 'AUTHORIZE_ORDER_ACCOUNT_MISMATCH' };
      }

      if (effect.effect_type === 'place_order') {
        const existingInFlight = await this.orderBindingRepository.listInFlight(
          runtime.runtime_id,
          effect.product_id,
        );
        if (existingInFlight.some((item) => item.internal_order_id !== effect.order_id)) {
          return { commands: [], bindings: [], lock_reason: 'MULTIPLE_IN_FLIGHT_EXTERNAL_ORDER_DETECTED' };
        }
        const result = await this.venue.submitOrder({
          credential,
          runtime,
          internal_order_id: effect.order_id,
          signal_id: effect.signal_id,
          product_id: effect.product_id,
          size: effect.size,
          stop_loss_price: effect.stop_loss_price,
        });
        if (!result.external_submit_order_id || !result.external_operate_order_id) {
          return { commands: [], bindings: [], lock_reason: 'MISSING_EXTERNAL_ORDER_IDS' };
        }
        const binding: SignalTraderOrderBinding = {
          runtime_id: runtime.runtime_id,
          internal_order_id: effect.order_id,
          external_submit_order_id: result.external_submit_order_id,
          external_operate_order_id: result.external_operate_order_id,
          account_id,
          product_id: effect.product_id,
          signal_id: effect.signal_id,
          submit_effect_id: encodePath('live', runtime.runtime_id, effect.order_id),
          binding_status: 'submitted',
          observer_backend: runtime.observer_backend,
          first_submitted_at_ms: Date.now(),
          terminal_status_changed_at_ms: Date.now(),
          last_observed_source: 'live_submit',
          last_observed_at_ms: Date.now(),
        };
        bindings.push(binding);
        commands.push({
          command_type: 'apply_execution_report',
          order_id: effect.order_id,
          report_id: encodePath('live', 'accepted', result.external_operate_order_id),
          product_id: effect.product_id,
          status: 'accepted',
          reported_at: Date.now(),
          raw_report: {
            source: 'live_submit',
            external_submit_order_id: result.external_submit_order_id,
            external_operate_order_id: result.external_operate_order_id,
          },
        });
        continue;
      }

      if (effect.effect_type === 'cancel_order') {
        const binding = await this.orderBindingRepository.get(runtime.runtime_id, effect.order_id);
        if (!binding?.external_operate_order_id) {
          return { commands: [], bindings: [], lock_reason: 'MISSING_EXTERNAL_OPERATE_ORDER_ID' };
        }
        await this.venue.cancelOrder({
          credential,
          runtime,
          internal_order_id: effect.order_id,
          external_operate_order_id: binding.external_operate_order_id,
          product_id: effect.product_id,
        });
      }
    }

    return { commands, bindings };
  }

  async queryTradingBalance(runtime: SignalTraderRuntimeConfig) {
    if (!this.venue.queryTradingBalance) {
      throw new Error('LIVE_TRANSFER_NOT_CONFIGURED');
    }
    const credential = await this.resolveLiveCredential(runtime);
    return this.venue.queryTradingBalance({ credential, runtime });
  }

  async findActiveTransfer(
    runtime: SignalTraderRuntimeConfig,
    transfer: SignalTraderTransferConfig,
  ): Promise<SignalTraderTransferOrder | undefined> {
    if (!this.venue.findActiveTransfer) {
      throw new Error('LIVE_TRANSFER_NOT_CONFIGURED');
    }
    const credential = await this.resolveLiveCredential(runtime);
    return this.venue.findActiveTransfer({ credential, runtime, transfer });
  }

  async submitTransfer(input: {
    runtime: SignalTraderRuntimeConfig;
    transfer: SignalTraderTransferConfig;
    direction: SignalTraderTransferDirection;
    amount: number;
  }): Promise<SignalTraderTransferOrder> {
    if (!this.venue.submitTransfer) {
      throw new Error('LIVE_TRANSFER_NOT_CONFIGURED');
    }
    const credential = await this.resolveLiveCredential(input.runtime);
    return this.venue.submitTransfer({ credential, ...input });
  }

  async pollTransfer(input: {
    runtime: SignalTraderRuntimeConfig;
    transfer: SignalTraderTransferConfig;
    order_id: string;
  }): Promise<SignalTraderTransferOrder> {
    if (!this.venue.pollTransfer) {
      throw new Error('LIVE_TRANSFER_NOT_CONFIGURED');
    }
    const credential = await this.resolveLiveCredential(input.runtime);
    return this.venue.pollTransfer({ credential, ...input });
  }
}
