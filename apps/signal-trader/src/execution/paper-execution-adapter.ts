import { IAccountInfo } from '@yuants/data-account';
import { ApplyExecutionReportCommand, PlannedEffect } from '@yuants/signal-trader';
import { encodePath } from '@yuants/utils';
import { PaperAccountLedger, buildPaperMockAccountId } from './paper-account-ledger';
import {
  AdapterExecutionResult,
  SignalTraderOrderBinding,
  SignalTraderRuntimeConfig,
  SignalTraderTransferConfig,
  SignalTraderTransferDirection,
  SignalTraderTransferOrder,
  TransferCapableExecutionAdapter,
} from '../types';

const makeBinding = (
  runtime: SignalTraderRuntimeConfig,
  effect: Extract<PlannedEffect, { effect_type: 'place_order' }>,
): SignalTraderOrderBinding => ({
  runtime_id: runtime.runtime_id,
  internal_order_id: effect.order_id,
  external_submit_order_id: effect.order_id,
  external_operate_order_id: effect.order_id,
  account_id: runtime.account_id,
  product_id: effect.product_id,
  signal_id: effect.signal_id,
  submit_effect_id: encodePath('paper', runtime.runtime_id, effect.order_id),
  binding_status: 'accepted',
  observer_backend: runtime.observer_backend,
  first_submitted_at_ms: Date.now(),
  terminal_status_changed_at_ms: Date.now(),
  last_observed_source: 'paper_simulated',
  last_observed_at_ms: Date.now(),
});

type PaperTransferState = {
  mock_account_id: string;
  trading_balance: number;
  active_transfer?: SignalTraderTransferOrder;
  transfer_history: Map<string, SignalTraderTransferOrder>;
};

type PaperMockFillContext = {
  signal_id: string;
  product_id: string;
  entry_price?: number;
  reference_price?: number;
};

type PaperResolvedFillPrice = {
  fill_price: number;
  source: 'entry_price' | 'reference_price' | 'last_price' | 'position_price' | 'fallback_1';
};

const isValidPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export class PaperExecutionAdapter implements TransferCapableExecutionAdapter {
  private readonly transferStateByRuntime = new Map<string, PaperTransferState>();
  private readonly mockFillContextByRuntime = new Map<string, Map<string, PaperMockFillContext>>();
  private readonly ledger = new PaperAccountLedger();
  private readonly mockAccountListeners = new Map<string, Set<(accountInfo: IAccountInfo) => void>>();

  private ensureTransferState(runtime: SignalTraderRuntimeConfig): PaperTransferState {
    const mockAccountId = buildPaperMockAccountId(runtime);
    const current = this.transferStateByRuntime.get(runtime.runtime_id);
    if (current && current.mock_account_id === mockAccountId) return current;
    const next: PaperTransferState = {
      mock_account_id: mockAccountId,
      trading_balance: 0,
      transfer_history: new Map(),
    };
    this.transferStateByRuntime.set(runtime.runtime_id, next);
    return next;
  }

  private makeMockFillContextKey(signal_id: string, product_id: string) {
    return encodePath(signal_id, product_id);
  }

  private resolveFillPrice(
    runtime: SignalTraderRuntimeConfig,
    context?: PaperMockFillContext,
  ): PaperResolvedFillPrice {
    const position = this.ledger
      .getAccountInfo(runtime)
      .positions.find((item) => item.product_id === context?.product_id);
    if (isValidPrice(context?.entry_price)) return { fill_price: context.entry_price, source: 'entry_price' };
    if (isValidPrice(context?.reference_price)) {
      return { fill_price: context.reference_price, source: 'reference_price' };
    }
    const ledgerLastPrice = context?.product_id
      ? this.ledger.getLastPrice(runtime, context.product_id)
      : undefined;
    if (isValidPrice(ledgerLastPrice)) return { fill_price: ledgerLastPrice, source: 'last_price' };
    const lastPrice = position?.current_price ? Number(position.current_price) : undefined;
    if (isValidPrice(lastPrice)) return { fill_price: lastPrice, source: 'last_price' };
    if (isValidPrice(position?.position_price))
      return { fill_price: position.position_price, source: 'position_price' };
    return { fill_price: 1, source: 'fallback_1' };
  }

  private emitMockAccountInfo(runtime: SignalTraderRuntimeConfig, accountInfo: IAccountInfo) {
    for (const listener of this.mockAccountListeners.get(runtime.runtime_id) ?? []) {
      listener(accountInfo);
    }
  }

  setMockFillContext(runtime: SignalTraderRuntimeConfig, context: PaperMockFillContext) {
    const current =
      this.mockFillContextByRuntime.get(runtime.runtime_id) ?? new Map<string, PaperMockFillContext>();
    current.set(this.makeMockFillContextKey(context.signal_id, context.product_id), context);
    this.mockFillContextByRuntime.set(runtime.runtime_id, current);
  }

  getMockAccountInfo(runtime: SignalTraderRuntimeConfig) {
    return this.ledger.getAccountInfo(runtime);
  }

  getMockAccountInfoByAccountId(account_id: string) {
    return this.ledger.getAccountInfoByAccountId(account_id);
  }

  subscribeMockAccountInfo(runtime: SignalTraderRuntimeConfig, handler: (accountInfo: IAccountInfo) => void) {
    const listeners =
      this.mockAccountListeners.get(runtime.runtime_id) ?? new Set<(accountInfo: IAccountInfo) => void>();
    listeners.add(handler);
    this.mockAccountListeners.set(runtime.runtime_id, listeners);
    handler(this.getMockAccountInfo(runtime));
    return () => {
      const current = this.mockAccountListeners.get(runtime.runtime_id);
      current?.delete(handler);
      if (current?.size === 0) this.mockAccountListeners.delete(runtime.runtime_id);
    };
  }

  async execute(runtime: SignalTraderRuntimeConfig, rawEffects: unknown[]): Promise<AdapterExecutionResult> {
    const effects = rawEffects as PlannedEffect[];
    const commands: ApplyExecutionReportCommand[] = [];
    const bindings: SignalTraderOrderBinding[] = [];
    const runtimeContexts = this.mockFillContextByRuntime.get(runtime.runtime_id);

    for (const effect of effects) {
      if (effect.effect_type === 'place_order') {
        const fillContext: PaperMockFillContext = runtimeContexts?.get(
          this.makeMockFillContextKey(effect.signal_id, effect.product_id),
        ) ?? {
          signal_id: effect.signal_id,
          product_id: effect.product_id,
        };
        const resolvedFillPrice = this.resolveFillPrice(runtime, fillContext);
        runtimeContexts?.delete(this.makeMockFillContextKey(effect.signal_id, effect.product_id));

        bindings.push(makeBinding(runtime, effect));
        commands.push({
          command_type: 'apply_execution_report',
          order_id: effect.order_id,
          report_id: encodePath('paper', 'accepted', effect.order_id),
          product_id: effect.product_id,
          status: 'accepted',
          reported_at: Date.now(),
          raw_report: { source: 'paper_simulated' },
        });
        commands.push({
          command_type: 'apply_execution_report',
          order_id: effect.order_id,
          report_id: encodePath('paper', 'filled', effect.order_id),
          product_id: effect.product_id,
          status: 'filled',
          filled_qty: Math.abs(effect.size),
          avg_fill_price: resolvedFillPrice.fill_price,
          fee: 0,
          reported_at: Date.now(),
          raw_report: {
            source: 'paper_simulated',
            runtime_id: runtime.runtime_id,
            signal_id: effect.signal_id,
            product_id: effect.product_id,
            entry_price: fillContext?.entry_price,
            reference_price: fillContext?.reference_price,
            resolved_fill_price: resolvedFillPrice.fill_price,
            fill_price_source: resolvedFillPrice.source,
          },
        });
        this.emitMockAccountInfo(
          runtime,
          this.ledger.applyFill(runtime, {
            product_id: effect.product_id,
            size: effect.size,
            fill_price: resolvedFillPrice.fill_price,
          }),
        );
      }

      if (effect.effect_type === 'cancel_order') {
        commands.push({
          command_type: 'apply_execution_report',
          order_id: effect.order_id,
          report_id: encodePath('paper', 'cancelled', effect.order_id),
          product_id: effect.product_id,
          status: 'cancelled',
          reported_at: Date.now(),
          raw_report: { source: 'paper_simulated' },
        });
      }
    }

    if (runtimeContexts?.size === 0) this.mockFillContextByRuntime.delete(runtime.runtime_id);
    return { commands, bindings };
  }

  async queryTradingBalance(runtime: SignalTraderRuntimeConfig) {
    const transfer = runtime.metadata?.signal_trader_transfer as Record<string, unknown> | undefined;
    return {
      balance: this.ensureTransferState(runtime).trading_balance,
      currency: typeof transfer?.currency === 'string' ? transfer.currency : undefined,
    };
  }

  async findActiveTransfer(
    runtime: SignalTraderRuntimeConfig,
    _transfer: SignalTraderTransferConfig,
  ): Promise<SignalTraderTransferOrder | undefined> {
    return this.ensureTransferState(runtime).active_transfer;
  }

  async submitTransfer(input: {
    runtime: SignalTraderRuntimeConfig;
    transfer: SignalTraderTransferConfig;
    direction: SignalTraderTransferDirection;
    amount: number;
  }): Promise<SignalTraderTransferOrder> {
    const state = this.ensureTransferState(input.runtime);
    const now = new Date().toISOString();
    const ledgerResult = this.ledger.applyTransfer(input.runtime, input.direction, input.amount);
    const order: SignalTraderTransferOrder = {
      order_id: encodePath('paper-transfer', input.runtime.runtime_id, input.direction, Date.now()),
      created_at: now,
      updated_at: now,
      credit_account_id:
        input.direction === 'funding_to_trading'
          ? input.transfer.funding_account_id
          : input.runtime.account_id,
      debit_account_id:
        input.direction === 'funding_to_trading'
          ? input.runtime.account_id
          : input.transfer.funding_account_id,
      currency: input.transfer.currency,
      expected_amount: ledgerResult.actual_amount,
      status: 'COMPLETE',
      runtime_id: input.runtime.runtime_id,
    };
    state.trading_balance +=
      input.direction === 'funding_to_trading' ? ledgerResult.actual_amount : -ledgerResult.actual_amount;
    state.active_transfer = undefined;
    state.transfer_history.set(order.order_id, order);
    this.emitMockAccountInfo(input.runtime, ledgerResult.account_info);
    return order;
  }

  async pollTransfer(input: {
    runtime: SignalTraderRuntimeConfig;
    transfer: SignalTraderTransferConfig;
    order_id: string;
  }): Promise<SignalTraderTransferOrder> {
    return (
      this.ensureTransferState(input.runtime).transfer_history.get(input.order_id) ?? {
        order_id: input.order_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        credit_account_id: input.runtime.account_id,
        debit_account_id: input.runtime.account_id,
        currency: 'MOCK',
        expected_amount: 0,
        status: 'COMPLETE',
        runtime_id: input.runtime.runtime_id,
      }
    );
  }
}

export { buildPaperMockAccountId };
