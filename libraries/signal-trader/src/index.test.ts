import { createMockExecutionPort } from './ports/mock-execution-port';
import { applyExecutionEffects } from './ports/execution-port';
import { computeTargetPosition } from './domain/compute-target-position';
import { createEventSourcedTradingState } from './engine/create-event-sourced-trading-state';
import { dispatchCommand } from './engine/dispatch-command';
import { queryProjection } from './engine/query-projection';
import { replayEvents } from './engine/replay-events';

const DAY_MS = 86_400_000;

describe('@yuants/signal-trader', () => {
  it('computes target position with hard stop loss', () => {
    expect(
      computeTargetPosition({
        signal: 1,
        vc_budget: 100,
        entry_price: 100,
        stop_loss_price: 90,
      }),
    ).toBe(10);
  });

  it('creates intent and order effect for submit_signal', () => {
    let state = createEventSourcedTradingState({ clock_ms: 1 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 1,
    }).next_state;

    const result = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });

    expect(result.appended_events.map((item) => item.event_type)).toEqual([
      'SignalReceived',
      'IntentCreated',
      'OrderSubmitted',
    ]);
    expect(result.planned_effects).toHaveLength(1);
    expect(result.next_snapshot.subscriptions['sub-1'].target_position_qty).toBe(10);
  });

  it('keeps direction=0 audit semantics even when already flat', () => {
    let state = createEventSourcedTradingState({ clock_ms: 2 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 2,
    }).next_state;

    const result = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-flat',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 0,
      source: 'manual',
    });

    expect(result.appended_events.some((item) => item.event_type === 'SignalForcedFlatHandled')).toBe(true);
    expect(result.planned_effects).toHaveLength(0);
  });

  it('applies execution report by using frozen order attribution and supports replay', () => {
    let state = createEventSourcedTradingState({ clock_ms: 3 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 3,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-2',
      investor_id: 'investor-2',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 50,
      daily_burn_amount: 50,
      status: 'active',
      effective_at: 3,
    }).next_state;

    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-2',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;

    const filled = dispatchCommand(state, {
      command_type: 'apply_execution_report',
      order_id: 'order/signal-2/BTC-USDT',
      report_id: 'report-1',
      product_id: 'BTC-USDT',
      status: 'filled',
      filled_qty: 15,
      avg_fill_price: 100,
      fee: 0,
      reported_at: 3,
    });

    expect(
      filled.next_snapshot.subscriptions['sub-1'].settled_position_qty +
        filled.next_snapshot.subscriptions['sub-2'].settled_position_qty,
    ).toBe(15);
    expect(replayEvents(filled.next_state.events)).toEqual(filled.next_snapshot);
  });

  it('records reconciliation match and mismatch', () => {
    let state = createEventSourcedTradingState({ clock_ms: 4 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 4,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-3',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;

    const matched = dispatchCommand(state, {
      command_type: 'capture_authorized_account_snapshot',
      snapshot_id: 'snapshot-1',
      account_id: 'acct-1',
      balance: 100,
      captured_at: 4,
    });
    expect(matched.next_snapshot.reconciliation['acct-1'].status).toBe('matched');

    const mismatched = dispatchCommand(matched.next_state, {
      command_type: 'capture_authorized_account_snapshot',
      snapshot_id: 'snapshot-2',
      account_id: 'acct-1',
      balance: 99,
      captured_at: 4,
    });
    expect(mismatched.next_snapshot.reconciliation['acct-1'].status).toBe('mismatch');
    expect(mismatched.next_snapshot.mode).toBe('audit_only');

    const blocked = dispatchCommand(mismatched.next_state, {
      command_type: 'submit_signal',
      signal_id: 'signal-after-mismatch',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });
    expect(blocked.planned_effects).toHaveLength(0);
    expect(blocked.appended_events.map((item) => item.event_type)).toEqual([
      'SignalReceived',
      'IntentRejected',
      'AlertTriggered',
    ]);
  });

  it('supports idempotency dedupe and conflict detection', () => {
    let state = createEventSourcedTradingState({ clock_ms: 5 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 5,
    }).next_state;

    const command = {
      command_type: 'submit_signal' as const,
      signal_id: 'signal-4',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1 as const,
      source: 'model' as const,
      entry_price: 100,
      stop_loss_price: 90,
    };

    state = dispatchCommand(state, command).next_state;
    const deduped = dispatchCommand(state, command);
    expect(deduped.appended_events).toEqual([]);

    const dedupedWithNewReferenceEvidence = dispatchCommand(state, {
      ...command,
      reference_price: 101,
      reference_price_source: 'sql.quote.last_price',
      reference_price_datasource_id: 'okx',
      reference_price_updated_at: '2026-03-23T00:00:00.000Z',
    });
    expect(dedupedWithNewReferenceEvidence.appended_events).toEqual([]);

    const conflicted = dispatchCommand(state, {
      ...command,
      entry_price: 101,
    });
    expect(conflicted.appended_events.map((item) => item.event_type)).toEqual(['AlertTriggered']);
  });

  it('fails close without authorize_order and can execute through mock port', async () => {
    const port = createMockExecutionPort<{ key: string }>({
      get_credential_key: (credential) => credential.key,
    });
    const effect = {
      effect_type: 'place_order' as const,
      order_id: 'order-1',
      signal_id: 'signal-1',
      product_id: 'BTC-USDT',
      size: 1,
      attribution: [],
    };

    await expect(applyExecutionEffects(port, { key: 'demo' }, [effect])).rejects.toThrow(
      'AUTHORIZE_ORDER_REQUIRED',
    );

    const result = await applyExecutionEffects(port, { key: 'demo' }, [effect], {
      authorize_order: async () => ({ account_id: 'acct-1' }),
    });

    expect(result[0].account_id).toBe('acct-1');
    expect(result[0].external_order_id).toBe('order-1');
    await expect(port.getOrders({ key: 'demo' })).resolves.toHaveLength(1);
  });

  it('releases target when subscription becomes paused and preserves settled exposure in product projection', () => {
    let state = createEventSourcedTradingState({ clock_ms: 6 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 6,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-5',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'apply_execution_report',
      order_id: 'order/signal-5/BTC-USDT',
      report_id: 'report-5',
      product_id: 'BTC-USDT',
      status: 'filled',
      filled_qty: 10,
      avg_fill_price: 100,
      fee: 0,
      reported_at: 6,
    }).next_state;

    const paused = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'paused',
      effective_at: 7,
    });

    expect(paused.appended_events.map((item) => item.event_type)).toEqual([
      'SubscriptionUpdated',
      'IntentReleased',
    ]);
    expect(paused.next_snapshot.products['BTC-USDT'].current_net_qty).toBe(10);
    expect(paused.next_snapshot.products['BTC-USDT'].target_net_qty).toBe(10);
  });

  it('emits compensation when paused subscription still has pending target', () => {
    let state = createEventSourcedTradingState({ clock_ms: 7 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 7,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-6',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;

    const paused = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'paused',
      effective_at: 8,
    });

    expect(paused.appended_events.map((item) => item.event_type)).toEqual([
      'SubscriptionUpdated',
      'IntentReleased',
    ]);
    expect(paused.next_snapshot.products['BTC-USDT'].target_net_qty).toBe(0);
    expect(paused.planned_effects).toEqual([
      {
        effect_type: 'cancel_order',
        order_id: 'order/signal-6/BTC-USDT',
        product_id: 'BTC-USDT',
      },
    ]);
  });

  it('rejects mismatched execution report product without mutating order state', () => {
    let state = createEventSourcedTradingState({ clock_ms: 8 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 8,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-7',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;

    const result = dispatchCommand(state, {
      command_type: 'apply_execution_report',
      order_id: 'order/signal-7/BTC-USDT',
      report_id: 'report-7',
      product_id: 'ETH-USDT',
      status: 'filled',
      filled_qty: 10,
      avg_fill_price: 100,
      fee: 0,
      reported_at: 8,
    });

    expect(result.appended_events.map((item) => item.event_type)).toEqual(['AlertTriggered']);
    expect(result.next_snapshot.orders['order/signal-7/BTC-USDT'].status).toBe('submitted');
    expect(result.next_snapshot.subscriptions['sub-1'].settled_position_qty).toBe(0);
  });

  it('sanitizes event metadata before appending to audit log', () => {
    let state = createEventSourcedTradingState({ clock_ms: 9 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 9,
    }).next_state;

    const signal = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-8',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
      metadata: {
        trace_id: 'trace-1',
        secret_token: 'do-not-store',
      },
    });

    const received = signal.appended_events.find((item) => item.event_type === 'SignalReceived');
    expect(received?.payload).toMatchObject({ metadata: { trace_id: 'trace-1' } });
    expect((received?.payload as any).metadata.secret_token).toBeUndefined();
  });

  it('guards mock execution port outside test mode', () => {
    const previous = process.env.NODE_ENV;
    delete process.env.SIGNAL_TRADER_ALLOW_UNSAFE_MOCK;
    process.env.NODE_ENV = 'production';
    expect(() =>
      createMockExecutionPort({
        get_credential_key: () => 'demo',
      }),
    ).toThrow('MOCK_EXECUTION_PORT_DISABLED');
    process.env.NODE_ENV = previous;
  });

  it('cancels all active orders for a product when pausing leaves desired delta at zero', () => {
    let state = createEventSourcedTradingState({ clock_ms: 10 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 10,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-9',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-10',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;

    const paused = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-1',
      investor_id: 'investor-1',
      signal_key: 'sig-a',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'paused',
      effective_at: 11,
    });

    expect(paused.planned_effects).toEqual([
      {
        effect_type: 'cancel_order',
        order_id: 'order/signal-10/BTC-USDT',
        product_id: 'BTC-USDT',
      },
      {
        effect_type: 'cancel_order',
        order_id: 'order/signal-9/BTC-USDT',
        product_id: 'BTC-USDT',
      },
    ]);
  });

  it('releases daily burn budget across D0 D1 D2 with lazy query refresh', () => {
    let state = createEventSourcedTradingState({ clock_ms: 0 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-budget',
      investor_id: 'investor-1',
      signal_key: 'sig-budget',
      product_id: 'BTC-USDT',
      vc_budget: 25,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 0,
    }).next_state;

    expect(state.snapshot.subscriptions['sub-budget'].released_vc_total).toBe(10);
    expect(state.snapshot.subscriptions['sub-budget'].available_vc).toBe(10);
    expect(state.snapshot.subscriptions['sub-budget'].funding_account).toBe(15);
    expect(state.snapshot.subscriptions['sub-budget'].trading_account).toBe(10);

    state.clock_ms = DAY_MS - 1;
    expect(queryProjection(state, { type: 'subscription', subscription_id: 'sub-budget' })).toMatchObject({
      released_vc_total: 10,
      available_vc: 10,
      funding_account: 15,
      trading_account: 10,
      last_budget_eval_at: 0,
    });

    state.clock_ms = DAY_MS;
    expect(queryProjection(state, { type: 'subscription', subscription_id: 'sub-budget' })).toMatchObject({
      released_vc_total: 20,
      available_vc: 20,
      funding_account: 5,
      trading_account: 20,
      last_budget_eval_at: DAY_MS,
    });

    state.clock_ms = DAY_MS * 2;
    expect(queryProjection(state, { type: 'subscription', subscription_id: 'sub-budget' })).toMatchObject({
      released_vc_total: 25,
      available_vc: 25,
      funding_account: 0,
      trading_account: 25,
      last_budget_eval_at: DAY_MS * 2,
    });
  });

  it('does not double release within same day and caps at vc_budget on repeated query refresh', () => {
    let state = createEventSourcedTradingState({ clock_ms: 0 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-budget-repeat',
      investor_id: 'investor-1',
      signal_key: 'sig-budget-repeat',
      product_id: 'BTC-USDT',
      vc_budget: 25,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 0,
    }).next_state;

    const d0a = queryProjection(state, { type: 'subscription', subscription_id: 'sub-budget-repeat' }) as any;
    const d0b = queryProjection(state, { type: 'subscription', subscription_id: 'sub-budget-repeat' }) as any;
    expect(d0a.released_vc_total).toBe(10);
    expect(d0b.released_vc_total).toBe(10);

    state.clock_ms = DAY_MS;
    const d1a = queryProjection(state, { type: 'subscription', subscription_id: 'sub-budget-repeat' }) as any;
    const d1b = queryProjection(state, { type: 'subscription', subscription_id: 'sub-budget-repeat' }) as any;
    expect(d1a.released_vc_total).toBe(20);
    expect(d1b.released_vc_total).toBe(20);

    state.clock_ms = DAY_MS * 10;
    const cappedA = queryProjection(state, {
      type: 'subscription',
      subscription_id: 'sub-budget-repeat',
    }) as any;
    const cappedB = queryProjection(state, {
      type: 'subscription',
      subscription_id: 'sub-budget-repeat',
    }) as any;
    expect(cappedA.released_vc_total).toBe(25);
    expect(cappedB.released_vc_total).toBe(25);
    expect(cappedA.funding_account).toBe(0);
    expect(cappedA.trading_account).toBe(25);
  });

  it('projects funding_account and trading_account from budget state', () => {
    let state = createEventSourcedTradingState({ clock_ms: 0 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-transfer',
      investor_id: 'investor-1',
      signal_key: 'sig-transfer',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 0,
    }).next_state;

    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-transfer',
      signal_key: 'sig-transfer',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;

    expect(queryProjection(state, { type: 'subscription', subscription_id: 'sub-transfer' })).toMatchObject({
      funding_account: 0,
      trading_account: 100,
      available_vc: 0,
    });
  });

  it('projects precision lock into investor buffer', () => {
    let state = createEventSourcedTradingState({ clock_ms: 0 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-buffer',
      investor_id: 'investor-buffer',
      signal_key: 'sig-buffer',
      product_id: 'BTC-USDT',
      vc_budget: 101,
      daily_burn_amount: 101,
      status: 'active',
      effective_at: 0,
    }).next_state;

    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-buffer',
      signal_key: 'sig-buffer',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 91,
    }).next_state;

    expect(queryProjection(state, { type: 'subscription', subscription_id: 'sub-buffer' })).toMatchObject({
      released_vc_total: 101,
      trading_account: 101,
      funding_account: 0,
      precision_locked_amount: 2,
      available_vc: 0,
    });
    expect(state.snapshot.investor_buffers['investor-buffer']).toMatchObject({
      buffer_amount: 2,
      precision_locked_amount: 2,
      sources: [
        {
          source_subscription_id: 'sub-buffer',
          amount: 2,
          reason: 'precision_lock',
        },
      ],
    });
  });

  it('settles internal netting when product delta is fully offset', () => {
    let state = createEventSourcedTradingState({ clock_ms: 20 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-net-1',
      investor_id: 'investor-1',
      signal_key: 'sig-net',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 20,
      contract_multiplier: 1,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-net-2',
      investor_id: 'investor-2',
      signal_key: 'sig-net',
      product_id: 'BTC-USDT',
      vc_budget: 50,
      daily_burn_amount: 50,
      status: 'active',
      effective_at: 20,
      contract_multiplier: 1,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-net-open',
      signal_key: 'sig-net',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'apply_execution_report',
      order_id: 'order/signal-net-open/BTC-USDT',
      report_id: 'report-net-open',
      product_id: 'BTC-USDT',
      status: 'filled',
      filled_qty: 15,
      avg_fill_price: 100,
      fee: 0,
      reported_at: 20,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-net-1',
      investor_id: 'investor-1',
      signal_key: 'sig-net',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 21,
      contract_multiplier: 1,
      lot_size: 7,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-net-2',
      investor_id: 'investor-2',
      signal_key: 'sig-net',
      product_id: 'BTC-USDT',
      vc_budget: 50,
      daily_burn_amount: 50,
      status: 'active',
      effective_at: 21,
      contract_multiplier: 0.625,
    }).next_state;

    const result = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-net-rebalance',
      signal_key: 'sig-net',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      reference_price: 101,
      reference_price_source: 'sql.quote.bid_ask_mid',
      reference_price_datasource_id: 'okx',
      reference_price_updated_at: '2026-03-23T00:00:00.000Z',
      stop_loss_price: 90,
    });

    expect(result.appended_events.map((item) => item.event_type)).toEqual([
      'SignalReceived',
      'IntentCreated',
      'IntentCreated',
      'MidPriceCaptured',
      'InternalNettingSettled',
    ]);
    const midPriceEvent = result.appended_events.find((item) => item.event_type === 'MidPriceCaptured');
    expect(midPriceEvent).toMatchObject({
      payload: {
        price: 101,
        source: 'sql.quote.bid_ask_mid',
        datasource_id: 'okx',
        quote_updated_at: '2026-03-23T00:00:00.000Z',
      },
    });
    expect(result.next_snapshot.subscriptions['sub-net-1'].settled_position_qty).toBe(7);
    expect(result.next_snapshot.subscriptions['sub-net-2'].settled_position_qty).toBe(8);
    expect(
      result.next_snapshot.audit_by_signal_id['signal-net-rebalance'].event_ids.map(
        (event_id) => event_id.split('/')[0],
      ),
    ).toEqual([
      'SignalReceived',
      'IntentCreated',
      'IntentCreated',
      'MidPriceCaptured',
      'InternalNettingSettled',
    ]);
  });

  it('blocks internal netting when pending order exists', () => {
    let state = createEventSourcedTradingState({ clock_ms: 30 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-pending-1',
      investor_id: 'investor-1',
      signal_key: 'sig-pending',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 30,
      contract_multiplier: 1,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-pending-2',
      investor_id: 'investor-2',
      signal_key: 'sig-pending',
      product_id: 'BTC-USDT',
      vc_budget: 50,
      daily_burn_amount: 50,
      status: 'active',
      effective_at: 30,
      contract_multiplier: 1,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-pending-open',
      signal_key: 'sig-pending',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'apply_execution_report',
      order_id: 'order/signal-pending-open/BTC-USDT',
      report_id: 'report-pending-open',
      product_id: 'BTC-USDT',
      status: 'filled',
      filled_qty: 15,
      avg_fill_price: 100,
      fee: 0,
      reported_at: 30,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-pending-2',
      investor_id: 'investor-2',
      signal_key: 'sig-pending',
      product_id: 'BTC-USDT',
      vc_budget: 60,
      daily_burn_amount: 60,
      status: 'active',
      effective_at: 31,
      contract_multiplier: 0.25,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-pending-grow',
      signal_key: 'sig-pending',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-pending-1',
      investor_id: 'investor-1',
      signal_key: 'sig-pending',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 32,
      contract_multiplier: 1,
      lot_size: 7,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-pending-2',
      investor_id: 'investor-2',
      signal_key: 'sig-pending',
      product_id: 'BTC-USDT',
      vc_budget: 50,
      daily_burn_amount: 50,
      status: 'active',
      effective_at: 32,
      contract_multiplier: 0.625,
    }).next_state;

    const result = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-pending-blocked',
      signal_key: 'sig-pending',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });

    expect(result.appended_events.some((item) => item.event_type === 'MidPriceCaptured')).toBe(false);
    expect(result.appended_events.some((item) => item.event_type === 'InternalNettingSettled')).toBe(false);
    expect(result.next_snapshot.subscriptions['sub-pending-1'].settled_position_qty).toBe(10);
    expect(result.next_snapshot.subscriptions['sub-pending-2'].settled_position_qty).toBe(5);
  });

  it('does not settle internal netting without formal reference price evidence', () => {
    let state = createEventSourcedTradingState({ clock_ms: 35 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-missing-1',
      investor_id: 'investor-1',
      signal_key: 'sig-missing',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 35,
      contract_multiplier: 1,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-missing-2',
      investor_id: 'investor-2',
      signal_key: 'sig-missing',
      product_id: 'BTC-USDT',
      vc_budget: 50,
      daily_burn_amount: 50,
      status: 'active',
      effective_at: 35,
      contract_multiplier: 1,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-missing-open',
      signal_key: 'sig-missing',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'apply_execution_report',
      order_id: 'order/signal-missing-open/BTC-USDT',
      report_id: 'report-missing-open',
      product_id: 'BTC-USDT',
      status: 'filled',
      filled_qty: 15,
      avg_fill_price: 100,
      fee: 0,
      reported_at: 35,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-missing-1',
      investor_id: 'investor-1',
      signal_key: 'sig-missing',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 36,
      contract_multiplier: 1,
      lot_size: 7,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-missing-2',
      investor_id: 'investor-2',
      signal_key: 'sig-missing',
      product_id: 'BTC-USDT',
      vc_budget: 50,
      daily_burn_amount: 50,
      status: 'active',
      effective_at: 36,
      contract_multiplier: 0.625,
    }).next_state;

    const result = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-missing-rebalance',
      signal_key: 'sig-missing',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });

    expect(result.appended_events.some((item) => item.event_type === 'MidPriceCaptured')).toBe(false);
    expect(result.appended_events.some((item) => item.event_type === 'InternalNettingSettled')).toBe(false);
  });

  it('does not settle internal netting with incomplete reference evidence', () => {
    let state = createEventSourcedTradingState({ clock_ms: 37 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-evidence-1',
      investor_id: 'investor-1',
      signal_key: 'sig-evidence',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 37,
      contract_multiplier: 1,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-evidence-2',
      investor_id: 'investor-2',
      signal_key: 'sig-evidence',
      product_id: 'BTC-USDT',
      vc_budget: 50,
      daily_burn_amount: 50,
      status: 'active',
      effective_at: 37,
      contract_multiplier: 1,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-evidence-open',
      signal_key: 'sig-evidence',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'apply_execution_report',
      order_id: 'order/signal-evidence-open/BTC-USDT',
      report_id: 'report-evidence-open',
      product_id: 'BTC-USDT',
      status: 'filled',
      filled_qty: 15,
      avg_fill_price: 100,
      fee: 0,
      reported_at: 37,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-evidence-1',
      investor_id: 'investor-1',
      signal_key: 'sig-evidence',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 38,
      contract_multiplier: 1,
      lot_size: 7,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-evidence-2',
      investor_id: 'investor-2',
      signal_key: 'sig-evidence',
      product_id: 'BTC-USDT',
      vc_budget: 50,
      daily_burn_amount: 50,
      status: 'active',
      effective_at: 38,
      contract_multiplier: 0.625,
    }).next_state;

    const result = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-evidence-rebalance',
      signal_key: 'sig-evidence',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      reference_price: 101,
      reference_price_source: 'sql.quote.bid_ask_mid',
      stop_loss_price: 90,
    });

    expect(result.appended_events.some((item) => item.event_type === 'MidPriceCaptured')).toBe(false);
    expect(result.appended_events.some((item) => item.event_type === 'InternalNettingSettled')).toBe(false);
  });

  it('triggers account scoped profit target advisory alert', () => {
    let state = createEventSourcedTradingState({ clock_ms: 40 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-profit',
      investor_id: 'investor-profit',
      signal_key: 'sig-profit',
      product_id: 'BTC-USDT',
      vc_budget: 200,
      daily_burn_amount: 121,
      profit_target_value: 120,
      reserve_account_ref: 'acct-profit',
      status: 'active',
      effective_at: 40,
    }).next_state;

    const result = dispatchCommand(state, {
      command_type: 'capture_authorized_account_snapshot',
      snapshot_id: 'snapshot-profit',
      account_id: 'acct-profit',
      balance: 121,
      captured_at: 40,
    });

    const alert = result.appended_events.find(
      (item) => item.event_type === 'AlertTriggered' && item.payload.type === 'profit_target_reached',
    );
    if (!alert || alert.event_type !== 'AlertTriggered') {
      throw new Error('profit target alert not found');
    }
    expect(alert.payload.message).toContain('account_id=acct-profit');
    expect(alert.payload.message).toContain('snapshot_id=snapshot-profit');
    expect(alert.payload.message).toContain('candidate_subscriptions=sub-profit');
    expect(result.next_snapshot.reconciliation['acct-profit'].status).toBe('matched');
  });

  it('queries investor projection totals and ids', () => {
    let state = createEventSourcedTradingState({ clock_ms: 50 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-investor-1',
      investor_id: 'investor-query',
      signal_key: 'sig-query-a',
      product_id: 'BTC-USDT',
      vc_budget: 101,
      daily_burn_amount: 101,
      status: 'active',
      effective_at: 50,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-investor-2',
      investor_id: 'investor-query',
      signal_key: 'sig-query-b',
      product_id: 'ETH-USDT',
      vc_budget: 40,
      daily_burn_amount: 40,
      status: 'paused',
      effective_at: 50,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-investor-query',
      signal_key: 'sig-query-a',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 91,
    }).next_state;

    expect(queryProjection(state, { type: 'investor', investor_id: 'investor-query' })).toEqual({
      investor_id: 'investor-query',
      subscription_ids: ['sub-investor-1', 'sub-investor-2'],
      active_subscription_ids: ['sub-investor-1'],
      subscription_count: 2,
      active_subscription_count: 1,
      total_released_vc: 141,
      total_available_vc: 40,
      total_funding_account: 0,
      total_trading_account: 141,
      total_precision_locked_amount: 2,
      total_target_position_qty: 11,
      total_settled_position_qty: 0,
    });
  });

  it('queries signal projection totals and ids', () => {
    let state = createEventSourcedTradingState({ clock_ms: 60 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-signal-1',
      investor_id: 'investor-1',
      signal_key: 'sig-query',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 60,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-signal-2',
      investor_id: 'investor-2',
      signal_key: 'sig-query',
      product_id: 'ETH-USDT',
      vc_budget: 50,
      daily_burn_amount: 50,
      status: 'paused',
      effective_at: 60,
    }).next_state;

    expect(queryProjection(state, { type: 'signal', signal_key: 'sig-query' })).toEqual({
      signal_key: 'sig-query',
      subscription_ids: ['sub-signal-1', 'sub-signal-2'],
      product_ids: ['BTC-USDT', 'ETH-USDT'],
      subscription_count: 2,
      active_subscription_count: 1,
      total_released_vc: 150,
      total_available_vc: 150,
      total_funding_account: 0,
      total_trading_account: 150,
      total_precision_locked_amount: 0,
      total_target_position_qty: 0,
      total_settled_position_qty: 0,
    });
  });

  it('refreshes reconciliation projection when query and reconcile cross day', () => {
    let state = createEventSourcedTradingState({ clock_ms: 0 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-reconcile',
      investor_id: 'investor-1',
      signal_key: 'sig-reconcile',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 0,
    }).next_state;

    const d0 = dispatchCommand(state, {
      command_type: 'capture_authorized_account_snapshot',
      snapshot_id: 'snapshot-d0',
      account_id: 'acct-1',
      balance: 10,
      captured_at: 0,
    });
    expect(d0.next_snapshot.reconciliation['acct-1']).toMatchObject({
      projected_balance: 10,
      status: 'matched',
    });

    state = d0.next_state;
    state.clock_ms = DAY_MS;

    expect(queryProjection(state, { type: 'reconciliation', account_id: 'acct-1' })).toMatchObject({
      projected_balance: 20,
      status: 'matched',
    });

    const d1 = dispatchCommand(state, {
      command_type: 'capture_authorized_account_snapshot',
      snapshot_id: 'snapshot-d1',
      account_id: 'acct-1',
      balance: 20,
      captured_at: DAY_MS,
    });
    expect(d1.next_snapshot.reconciliation['acct-1']).toMatchObject({
      projected_balance: 20,
      status: 'matched',
    });
  });

  it('does not implicitly shrink over-reserved exposure before release catches up', () => {
    let state = createEventSourcedTradingState({ clock_ms: 0 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-over-reserved',
      investor_id: 'investor-1',
      signal_key: 'sig-over-reserved',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 100,
      status: 'active',
      effective_at: 0,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-over-reserved-open',
      signal_key: 'sig-over-reserved',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'apply_execution_report',
      order_id: 'order/signal-over-reserved-open/BTC-USDT',
      report_id: 'report-over-reserved-open',
      product_id: 'BTC-USDT',
      status: 'filled',
      filled_qty: 10,
      avg_fill_price: 100,
      fee: 0,
      reported_at: 0,
    }).next_state;
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-over-reserved',
      investor_id: 'investor-1',
      signal_key: 'sig-over-reserved',
      product_id: 'BTC-USDT',
      vc_budget: 5,
      daily_burn_amount: 5,
      status: 'active',
      effective_at: 1,
    }).next_state;

    expect(
      queryProjection(state, { type: 'subscription', subscription_id: 'sub-over-reserved' }),
    ).toMatchObject({
      released_vc_total: 5,
      available_vc: 0,
      target_position_qty: 10,
    });

    state.clock_ms = DAY_MS + 1;
    const result = dispatchCommand(state, {
      command_type: 'submit_signal',
      signal_id: 'signal-over-reserved-hold',
      signal_key: 'sig-over-reserved',
      product_id: 'BTC-USDT',
      signal: 1,
      source: 'model',
      entry_price: 100,
      stop_loss_price: 90,
    });
    const intent = result.appended_events.find((event) => event.event_type === 'IntentCreated');

    expect(intent?.payload).toMatchObject({ target_position_qty: 10 });
    expect(result.next_snapshot.subscriptions['sub-over-reserved']).toMatchObject({
      available_vc: 0,
      target_position_qty: 10,
    });
  });

  it('treats pure reconciliation rounding drift as matched', () => {
    let state = createEventSourcedTradingState({ clock_ms: 70 });
    state = dispatchCommand(state, {
      command_type: 'upsert_subscription',
      subscription_id: 'sub-reconcile-tolerance',
      investor_id: 'investor-1',
      signal_key: 'sig-reconcile-tolerance',
      product_id: 'BTC-USDT',
      vc_budget: 100,
      daily_burn_amount: 10,
      status: 'active',
      effective_at: 70,
    }).next_state;

    const result = dispatchCommand(state, {
      command_type: 'capture_authorized_account_snapshot',
      snapshot_id: 'snapshot-tolerance',
      account_id: 'acct-tolerance',
      balance: 10.0000005,
      captured_at: 70,
    });

    expect(result.next_snapshot.reconciliation['acct-tolerance']).toMatchObject({
      status: 'matched',
      projected_balance: 10,
      rounded_projected_balance: 10,
      difference: 0.0000005,
      tolerance: 0.000001,
      explanation: 'difference_within_tolerance',
    });
    expect(result.next_snapshot.mode).toBe('normal');
  });
});
