import { createLiveTradingState, dispatchCommand, queryAuditTrail, queryInvestorState } from './index';

const makeRiskPolicy = () => ({
  policy_version: 'v1',
  vc_budget: 1000,
  max_historical_drawdown_ratio: 0.2,
  min_lot: 0.1,
  rate_limit_per_minute: 60,
  cooldown_seconds: 0,
  max_notional_cap: 10000,
});

let base_received_at = Date.now();
const ts = (offset_ms: number) => base_received_at + offset_ms;

const expectRejectedWithAudit = (result: ReturnType<typeof dispatchCommand>, error_code: string) => {
  expect(result.emitted_events).toHaveLength(1);
  expect(result.emitted_events[0].event_type).toBe('SignalRejected');
  expect(result.emitted_events[0].payload.error_code).toBe(error_code);
  expect(result.planned_effects).toHaveLength(1);
  expect(result.planned_effects[0].effect_type).toBe('emit_audit_event');
  expect(result.planned_effects[0].payload.audit_event).toEqual(result.emitted_events[0]);
};

describe('live-trading core', () => {
  beforeEach(() => {
    base_received_at = Date.now();
  });

  test('幂等重放', () => {
    const initial_state = createLiveTradingState();
    const command = {
      command_type: 'submit_signal' as const,
      payload: {
        signal_envelope: {
          signal_id: 's-1',
          investor_id: 'inv-1',
          product_id: 'BTC-USDT',
          signal: 1 as const,
          source: 'model' as const,
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    };

    const first = dispatchCommand(initial_state, command);
    expect(first.emitted_events.length).toBeGreaterThan(0);
    expect(first.planned_effects.length).toBeGreaterThan(0);

    const replay = dispatchCommand(first.next_state, command);
    expect(replay.emitted_events).toHaveLength(0);
    expect(replay.planned_effects).toHaveLength(0);
    expect(replay.next_state.audit_events).toHaveLength(first.next_state.audit_events.length);
  });

  test('幂等冲突', () => {
    const initial_state = createLiveTradingState();
    const first = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-2',
          investor_id: 'inv-1',
          product_id: 'BTC-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    const conflict = dispatchCommand(first.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-2',
          investor_id: 'inv-1',
          product_id: 'BTC-USDT',
          signal: -1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    expectRejectedWithAudit(conflict, 'E_IDEMPOTENCY_CONFLICT');
    expect(conflict.next_state.processed_signals['s-2']).toEqual(first.next_state.processed_signals['s-2']);
  });

  test('同 signal_id 跨投资者仍冲突（全局幂等）', () => {
    const initial_state = createLiveTradingState();
    const first = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 'dup-sig',
          investor_id: 'inv-a',
          product_id: 'BTC-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    const conflict = dispatchCommand(first.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 'dup-sig',
          investor_id: 'inv-b',
          product_id: 'BTC-USDT',
          signal: -1,
          source: 'model',
          received_at: ts(2000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    expectRejectedWithAudit(conflict, 'E_IDEMPOTENCY_CONFLICT');
    expect(conflict.next_state.processed_signals['dup-sig']).toEqual(
      first.next_state.processed_signals['dup-sig'],
    );
  });

  test('signal=0 强制平仓', () => {
    const initial_state = createLiveTradingState();
    const opened = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-3',
          investor_id: 'inv-2',
          product_id: 'ETH-USDT',
          signal: 1,
          source: 'manual',
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    const flattened = dispatchCommand(opened.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-4',
          investor_id: 'inv-2',
          product_id: 'ETH-USDT',
          signal: 0,
          source: 'manual',
          received_at: ts(2000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 110,
      },
    });

    const investor_state = queryInvestorState(flattened.next_state, { investor_id: 'inv-2' });
    expect(investor_state?.products['ETH-USDT']?.position_direction).toBe('FLAT');
    expect(investor_state?.products['ETH-USDT']?.open_position_qty).toBe(0);
    expect(flattened.emitted_events.some((event) => event.event_type === 'PositionFlattened')).toBeTruthy();
    expect(flattened.planned_effects.some((effect) => effect.effect_type === 'place_order')).toBeTruthy();
  });

  test('signal=0 在无效 entry/risk 下仍可平仓', () => {
    const initial_state = createLiveTradingState();
    const opened = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-4-open',
          investor_id: 'inv-flat-1',
          product_id: 'BTC-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    const flattened = dispatchCommand(opened.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-4-flat',
          investor_id: 'inv-flat-1',
          product_id: 'BTC-USDT',
          signal: 0,
          source: 'manual',
          received_at: ts(2000),
        },
        risk_policy: {
          ...makeRiskPolicy(),
          max_historical_drawdown_ratio: 0,
        },
        entry_price: 0,
      },
    });

    const investor_state = queryInvestorState(flattened.next_state, { investor_id: 'inv-flat-1' });
    expect(investor_state?.products['BTC-USDT']?.position_direction).toBe('FLAT');
    expect(investor_state?.products['BTC-USDT']?.open_position_qty).toBe(0);
  });

  test('反向信号必须先平后开（close_then_open）', () => {
    const initial_state = createLiveTradingState();
    const opened_long = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-reverse-open',
          investor_id: 'inv-reverse',
          product_id: 'ETH-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    const reversed = dispatchCommand(opened_long.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-reverse-short',
          investor_id: 'inv-reverse',
          product_id: 'ETH-USDT',
          signal: -1,
          source: 'agent',
          received_at: ts(2000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    const place_order_effects = reversed.planned_effects.filter(
      (effect) => effect.effect_type === 'place_order',
    );
    expect(place_order_effects).toHaveLength(2);
    expect(place_order_effects[0].payload.order_direction).toBe('CLOSE_LONG');
    expect(place_order_effects[1].payload.order_direction).toBe('OPEN_SHORT');
  });

  test('以损定仓公式与参数校验', () => {
    const initial_state = createLiveTradingState();
    const result = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-5',
          investor_id: 'inv-3',
          product_id: 'SOL-USDT',
          signal: 1,
          source: 'agent',
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    const place_order_effect = result.planned_effects.find((effect) => effect.effect_type === 'place_order');
    expect(place_order_effect?.payload.target_notional).toBe(5000);
    expect(place_order_effect?.payload.volume).toBe(50);

    const rejected = dispatchCommand(createLiveTradingState(), {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-6',
          investor_id: 'inv-3',
          product_id: 'SOL-USDT',
          signal: 1,
          source: 'agent',
          received_at: ts(1000),
        },
        risk_policy: {
          ...makeRiskPolicy(),
          max_historical_drawdown_ratio: 0,
        },
        entry_price: 100,
      },
    });
    expectRejectedWithAudit(rejected, 'E_INVALID_RISK_POLICY');
    expect(rejected.next_state.processed_signals['s-6']).toBeUndefined();
  });

  test('entry_price 非法时拒绝并审计', () => {
    const rejected = dispatchCommand(createLiveTradingState(), {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-invalid-entry',
          investor_id: 'inv-invalid-entry',
          product_id: 'BTC-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 0,
      },
    });

    expectRejectedWithAudit(rejected, 'E_INVALID_ENTRY_PRICE');
    expect(rejected.next_state.processed_signals['s-invalid-entry']).toBeUndefined();
  });

  test('目标仓位过小拒绝并审计', () => {
    const rejected = dispatchCommand(createLiveTradingState(), {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-too-small-volume',
          investor_id: 'inv-too-small-volume',
          product_id: 'BTC-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy: {
          ...makeRiskPolicy(),
          min_lot: 1000,
        },
        entry_price: 100,
      },
    });

    expectRejectedWithAudit(rejected, 'E_POSITION_VOLUME_TOO_SMALL');
    expect(rejected.next_state.processed_signals['s-too-small-volume']).toBeUndefined();
  });

  test('循环引用输入拒绝并审计', () => {
    const circular_risk_policy = makeRiskPolicy() as Record<string, unknown>;
    circular_risk_policy.self = circular_risk_policy;

    const rejected = dispatchCommand(createLiveTradingState(), {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-circular-input',
          investor_id: 'inv-circular-input',
          product_id: 'BTC-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy: circular_risk_policy as unknown as ReturnType<typeof makeRiskPolicy>,
        entry_price: 100,
      },
    });

    expectRejectedWithAudit(rejected, 'E_UNSERIALIZABLE_INPUT');
    expect(rejected.next_state.processed_signals['s-circular-input']).toBeUndefined();
  });

  test('take_profit_amount 生效', () => {
    const initial_state = createLiveTradingState();
    const result = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-tp-amount',
          investor_id: 'inv-tp',
          product_id: 'SOL-USDT',
          signal: 1,
          source: 'agent',
          received_at: ts(1000),
        },
        risk_policy: {
          ...makeRiskPolicy(),
          take_profit_amount: 500,
        },
        entry_price: 100,
      },
    });

    const place_order_effect = result.planned_effects.find((effect) => effect.effect_type === 'place_order');
    expect(place_order_effect?.payload.volume).toBe(50);
    expect(place_order_effect?.payload.take_profit_price).toBe(110);
  });

  test('update_risk_policy 非法参数拒绝', () => {
    expect(() =>
      dispatchCommand(createLiveTradingState(), {
        command_type: 'update_risk_policy',
        payload: {
          investor_id: 'inv-policy',
          risk_policy: {
            ...makeRiskPolicy(),
            min_lot: 0,
          },
        },
      }),
    ).toThrow('E_INVALID_RISK_POLICY');
  });

  test('非法 received_at 直接拒绝且不写入幂等状态', () => {
    const initial_state = createLiveTradingState();
    const invalid_command = {
      command_type: 'submit_signal' as const,
      payload: {
        signal_envelope: {
          signal_id: 's-invalid-ts',
          investor_id: 'inv-invalid-ts',
          product_id: 'BTC-USDT',
          signal: 1 as const,
          source: 'model' as const,
          received_at: Number.NaN,
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    };

    const rejected = dispatchCommand(initial_state, invalid_command);
    expectRejectedWithAudit(rejected, 'E_INVALID_SIGNAL_ENVELOPE');
    expect(rejected.next_state.processed_signals['s-invalid-ts']).toBeUndefined();
  });

  test('received_at Infinity/负数 直接拒绝', () => {
    const cases = [
      { signal_id: 's-invalid-ts-inf', received_at: Number.POSITIVE_INFINITY },
      { signal_id: 's-invalid-ts-neg', received_at: -1 },
    ];

    for (const item of cases) {
      const initial_state = createLiveTradingState();
      const rejected = dispatchCommand(initial_state, {
        command_type: 'submit_signal',
        payload: {
          signal_envelope: {
            signal_id: item.signal_id,
            investor_id: 'inv-invalid-ts-2',
            product_id: 'BTC-USDT',
            signal: 1,
            source: 'model',
            received_at: item.received_at,
          },
          risk_policy: makeRiskPolicy(),
          entry_price: 100,
        },
      });
      expectRejectedWithAudit(rejected, 'E_INVALID_SIGNAL_ENVELOPE');
      expect(rejected.next_state.processed_signals[item.signal_id]).toBeUndefined();
    }
  });

  test('received_at 漂移超窗（过旧/过新）直接拒绝', () => {
    const cases = [
      { signal_id: 's-invalid-ts-too-old', received_at: Date.now() - 6 * 60 * 1000 },
      { signal_id: 's-invalid-ts-too-new', received_at: Date.now() + 6 * 60 * 1000 },
    ];

    for (const item of cases) {
      const initial_state = createLiveTradingState();
      const rejected = dispatchCommand(initial_state, {
        command_type: 'submit_signal',
        payload: {
          signal_envelope: {
            signal_id: item.signal_id,
            investor_id: 'inv-invalid-ts-3',
            product_id: 'BTC-USDT',
            signal: 1,
            source: 'model',
            received_at: item.received_at,
          },
          risk_policy: makeRiskPolicy(),
          entry_price: 100,
        },
      });
      expectRejectedWithAudit(rejected, 'E_INVALID_SIGNAL_ENVELOPE');
      expect(rejected.next_state.processed_signals[item.signal_id]).toBeUndefined();
    }
  });

  test('received_at 非单调递增时拒绝', () => {
    const initial_state = createLiveTradingState();
    const first = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-non-monotonic-1',
          investor_id: 'inv-non-monotonic',
          product_id: 'ETH-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(5000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    const rejected = dispatchCommand(first.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-non-monotonic-2',
          investor_id: 'inv-non-monotonic',
          product_id: 'ETH-USDT',
          signal: -1,
          source: 'model',
          received_at: ts(4000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });
    expectRejectedWithAudit(rejected, 'E_INVALID_SIGNAL_ENVELOPE');
    expect(rejected.next_state.processed_signals['s-non-monotonic-2']).toBeUndefined();
  });

  test('外部修改 risk_policy 不影响已落库状态', () => {
    const initial_state = createLiveTradingState();
    const risk_policy = makeRiskPolicy();
    const result = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-immutable-policy',
          investor_id: 'inv-immutable-policy',
          product_id: 'BTC-USDT',
          signal: 1,
          source: 'agent',
          received_at: ts(1000),
        },
        risk_policy,
        entry_price: 100,
      },
    });

    risk_policy.vc_budget = 1;
    const investor_state = queryInvestorState(result.next_state, { investor_id: 'inv-immutable-policy' });
    expect(investor_state?.risk_policy.vc_budget).toBe(1000);
  });

  test('submit_signal 不能隐式覆盖既有风控策略', () => {
    const initial_state = createLiveTradingState();
    const first = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-policy-guard-1',
          investor_id: 'inv-policy-guard',
          product_id: 'BTC-USDT',
          signal: 1,
          source: 'agent',
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    const rejected = dispatchCommand(first.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-policy-guard-2',
          investor_id: 'inv-policy-guard',
          product_id: 'BTC-USDT',
          signal: -1,
          source: 'agent',
          received_at: ts(2000),
        },
        risk_policy: {
          ...makeRiskPolicy(),
          max_notional_cap: 1,
        },
        entry_price: 100,
      },
    });
    expectRejectedWithAudit(rejected, 'E_RISK_POLICY_MISMATCH');
    expect(rejected.next_state.processed_signals['s-policy-guard-2']).toBeUndefined();
  });

  test('冷却时间生效', () => {
    const initial_state = createLiveTradingState();
    const risk_policy = {
      ...makeRiskPolicy(),
      cooldown_seconds: 30,
      rate_limit_per_minute: 10,
    };
    const first = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-cooldown-1',
          investor_id: 'inv-cooldown',
          product_id: 'ETH-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy,
        entry_price: 100,
      },
    });

    const rejected = dispatchCommand(first.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-cooldown-2',
          investor_id: 'inv-cooldown',
          product_id: 'ETH-USDT',
          signal: -1,
          source: 'model',
          received_at: ts(20_000),
        },
        risk_policy,
        entry_price: 100,
      },
    });
    expectRejectedWithAudit(rejected, 'E_COOLDOWN_ACTIVE');
    expect(rejected.next_state.processed_signals['s-cooldown-2']).toBeUndefined();
  });

  test('冷却按产品隔离，不同 product 不互相阻塞', () => {
    const initial_state = createLiveTradingState();
    const risk_policy = {
      ...makeRiskPolicy(),
      cooldown_seconds: 30,
      rate_limit_per_minute: 10,
    };
    const first = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-cooldown-product-1',
          investor_id: 'inv-cooldown-product',
          product_id: 'ETH-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy,
        entry_price: 100,
      },
    });

    expect(() =>
      dispatchCommand(first.next_state, {
        command_type: 'submit_signal',
        payload: {
          signal_envelope: {
            signal_id: 's-cooldown-product-2',
            investor_id: 'inv-cooldown-product',
            product_id: 'BTC-USDT',
            signal: -1,
            source: 'model',
            received_at: ts(20_000),
          },
          risk_policy,
          entry_price: 100,
        },
      }),
    ).not.toThrow();
  });

  test('每分钟限流生效', () => {
    const initial_state = createLiveTradingState();
    const risk_policy = {
      ...makeRiskPolicy(),
      cooldown_seconds: 0,
      rate_limit_per_minute: 2,
    };
    const first = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-rate-1',
          investor_id: 'inv-rate',
          product_id: 'SOL-USDT',
          signal: 1,
          source: 'agent',
          received_at: ts(1000),
        },
        risk_policy,
        entry_price: 100,
      },
    });
    const second = dispatchCommand(first.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-rate-2',
          investor_id: 'inv-rate',
          product_id: 'SOL-USDT',
          signal: -1,
          source: 'agent',
          received_at: ts(2000),
        },
        risk_policy,
        entry_price: 100,
      },
    });

    const rejected = dispatchCommand(second.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-rate-3',
          investor_id: 'inv-rate',
          product_id: 'SOL-USDT',
          signal: 1,
          source: 'agent',
          received_at: ts(3000),
        },
        risk_policy,
        entry_price: 100,
      },
    });
    expectRejectedWithAudit(rejected, 'E_RATE_LIMIT_EXCEEDED');
    expect(rejected.next_state.processed_signals['s-rate-3']).toBeUndefined();
  });

  test('限流按产品隔离，A 触顶不影响 B', () => {
    const initial_state = createLiveTradingState();
    const risk_policy = {
      ...makeRiskPolicy(),
      cooldown_seconds: 0,
      rate_limit_per_minute: 2,
    };
    const first = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-rate-product-1',
          investor_id: 'inv-rate-product',
          product_id: 'SOL-USDT',
          signal: 1,
          source: 'agent',
          received_at: ts(1000),
        },
        risk_policy,
        entry_price: 100,
      },
    });
    const second = dispatchCommand(first.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-rate-product-2',
          investor_id: 'inv-rate-product',
          product_id: 'SOL-USDT',
          signal: -1,
          source: 'agent',
          received_at: ts(2000),
        },
        risk_policy,
        entry_price: 100,
      },
    });

    expect(() =>
      dispatchCommand(second.next_state, {
        command_type: 'submit_signal',
        payload: {
          signal_envelope: {
            signal_id: 's-rate-product-3',
            investor_id: 'inv-rate-product',
            product_id: 'BTC-USDT',
            signal: 1,
            source: 'agent',
            received_at: ts(3000),
          },
          risk_policy,
          entry_price: 100,
        },
      }),
    ).not.toThrow();
  });

  test('query 过滤审计轨迹', () => {
    const initial_state = createLiveTradingState();
    const first = dispatchCommand(initial_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-7',
          investor_id: 'inv-4',
          product_id: 'BTC-USDT',
          signal: 1,
          source: 'model',
          received_at: ts(1000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });
    const second = dispatchCommand(first.next_state, {
      command_type: 'submit_signal',
      payload: {
        signal_envelope: {
          signal_id: 's-8',
          investor_id: 'inv-5',
          product_id: 'ETH-USDT',
          signal: -1,
          source: 'manual',
          received_at: ts(2000),
        },
        risk_policy: makeRiskPolicy(),
        entry_price: 100,
      },
    });

    const filtered = queryAuditTrail(second.next_state, {
      investor_id: 'inv-5',
      from_ms: ts(1500),
      to_ms: ts(3000),
    });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((event) => event.investor_id === 'inv-5')).toBeTruthy();

    const by_signal = queryAuditTrail(second.next_state, {
      investor_id: 'inv-4',
      signal_id: 's-7',
      from_ms: ts(0),
      to_ms: ts(3000),
    });
    expect(by_signal.length).toBeGreaterThan(0);
    expect(by_signal.every((event) => event.signal_id === 's-7')).toBeTruthy();

    const without_investor = queryAuditTrail(second.next_state, {
      signal_id: 's-7',
      from_ms: ts(0),
      to_ms: ts(3000),
    });
    expect(without_investor).toEqual([]);
  });
});
