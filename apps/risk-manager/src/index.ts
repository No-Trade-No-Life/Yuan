import {
  IDataRecordTypes,
  ITransferOrder,
  UUID,
  formatTime,
  getDataRecordSchema,
  getDataRecordWrapper,
} from '@yuants/data-model';
import { PromRegistry, Terminal, readDataRecords, useAccountInfo, writeDataRecords } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/transfer';
import Ajv from 'ajv';
import {
  combineLatest,
  defer,
  delayWhen,
  filter,
  first,
  from,
  groupBy,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  tap,
  toArray,
} from 'rxjs';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || 'RiskManager',
  name: 'Risk Manager',
});

interface IRiskState {
  currency: string;
  group_id: string;
  account_id: string;
  equity: number;
  free: number;
  valuation: number;
  active_supply: number;
  active_demand: number;
  passive_supply: number;
  passive_demand: number;
}

const MetricActiveDemand = PromRegistry.create('gauge', 'risk_manager_active_demand');
const MetricPassiveDemand = PromRegistry.create('gauge', 'risk_manager_passive_demand');
const MetricActiveSupply = PromRegistry.create('gauge', 'risk_manager_active_supply');
const MetricPassiveSupply = PromRegistry.create('gauge', 'risk_manager_passive_supply');

function mapRiskInfoToState$(riskInfo: IDataRecordTypes['account_risk_info']) {
  return defer(() => useAccountInfo(terminal, riskInfo.account_id)).pipe(
    //
    map((accountInfo) => {
      const state: IRiskState = {
        account_id: riskInfo.account_id,
        currency: riskInfo.currency,
        group_id: riskInfo.group_id,
        equity: NaN,
        free: NaN,
        valuation: NaN,
        active_demand: NaN,
        passive_demand: NaN,
        passive_supply: NaN,
        active_supply: NaN,
      };
      const currencyItem = accountInfo.currencies.find((x) => x.currency === riskInfo.currency);
      state.equity = currencyItem?.equity ?? 0;
      state.free = currencyItem?.free ?? 0;
      // TODO: add filter currency for positions
      state.valuation = accountInfo.positions.reduce((acc, x) => acc + x.valuation, 0);

      // Calculate Active Supply
      if (riskInfo.active_supply_threshold !== undefined || riskInfo.active_supply_leverage !== undefined) {
        const resolved_threshold = Math.min(
          riskInfo.active_supply_threshold ? riskInfo.active_supply_threshold : Infinity,
          riskInfo.active_supply_leverage ? state.valuation / riskInfo.active_supply_leverage : Infinity,
        );
        const value = Math.max(
          Math.min(
            state.equity - resolved_threshold,
            state.free - (riskInfo.minimum_free !== undefined ? riskInfo.minimum_free : 0),
          ),
          0,
        );
        state.active_supply = value;
        MetricActiveSupply.set(value, {
          account_id: riskInfo.account_id,
          group_id: riskInfo.group_id,
          currency: riskInfo.currency,
        });
      }
      // Calculate Passive Supply
      if (riskInfo.passive_supply_threshold !== undefined || riskInfo.passive_supply_leverage !== undefined) {
        const resolved_threshold = Math.min(
          riskInfo.passive_supply_threshold !== undefined ? riskInfo.passive_supply_threshold : Infinity,
          riskInfo.passive_supply_leverage !== undefined
            ? state.valuation / riskInfo.passive_supply_leverage
            : Infinity,
        );
        const value = Math.max(
          Math.min(
            state.equity - resolved_threshold,
            state.free - (riskInfo.minimum_free !== undefined ? riskInfo.minimum_free : 0),
          ),
          0,
        );
        state.passive_supply = value;
        MetricPassiveSupply.set(value, {
          account_id: riskInfo.account_id,
          group_id: riskInfo.group_id,
          currency: riskInfo.currency,
        });
      }

      // Calculate Active Demand
      if (riskInfo.active_demand_threshold !== undefined || riskInfo.active_demand_leverage !== undefined) {
        const resolved_threshold = Math.max(
          riskInfo.active_demand_threshold !== undefined ? riskInfo.active_demand_threshold : -Infinity,
          riskInfo.active_demand_leverage !== undefined
            ? state.valuation / riskInfo.active_demand_leverage
            : -Infinity,
          // candidate for minimum free
          riskInfo.minimum_free !== undefined
            ? state.equity + Math.max(0, riskInfo.minimum_free - state.free)
            : -Infinity,
        );
        const value = Math.max(resolved_threshold - state.equity, 0);

        state.active_demand = value;
        MetricActiveDemand.set(value, {
          account_id: riskInfo.account_id,
          group_id: riskInfo.group_id,
          currency: riskInfo.currency,
        });
      }

      // Calculate Passive Demand
      if (riskInfo.passive_demand_threshold !== undefined || riskInfo.passive_demand_leverage !== undefined) {
        const resolved_threshold = Math.max(
          riskInfo.passive_demand_threshold !== undefined ? riskInfo.passive_demand_threshold : -Infinity,
          riskInfo.passive_demand_leverage !== undefined
            ? state.valuation / riskInfo.passive_demand_leverage
            : -Infinity,
        );
        const value = Math.max(resolved_threshold - state.equity, 0);
        state.passive_demand = value;
        MetricPassiveDemand.set(value, {
          account_id: riskInfo.account_id,
          group_id: riskInfo.group_id,
          currency: riskInfo.currency,
        });
      }

      return state;
    }),
  );
}

const ajv = new Ajv({ strict: false });
const validator = ajv.compile(getDataRecordSchema('account_risk_info')!);

const configs$ = defer(() => readDataRecords(terminal, { type: 'account_risk_info' })).pipe(
  mergeMap((x) => x),
  map((x) => x.origin),
  filter((x) => !x.disabled),
  filter((x) => validator(x)),
  toArray(),
  retry({ delay: 5000 }),
  shareReplay(1),
);

defer(() => configs$)
  .pipe(
    mergeMap((x) => x),
    tap((x) => {
      // Keep AccountInfo in subscription
      from(useAccountInfo(terminal, x.account_id)).subscribe();
    }),
    groupBy((x) => x.currency),
    mergeMap((groupByCurrency) =>
      groupByCurrency.pipe(
        groupBy((x) => x.group_id),
        mergeMap((groupByGroup) =>
          groupByGroup.pipe(
            toArray(),
            mergeMap((x) =>
              defer(() => combineLatest(x.map((riskInfo) => mapRiskInfoToState$(riskInfo)))).pipe(
                first(),
                tap((list) => {
                  console.info(
                    formatTime(Date.now()),
                    groupByCurrency.key,
                    groupByGroup.key,
                    'decision stage',
                    list.length,
                  );
                  console.table(list);
                }),
                mergeMap(function* (
                  list,
                ): Generator<
                  { credit: string; debit: string; amount: number; currency: string } | undefined,
                  void,
                  void
                > {
                  const demandList = [...list].sort((a, b) => b.passive_demand - a.passive_demand);
                  const supplyList = [...list].sort((a, b) => b.passive_supply - a.passive_supply);
                  // Active Demand
                  for (const demandSide of list) {
                    if (demandSide.active_demand > 0) {
                      for (const supplySide of supplyList) {
                        if (demandSide.account_id === supplySide.account_id) continue;
                        // Active Demand match Active Supply
                        if (supplySide.active_supply > 0) {
                          // Assert that passive_supply > active_supply
                          yield {
                            credit: supplySide.account_id,
                            debit: demandSide.account_id,
                            currency: supplySide.currency,
                            amount: Math.floor(
                              Math.min(demandSide.passive_demand, supplySide.passive_supply),
                            ),
                          };
                        }
                      }
                      for (const supplySide of supplyList) {
                        if (demandSide.account_id === supplySide.account_id) continue;
                        if (supplySide.passive_supply > 0) {
                          yield {
                            credit: supplySide.account_id,
                            debit: demandSide.account_id,
                            currency: supplySide.currency,
                            amount: Math.floor(
                              Math.min(demandSide.passive_demand, supplySide.passive_supply),
                            ),
                          };
                        }
                      }
                    }
                  }

                  // Active Supply
                  for (const supplySide of list) {
                    if (supplySide.active_supply > 0) {
                      for (const demandSide of demandList) {
                        if (demandSide.account_id === supplySide.account_id) continue;
                        if (supplySide.active_demand > 0) {
                          yield {
                            credit: supplySide.account_id,
                            debit: demandSide.account_id,
                            currency: supplySide.currency,
                            amount: Math.floor(
                              Math.min(demandSide.passive_demand, supplySide.passive_supply),
                            ),
                          };
                        }
                      }
                      for (const demandSide of demandList) {
                        if (demandSide.account_id === supplySide.account_id) continue;
                        if (demandSide.passive_demand > 0) {
                          yield {
                            credit: supplySide.account_id,
                            debit: demandSide.account_id,
                            currency: supplySide.currency,
                            amount: Math.floor(
                              Math.min(demandSide.passive_demand, supplySide.passive_supply),
                            ),
                          };
                        }
                      }
                    }
                  }
                }),
                filter((x): x is Exclude<typeof x, undefined> => !!x),
                first((x) => x.amount > 0),
                tap((x) =>
                  console.info(
                    formatTime(Date.now()),
                    groupByCurrency.key,
                    groupByGroup.key,
                    'transfer',
                    JSON.stringify(x),
                  ),
                ),
                map(
                  (x): ITransferOrder => ({
                    order_id: UUID(),
                    created_at: Date.now(),
                    updated_at: Date.now(),
                    credit_account_id: x.credit,
                    debit_account_id: x.debit,
                    expected_amount: x.amount,
                    currency: x.currency,
                    status: 'INIT',
                    timeout_at: Date.now() + 1000 * 600,
                  }),
                ),
                delayWhen((order) =>
                  from(writeDataRecords(terminal, [getDataRecordWrapper('transfer_order')!(order)])),
                ),
                tap((x) =>
                  console.info(
                    formatTime(Date.now()),
                    groupByCurrency.key,
                    groupByGroup.key,
                    'transfer order created',
                    JSON.stringify(x),
                  ),
                ),
                delayWhen((transfer_order) =>
                  defer(() =>
                    readDataRecords(terminal, { type: 'transfer_order', id: transfer_order.order_id }),
                  ).pipe(
                    //
                    mergeMap((records) => {
                      if (records.length === 0) {
                        throw new Error(`Transfer Order ${transfer_order.order_id} not found`);
                      }
                      const record = records[0];
                      if (!['ERROR', 'COMPLETE'].includes(record.origin.status)) {
                        throw new Error(`Transfer Order ${transfer_order.order_id} failed`);
                      }
                      return of(void 0);
                    }),
                    retry({ delay: 1000 }),
                  ),
                ),
                tap((x) =>
                  console.info(
                    formatTime(Date.now()),
                    groupByCurrency.key,
                    groupByGroup.key,
                    'transfer order finished',
                    JSON.stringify(x),
                  ),
                ),
                repeat({ delay: 1000 }),
                retry({ delay: 1000 }),
              ),
            ),
          ),
        ),
      ),
    ),
  )
  .subscribe();
