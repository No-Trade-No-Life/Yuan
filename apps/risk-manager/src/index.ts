import { ITransferOrder, UUID, formatTime } from '@yuants/data-model';
import { PromRegistry, Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/transfer';
import {
  concatWith,
  defer,
  delayWhen,
  filter,
  from,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  tap,
  toArray,
} from 'rxjs';
import { IAccountRiskInfo } from './models/AccountRiskInfo';
import { wrapTransferOrder } from './models/TransferOrder';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || 'RiskManager',
  name: 'Risk Manager',
});

const dataMap: Record<
  string,
  {
    currency: string;
    group_id: string;
    equity: number;
    free: number;
    active_supply: number;
    active_demand: number;
    passive_supply: number;
    passive_demand: number;
  }
> = {};

const MetricActiveDemand = PromRegistry.create('gauge', 'risk_manager_active_demand');
const MetricPassiveDemand = PromRegistry.create('gauge', 'risk_manager_passive_demand');
const MetricActiveSupply = PromRegistry.create('gauge', 'risk_manager_active_supply');
const MetricPassiveSupply = PromRegistry.create('gauge', 'risk_manager_passive_supply');

const configs$ = defer(() => terminal.queryDataRecords<IAccountRiskInfo>({ type: 'account_risk_info' })).pipe(
  map((x) => x.origin),
  filter((x) => !x.disabled),
  toArray(),
  retry({ delay: 5000 }),
  shareReplay(1),
);

defer(() => configs$)
  .pipe(
    mergeMap((x) =>
      from(x).pipe(
        mergeMap((riskInfo) =>
          terminal.useAccountInfo(riskInfo.account_id).pipe(
            //
            map((accountInfo) => {
              dataMap[riskInfo.account_id] ??= {
                currency: '',
                group_id: riskInfo.group_id,
                equity: NaN,
                free: NaN,
                active_demand: NaN,
                passive_demand: NaN,
                passive_supply: NaN,
                active_supply: NaN,
              };
              dataMap[riskInfo.account_id].currency = accountInfo.money.currency;
              dataMap[riskInfo.account_id].equity = accountInfo.money.equity;
              dataMap[riskInfo.account_id].free = accountInfo.money.free;
              if (riskInfo.active_supply_threshold !== undefined) {
                const value = Math.max(
                  Math.min(
                    accountInfo.money.equity - riskInfo.active_supply_threshold,
                    accountInfo.money.free,
                  ),
                  0,
                );
                dataMap[riskInfo.account_id].active_supply = value;
                MetricActiveSupply.set(value, {
                  account_id: riskInfo.account_id,
                  group_id: riskInfo.group_id,
                  currency: accountInfo.money.currency,
                });
              }
              if (riskInfo.passive_supply_threshold !== undefined) {
                const value = Math.max(
                  Math.min(
                    accountInfo.money.equity - riskInfo.passive_supply_threshold,
                    accountInfo.money.free,
                  ),
                  0,
                );
                dataMap[riskInfo.account_id].passive_supply = value;
                MetricPassiveSupply.set(value, {
                  account_id: riskInfo.account_id,
                  group_id: riskInfo.group_id,
                  currency: accountInfo.money.currency,
                });
              }
              if (riskInfo.active_demand_threshold !== undefined) {
                const value = Math.max(riskInfo.active_demand_threshold - accountInfo.money.equity, 0);
                dataMap[riskInfo.account_id].active_demand = value;
                MetricActiveDemand.set(value, {
                  account_id: riskInfo.account_id,
                  group_id: riskInfo.group_id,
                  currency: accountInfo.money.currency,
                });
              }
              if (riskInfo.passive_demand_threshold !== undefined) {
                const value = Math.max(riskInfo.passive_demand_threshold - accountInfo.money.equity, 0);
                dataMap[riskInfo.account_id].passive_demand = value;
                MetricPassiveDemand.set(value, {
                  account_id: riskInfo.account_id,
                  group_id: riskInfo.group_id,
                  currency: accountInfo.money.currency,
                });
              }
            }),
          ),
        ),
      ),
    ),
  )
  .subscribe();

defer(() => configs$)
  .pipe(
    map((configs): { credit: string; debit: string; amount: number; currency: string } | undefined => {
      console.table(Object.fromEntries(Object.entries(dataMap).sort((a, b) => a[0].localeCompare(b[0]))));
      const list = Object.entries(dataMap).sort((a, b) => b[1].equity - a[1].equity);
      if (list.length < configs.length) {
        console.info(formatTime(Date.now()), 'loading data', list.length, configs.length);
        return;
      }
      // Active Demand

      for (const [demand_account_id, demandData] of list) {
        if (demandData.active_demand > 0) {
          for (const [supply_account_id, supplyData] of list) {
            if (demand_account_id === supply_account_id) continue;
            if (supplyData.currency !== demandData.currency) continue;
            if (supplyData.group_id !== demandData.group_id) continue;
            // Active Demand match Active Supply
            if (supplyData.active_supply > 0) {
              // Assert that passive_supply > active_supply
              return {
                credit: supply_account_id,
                debit: demand_account_id,
                currency: supplyData.currency,
                amount: Math.floor(Math.min(demandData.passive_demand, supplyData.passive_supply)),
              };
            }
          }
          for (const [supply_account_id, supplyData] of list) {
            if (demand_account_id === supply_account_id) continue;
            if (supplyData.currency !== demandData.currency) continue;
            if (supplyData.group_id !== demandData.group_id) continue;
            if (supplyData.passive_supply > 0) {
              return {
                credit: supply_account_id,
                debit: demand_account_id,
                currency: supplyData.currency,
                amount: Math.floor(Math.min(demandData.passive_demand, supplyData.passive_supply)),
              };
            }
          }
        }
      }

      // Active Supply
      for (const [supply_account_id, supplyData] of list) {
        if (supplyData.active_supply > 0) {
          for (const [demand_account_id, demandData] of list) {
            if (demand_account_id === supply_account_id) continue;
            if (supplyData.currency !== demandData.currency) continue;
            if (supplyData.group_id !== demandData.group_id) continue;
            if (supplyData.active_demand > 0) {
              return {
                credit: supply_account_id,
                debit: demand_account_id,
                currency: supplyData.currency,
                amount: Math.floor(Math.min(demandData.passive_demand, supplyData.passive_supply)),
              };
            }
          }
          for (const [demand_account_id, demandData] of list) {
            if (demand_account_id === supply_account_id) continue;
            if (supplyData.currency !== demandData.currency) continue;
            if (supplyData.group_id !== demandData.group_id) continue;
            if (demandData.passive_demand > 0) {
              return {
                credit: supply_account_id,
                debit: demand_account_id,
                currency: supplyData.currency,
                amount: Math.floor(Math.min(demandData.passive_demand, supplyData.passive_supply)),
              };
            }
          }
        }
      }
    }),
    map((x) => (x && x.amount > 0 ? x : undefined)),
    tap((x) => console.info(formatTime(Date.now()), 'transfer', JSON.stringify(x))),
    filter((x): x is Exclude<typeof x, undefined> => !!x),
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
    delayWhen((order) => terminal.updateDataRecords([wrapTransferOrder(order)]).pipe(concatWith(of(void 0)))),
    tap((x) => console.info(formatTime(Date.now()), 'transfer order created', JSON.stringify(x))),
    delayWhen((transfer_order) =>
      defer(() =>
        terminal.queryDataRecords<ITransferOrder>({ type: 'transfer_order', id: transfer_order.order_id }),
      ).pipe(
        //
        toArray(),
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
    tap((x) => console.info(formatTime(Date.now()), 'transfer order finished', JSON.stringify(x))),
    repeat({ delay: 1000 }),
    retry({ delay: 1000 }),
  )
  .subscribe();
